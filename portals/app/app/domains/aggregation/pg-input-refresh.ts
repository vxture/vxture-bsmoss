import type { Pool, PoolClient } from "pg";
import { resolveMeasurementAccess, type AccessPorts } from "../access/resolve.ts";
import { refKey } from "../catalog/registry.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { fingerprintOf } from "./intervals.ts";
import { inputRefreshSubscription, planInputRefresh, INPUT_REFRESH_VERSION, type InputRefreshPolicy } from "./input-refresh.ts";
import { enqueueRefreshInTransaction } from "./refresh-enqueue.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { readRefreshSnapshot } from "./refresh-snapshot.ts";

function objectAllowed(row: { station_id: string; service_id: string | null; device_id: string | null }, scope: MeasurementScope) {
  return scope.stationIds.includes(row.station_id) && (!row.service_id || scope.serviceIds.includes(row.service_id)) &&
    (!row.device_id || scope.deviceIds.includes(row.device_id)) && (!!row.service_id || !!row.device_id || scope.allowSiteParameters);
}
async function evidenceHistory(client: PoolClient, scope: MeasurementScope, changeId: string) {
  const changed = (await client.query(`SELECT c.change_kind,c.quality_revision,m.* FROM bsmoss_metering.input_change c
    JOIN bsmoss_metering.measurement m ON (m.workspace_id,m.id)=(c.workspace_id,c.measurement_id)
    WHERE c.workspace_id=$1 AND c.id=$2 AND m.source_id=ANY($3::text[]) AND m.metric_code||'@'||m.metric_version::text=ANY($4::text[])`,
  [scope.workspaceId, changeId, scope.sourceIds, scope.metricKeys])).rows[0];
  if (!changed) throw Error("input_change_unavailable");
  // All immutable revisions, not just previous_revision. Out-of-order arrival
  // and a correction consumed after a later correction must cover both ends.
  const rows = (await client.query(`SELECT m.*,sm.service_id,sm.network_object_id,sm.device_id,sm.valid_to AS mapping_end
    FROM bsmoss_metering.measurement m JOIN bsmoss_integration.source_mapping sm ON (sm.workspace_id,sm.id)=(m.workspace_id,m.mapping_id)
    WHERE m.workspace_id=$1 AND m.source_id=$2 AND m.event_id=$3 AND m.component_key=$4 AND m.metric_code=$5 AND m.metric_version=$6
    ORDER BY m.event_revision LIMIT 1001`, [scope.workspaceId, changed.source_id, changed.event_id, changed.component_key, changed.metric_code, changed.metric_version])).rows;
  if (rows.length > 1000) throw Error("input_history_bound_exceeded");
  if (!rows.length || rows.some(row => !objectAllowed(row, scope))) throw Error("object_scope_denied");
  return { changed, rows, impacts: rows.map(row => ({ sourceId: row.source_id as string, mappingId: row.mapping_id as string,
    metric: { code: row.metric_code as string, version: Number(row.metric_version) },
    period: { start: row.period_start.toISOString(), end: row.period_end.toISOString() }, mappingEnd: row.mapping_end.toISOString() })) };
}

// One committed change -> all subscribed old/new/dependency windows -> receipt,
// in one transaction. No machine identity, timer or global offset is invented.
export async function dispatchInputChange(pool: Pool, ports: AccessPorts, rawChangeId: string, rawPolicy: InputRefreshPolicy) {
  jobIdentity(rawChangeId); const changeId = rawChangeId, policy = structuredClone(rawPolicy), now = ports.now ?? Date.now;
  const access = await resolveMeasurementAccess(ports, "aggregate", "data"), subscription = inputRefreshSubscription(access.scope, policy);
  if (access.expiresAt <= now()) throw Error("access_expired");
  const client = await pool.connect(); let discard = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const locked = (await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired", [JSON.stringify([INPUT_REFRESH_VERSION, access.context.workspaceId, changeId, subscription.sha256])])).rows[0].acquired;
    if (!locked) { await client.query("ROLLBACK"); return { status: "busy" as const }; }
    const evidence = await evidenceHistory(client, access.scope, changeId);
    const prior = (await client.query(`SELECT manifest,manifest_sha256 FROM bsmoss_analysis.input_refresh_receipt
      WHERE workspace_id=$1 AND change_id=$2 AND subscription_sha256=$3`, [access.context.workspaceId, changeId, subscription.sha256])).rows[0];
    if (prior) {
      if (access.expiresAt <= now()) throw Error("access_expired");
      if (fingerprintOf(prior.manifest) !== prior.manifest_sha256) throw Error("input_receipt_corrupt");
      await client.query("COMMIT"); return { status: "duplicate" as const, manifest: prior.manifest, manifestSha256: prior.manifest_sha256 as string };
    }
    const candidates = planInputRefresh(evidence.impacts, subscription.policy), targets = [];
    for (const target of candidates) {
      if (refKey(target.metric) !== evidence.changed.metric_code + "@" + evidence.changed.metric_version) {
        // A configured ratio may use direct parts instead of dependency counts.
        // Read reviewed policy for this exact period; missing/ambiguous authority
        // leaves the change unacknowledged instead of silently dropping output.
        const snapshot = await readRefreshSnapshot(pool, access.scope, target, client);
        if (snapshot.kind === "interval" && snapshot.plan.inputMode === "direct") continue;
        if (snapshot.kind !== "interval" || snapshot.plan.inputMode !== "dependencies") throw Error("aggregate_policy_required");
      }
      targets.push(target);
    }
    const triggerRef = "input:" + INPUT_REFRESH_VERSION + ":" + fingerprintOf([changeId, subscription.sha256]);
    const queued = await enqueueRefreshInTransaction(pool, client, access, now, targets, triggerRef);
    const manifest = { version: INPUT_REFRESH_VERSION, changeId, subscriptionSha256: subscription.sha256,
      policy: subscription.policy, triggerRef, change: { kind: evidence.changed.change_kind, qualityRevision: evidence.changed.quality_revision,
        measurementId: evidence.changed.id, sourceId: evidence.changed.source_id, metricKey: evidence.changed.metric_code + "@" + evidence.changed.metric_version,
        eventId: evidence.changed.event_id, componentKey: evidence.changed.component_key, eventRevision: evidence.changed.event_revision },
      evidence: evidence.rows.map(row => ({ measurementId: row.id, eventRevision: row.event_revision,
        mappingId: row.mapping_id, period: { start: row.period_start.toISOString(), end: row.period_end.toISOString() } })),
      targets, jobs: queued.jobs.map(job => ({ id: job.id })), queueManifestSha256: queued.manifestSha256 };
    const manifestSha256 = fingerprintOf(manifest);
    await client.query(`INSERT INTO bsmoss_analysis.input_refresh_receipt(workspace_id,change_id,subscription_sha256,manifest_sha256,manifest,recorded_by)
      VALUES($1,$2,$3,$4,$5,$6)`, [access.context.workspaceId, changeId, subscription.sha256, manifestSha256, manifest, access.context.sub]);
    if (access.expiresAt <= now()) throw Error("access_expired");
    await client.query("COMMIT");
    return { status: "dispatched" as const, manifest, manifestSha256 };
  } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
  finally { client.release(discard); }
}

// Bounded discovery has no created_at/id high-water mark. A transaction which
// commits late remains pending; expired/revoked scope cannot acknowledge it.
export async function pendingInputChanges(pool: Pool, ports: AccessPorts, rawPolicy: InputRefreshPolicy) {
  const policy = structuredClone(rawPolicy);
  const access = await resolveMeasurementAccess(ports, "aggregate", "data"), s = access.scope;
  const subscription = inputRefreshSubscription(s, policy);
  const relevant = new Set(subscription.policy.outputs.flatMap(ref => [ref, ...FIRST_METRICS.get(ref)!.dependencies]).map(refKey));
  const rows = (await pool.query(`SELECT c.id FROM bsmoss_metering.input_change c
    JOIN bsmoss_metering.measurement m ON (m.workspace_id,m.id)=(c.workspace_id,c.measurement_id)
    JOIN bsmoss_integration.source_mapping sm ON (sm.workspace_id,sm.id)=(m.workspace_id,m.mapping_id)
    WHERE c.workspace_id=$1 AND m.source_id=ANY($2::text[]) AND m.metric_code||'@'||m.metric_version::text=ANY($3::text[])
    AND m.station_id=ANY($4::text[]) AND (sm.service_id IS NULL OR sm.service_id=ANY($5::text[]))
    AND (sm.device_id IS NULL OR sm.device_id=ANY($6::text[])) AND (sm.service_id IS NOT NULL OR sm.device_id IS NOT NULL OR $7::boolean)
    AND NOT EXISTS(SELECT 1 FROM bsmoss_analysis.input_refresh_receipt r WHERE (r.workspace_id,r.change_id,r.subscription_sha256)=(c.workspace_id,c.id,$8))
    ORDER BY c.created_at,c.id LIMIT 64`, [s.workspaceId, s.sourceIds, s.metricKeys.filter(key => relevant.has(key)), s.stationIds, s.serviceIds, s.deviceIds, s.allowSiteParameters, subscription.sha256])).rows;
  if (access.expiresAt <= (ports.now ?? Date.now)()) throw Error("access_expired");
  return { subscriptionSha256: subscription.sha256, changeIds: rows.map(row => row.id as string) };
}
