import type { Pool, PoolClient } from "pg";
import { resolveMeasurementAccess, type AccessPorts } from "../access/resolve.ts";
import { refKey } from "../catalog/registry.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { fingerprintOf, positiveRevision } from "./intervals.ts";
import { inputFailureCode, nextInputFailure } from "./input-dispatch-control.ts";
import { inputRefreshSubscription, planInputRefresh, planCompletionRefresh, INPUT_REFRESH_VERSION, type InputRefreshPolicy } from "./input-refresh.ts";
import { enqueueRefreshInTransaction } from "./refresh-enqueue.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { readRefreshSnapshot } from "./refresh-snapshot.ts";

function objectAllowed(row: { station_id: string; service_id: string | null; device_id: string | null }, scope: MeasurementScope) {
  return scope.stationIds.includes(row.station_id) && (!row.service_id || scope.serviceIds.includes(row.service_id)) &&
    (!row.device_id || scope.deviceIds.includes(row.device_id)) && (!!row.service_id || !!row.device_id || scope.allowSiteParameters);
}
// Establish authority independently of planning limits or missing capability.
// EXISTS checks all historical objects without returning unbounded evidence.
async function authorizeInputChange(client: PoolClient, scope: MeasurementScope, changeId: string) {
  const row = (await client.query(`WITH visible AS (
    SELECT m.source_id,m.metric_code,m.metric_version,m.station_id,sm.service_id,sm.device_id,m.event_id,m.component_key
    FROM bsmoss_metering.input_change c JOIN bsmoss_metering.measurement m ON (m.workspace_id,m.id)=(c.workspace_id,c.measurement_id)
    JOIN bsmoss_integration.source_mapping sm ON (sm.workspace_id,sm.id)=(m.workspace_id,m.mapping_id) WHERE c.workspace_id=$1 AND c.id=$2
    UNION ALL
    SELECT p.source_id,p.metric_code,p.metric_version,p.station_id,sm.service_id,sm.device_id,NULL,NULL
    FROM bsmoss_metering.input_change c JOIN bsmoss_integration.source_completion p ON (p.workspace_id,p.id)=(c.workspace_id,c.legacy_completion_id)
    JOIN bsmoss_integration.source_mapping sm ON (sm.workspace_id,sm.id)=(p.workspace_id,p.mapping_id) WHERE c.workspace_id=$1 AND c.id=$2
    UNION ALL
    SELECT p.source_id,p.metric_code,p.metric_version,p.station_id,p.service_id,p.device_id,NULL,NULL
    FROM bsmoss_metering.input_change c JOIN bsmoss_integration.source_completion_set p ON (p.workspace_id,p.id)=(c.workspace_id,c.completion_set_id)
    WHERE c.workspace_id=$1 AND c.id=$2
  ) SELECT v.*,EXISTS (
    SELECT 1 FROM bsmoss_metering.measurement m JOIN bsmoss_integration.source_mapping sm ON (sm.workspace_id,sm.id)=(m.workspace_id,m.mapping_id)
    WHERE m.workspace_id=$1 AND m.source_id=v.source_id AND m.event_id=v.event_id AND m.component_key=v.component_key
      AND m.metric_code=v.metric_code AND m.metric_version=v.metric_version
      AND NOT (m.station_id=ANY($3::text[]) AND (sm.service_id IS NULL OR sm.service_id=ANY($4::text[]))
        AND (sm.device_id IS NULL OR sm.device_id=ANY($5::text[])) AND (sm.service_id IS NOT NULL OR sm.device_id IS NOT NULL OR $6::boolean))
  ) AS forbidden_history FROM visible v`, [scope.workspaceId, changeId, scope.stationIds, scope.serviceIds, scope.deviceIds, scope.allowSiteParameters])).rows[0];
  if (!row || !scope.sourceIds.includes(row.source_id) || !scope.metricKeys.includes(row.metric_code + "@" + row.metric_version)) throw Error("input_change_unavailable");
  if (!objectAllowed(row, scope) || row.forbidden_history) throw Error("object_scope_denied");
}
async function completionEvidence(client: PoolClient, scope: MeasurementScope, change: { change_kind: string; legacy_completion_id: string | null; completion_set_id: string | null }, policy: InputRefreshPolicy) {
  const whole = change.change_kind === "completion_set";
  const proof = whole ? (await client.query(`SELECT * FROM bsmoss_integration.source_completion_set WHERE workspace_id=$1 AND id=$2`,
    [scope.workspaceId, change.completion_set_id])).rows[0] : (await client.query(`SELECT p.*,sm.service_id,sm.network_object_id,sm.device_id
      FROM bsmoss_integration.source_completion p JOIN bsmoss_integration.source_mapping sm
      ON (sm.workspace_id,sm.id,sm.source_id,sm.station_id)=(p.workspace_id,p.mapping_id,p.source_id,p.station_id)
      WHERE p.workspace_id=$1 AND p.id=$2`, [scope.workspaceId, change.legacy_completion_id])).rows[0];
  if (!proof || !scope.sourceIds.includes(proof.source_id) || !scope.metricKeys.includes(proof.metric_code + "@" + proof.metric_version)) throw Error("input_change_unavailable");
  if (!objectAllowed(proof, scope)) throw Error("object_scope_denied");
  let mappingId = proof.mapping_id as string | undefined;
  if (whole) {
    const mappings = (await client.query(`SELECT id FROM bsmoss_integration.source_mapping WHERE workspace_id=$1 AND source_id=$2
      AND station_id=$3 AND service_id IS NOT DISTINCT FROM $4 AND network_object_id IS NOT DISTINCT FROM $5 AND device_id IS NOT DISTINCT FROM $6
      AND valid_from<$8 AND valid_to>$7 ORDER BY valid_from,id LIMIT 10001`, [scope.workspaceId, proof.source_id, proof.station_id,
      proof.service_id, proof.network_object_id, proof.device_id, proof.period_start, proof.period_end])).rows;
    if (mappings.length > 10000) throw Error("mapping_bound_exceeded");
    mappingId = mappings[0]?.id;
  }
  if (!mappingId) throw Error("aggregate_mapping_unavailable");
  const metric = { code: proof.metric_code as string, version: Number(proof.metric_version) }, period = { start: proof.period_start.toISOString(), end: proof.period_end.toISOString() };
  return { kind: "completion" as const, metricKey: refKey(metric),
    targets: planCompletionRefresh({ sourceId: proof.source_id, mappingId, metric, grain: proof.grain, period }, policy),
    change: { kind: change.change_kind, completionId: proof.id, sourceId: proof.source_id, metricKey: refKey(metric), revision: proof.revision,
      status: proof.status, grain: proof.grain, period, watermark: proof.watermark.toISOString(),
      object: { stationId: proof.station_id, serviceId: proof.service_id, networkObjectId: proof.network_object_id, deviceId: proof.device_id },
      inputFingerprint: proof.input_fingerprint, evidenceRef: proof.evidence_ref, evidenceSha256: proof.evidence_sha256,
      ...(whole ? { mappingManifestSha256: proof.mapping_manifest_sha256 } : { mappingId }) },
    records: [{ completionId: proof.id, revision: proof.revision, mappingId, period }] };
}
async function evidenceHistory(client: PoolClient, scope: MeasurementScope, changeId: string, policy: InputRefreshPolicy) {
  const change = (await client.query('SELECT change_kind,legacy_completion_id,completion_set_id FROM bsmoss_metering.input_change WHERE workspace_id=$1 AND id=$2', [scope.workspaceId, changeId])).rows[0];
  if (!change) throw Error("input_change_unavailable");
  if (change.change_kind === "completion" || change.change_kind === "completion_set") return completionEvidence(client, scope, change, policy);
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
  return { kind: "measurement" as const, metricKey: changed.metric_code + "@" + changed.metric_version,
    change: { kind: changed.change_kind, qualityRevision: changed.quality_revision,
      measurementId: changed.id, sourceId: changed.source_id, metricKey: changed.metric_code + "@" + changed.metric_version,
      eventId: changed.event_id, componentKey: changed.component_key, eventRevision: changed.event_revision },
    records: rows.map(row => ({ measurementId: row.id, eventRevision: row.event_revision,
      mappingId: row.mapping_id, period: { start: row.period_start.toISOString(), end: row.period_end.toISOString() } })),
    impacts: rows.map(row => ({ sourceId: row.source_id as string, mappingId: row.mapping_id as string,
    metric: { code: row.metric_code as string, version: Number(row.metric_version) },
    period: { start: row.period_start.toISOString(), end: row.period_end.toISOString() }, mappingEnd: row.mapping_end.toISOString() })) };
}

// One committed change -> all subscribed old/new/dependency windows -> receipt,
// in one transaction. No machine identity, timer or global offset is invented.
async function executeInputChange(pool: Pool, ports: AccessPorts, rawChangeId: string, rawPolicy: InputRefreshPolicy, supervised: boolean) {
  jobIdentity(rawChangeId); const changeId = rawChangeId, policy = structuredClone(rawPolicy), now = ports.now ?? Date.now;
  const access = await resolveMeasurementAccess(ports, "aggregate", "data"), subscription = inputRefreshSubscription(access.scope, policy);
  if (access.expiresAt <= now()) throw Error("access_expired");
  const client = await pool.connect(); let discard = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const locked = (await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired", [JSON.stringify([INPUT_REFRESH_VERSION, access.context.workspaceId, changeId, subscription.sha256])])).rows[0].acquired;
    if (!locked) { await client.query("ROLLBACK"); return { status: "busy" as const }; }
    await authorizeInputChange(client, access.scope, changeId);
    const prior = (await client.query(`SELECT manifest,manifest_sha256 FROM bsmoss_analysis.input_refresh_receipt
      WHERE workspace_id=$1 AND change_id=$2 AND subscription_sha256=$3`, [access.context.workspaceId, changeId, subscription.sha256])).rows[0];
    if (prior) {
      if (access.expiresAt <= now()) throw Error("access_expired");
      if (fingerprintOf(prior.manifest) !== prior.manifest_sha256) throw Error("input_receipt_corrupt");
      await client.query("COMMIT"); return { status: "duplicate" as const, manifest: prior.manifest, manifestSha256: prior.manifest_sha256 as string };
    }
    const last = (await client.query(`SELECT revision,attempt,state,available_at,available_at<=clock_timestamp() AS ready FROM bsmoss_analysis.input_dispatch_event
      WHERE workspace_id=$1 AND change_id=$2 AND subscription_sha256=$3 ORDER BY revision DESC LIMIT 1`, [access.context.workspaceId, changeId, subscription.sha256])).rows[0];
    if (last?.state === "quarantined") { await client.query("COMMIT"); return { status: "quarantined" as const, revision: last.revision as string }; }
    if (last?.state === "retry" && !last.ready) { await client.query("COMMIT"); return { status: "deferred" as const, retryAt: last.available_at.toISOString() as string }; }
    await client.query("SAVEPOINT input_dispatch_work");
    let outcome;
    try {
    const evidence = await evidenceHistory(client, access.scope, changeId, subscription.policy);
    const candidates = evidence.kind === "completion" ? evidence.targets : planInputRefresh(evidence.impacts, subscription.policy), targets = [];
    for (const target of candidates) {
      if (evidence.kind === "measurement" && refKey(target.metric) !== evidence.metricKey) {
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
      policy: subscription.policy, triggerRef, change: evidence.change, evidence: evidence.records,
      targets, jobs: queued.jobs.map(job => ({ id: job.id })), queueManifestSha256: queued.manifestSha256 };
    const manifestSha256 = fingerprintOf(manifest);
    await client.query(`INSERT INTO bsmoss_analysis.input_refresh_receipt(workspace_id,change_id,subscription_sha256,manifest_sha256,manifest,recorded_by)
      VALUES($1,$2,$3,$4,$5,$6)`, [access.context.workspaceId, changeId, subscription.sha256, manifestSha256, manifest, access.context.sub]);
    if (access.expiresAt <= now()) throw Error("access_expired");
    await client.query("RELEASE SAVEPOINT input_dispatch_work");
    outcome = { status: "dispatched" as const, manifest, manifestSha256 };
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT input_dispatch_work");
      await client.query("RELEASE SAVEPOINT input_dispatch_work");
      const code = inputFailureCode(error);
      if (!supervised || !code) throw error;
      // Re-resolve grants before writing failure evidence. Lost/changed scope
      // cannot quarantine work under the old authorization subscription.
      const current = await resolveMeasurementAccess(ports, "aggregate", "data");
      if (current.context.sub !== access.context.sub || current.context.workspaceId !== access.context.workspaceId ||
          inputRefreshSubscription(current.scope, policy).sha256 !== subscription.sha256) throw Error("permission_denied");
      if (current.expiresAt <= now()) throw Error("access_expired");
      const next = nextInputFailure(last ? { revision: last.revision, attempt: Number(last.attempt), state: last.state } : null);
      const row = (await client.query(`INSERT INTO bsmoss_analysis.input_dispatch_event(workspace_id,change_id,subscription_sha256,revision,attempt,state,failure_code,available_at,recorded_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+$8::int*interval '1 second',$9) RETURNING available_at`,
      [access.context.workspaceId, changeId, subscription.sha256, next.revision, next.attempt, next.state, code, next.delaySeconds, current.context.sub])).rows[0];
      if (current.expiresAt <= now()) throw Error("access_expired");
      outcome = { status: "failure_recorded" as const, changeId, revision: next.revision, attempt: next.attempt, state: next.state, code, retryAt: row.available_at.toISOString() as string };
    }
    await client.query("COMMIT");
    return outcome;
  } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
  finally { client.release(discard); }
}

// Direct internal calls honor durable backoff/quarantine. The supervisor also
// records classified failures after the work savepoint has been rolled back.
export function dispatchInputChange(pool: Pool, ports: AccessPorts, changeId: string, policy: InputRefreshPolicy) {
  return executeInputChange(pool, ports, changeId, policy, false);
}
export function superviseInputChange(pool: Pool, ports: AccessPorts, changeId: string, policy: InputRefreshPolicy) {
  return executeInputChange(pool, ports, changeId, policy, true);
}

export async function reopenInputChange(pool: Pool, ports: AccessPorts, raw: { changeId: string; expectedRevision: string; reasonRef: string; policy: InputRefreshPolicy }) {
  const input = structuredClone(raw);
  if (!input || Object.keys(input).some(k => !["changeId", "expectedRevision", "reasonRef", "policy"].includes(k))) throw Error("invalid_input_reopen_request");
  jobIdentity(input.changeId); jobIdentity(input.reasonRef); positiveRevision(input.expectedRevision);
  const access = await resolveMeasurementAccess(ports, "aggregate", "data"), subscription = inputRefreshSubscription(access.scope, input.policy), now = ports.now ?? Date.now;
  const args = [access.context.workspaceId, input.changeId, subscription.sha256], client = await pool.connect(); let discard = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const locked = (await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired", [JSON.stringify([INPUT_REFRESH_VERSION, ...args])])).rows[0].acquired;
    if (!locked) { await client.query("ROLLBACK"); return { status: "busy" as const }; }
    await authorizeInputChange(client, access.scope, input.changeId);
    if (access.expiresAt <= now()) throw Error("access_expired");
    const prior = (await client.query(`SELECT revision FROM bsmoss_analysis.input_dispatch_event WHERE workspace_id=$1 AND change_id=$2 AND subscription_sha256=$3 AND reason_ref=$4`, [...args, input.reasonRef])).rows[0];
    if (prior) {
      if (BigInt(prior.revision) !== BigInt(input.expectedRevision) + 1n) throw Error("conflicting_input_reopen_replay");
      await client.query("COMMIT"); return { status: "duplicate" as const, revision: prior.revision as string };
    }
    if ((await client.query("SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE workspace_id=$1 AND change_id=$2 AND subscription_sha256=$3", args)).rowCount) throw Error("input_already_dispatched");
    const last = (await client.query(`SELECT revision,state FROM bsmoss_analysis.input_dispatch_event WHERE workspace_id=$1 AND change_id=$2 AND subscription_sha256=$3 ORDER BY revision DESC LIMIT 1`, args)).rows[0];
    if (!last || last.revision !== input.expectedRevision) throw Error("input_dispatch_revision_conflict");
    if (last.state !== "quarantined") throw Error("input_not_quarantined");
    const revision = (BigInt(last.revision) + 1n).toString(); positiveRevision(revision);
    await client.query(`INSERT INTO bsmoss_analysis.input_dispatch_event(workspace_id,change_id,subscription_sha256,revision,attempt,state,reason_ref,available_at,recorded_by)
      VALUES($1,$2,$3,$4,0,'reopened',$5,clock_timestamp(),$6)`, [...args, revision, input.reasonRef, access.context.sub]);
    if (access.expiresAt <= now()) throw Error("access_expired");
    await client.query("COMMIT"); return { status: "reopened" as const, revision };
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
  const rows = (await pool.query(`WITH visible AS (
      SELECT c.id,c.created_at,m.source_id,m.metric_code,m.metric_version,m.station_id,sm.service_id,sm.device_id,NULL::text AS proof_grain,false AS is_proof
      FROM bsmoss_metering.input_change c JOIN bsmoss_metering.measurement m ON (m.workspace_id,m.id)=(c.workspace_id,c.measurement_id)
      JOIN bsmoss_integration.source_mapping sm ON (sm.workspace_id,sm.id)=(m.workspace_id,m.mapping_id) WHERE c.workspace_id=$1
      UNION ALL
      SELECT c.id,c.created_at,p.source_id,p.metric_code,p.metric_version,p.station_id,sm.service_id,sm.device_id,p.grain,true
      FROM bsmoss_metering.input_change c JOIN bsmoss_integration.source_completion p ON (p.workspace_id,p.id)=(c.workspace_id,c.legacy_completion_id)
      JOIN bsmoss_integration.source_mapping sm ON (sm.workspace_id,sm.id)=(p.workspace_id,p.mapping_id) WHERE c.workspace_id=$1
      UNION ALL
      SELECT c.id,c.created_at,p.source_id,p.metric_code,p.metric_version,p.station_id,p.service_id,p.device_id,p.grain,true
      FROM bsmoss_metering.input_change c JOIN bsmoss_integration.source_completion_set p ON (p.workspace_id,p.id)=(c.workspace_id,c.completion_set_id) WHERE c.workspace_id=$1
    ) SELECT v.id FROM visible v LEFT JOIN LATERAL (
      SELECT state,available_at FROM bsmoss_analysis.input_dispatch_event e WHERE e.workspace_id=$1 AND e.change_id=v.id AND e.subscription_sha256=$8 ORDER BY revision DESC LIMIT 1
    ) control ON true WHERE v.source_id=ANY($2::text[])
    AND (control.state IS NULL OR control.state='reopened' OR (control.state='retry' AND control.available_at<=clock_timestamp()))
    AND ((NOT v.is_proof AND v.metric_code||'@'||v.metric_version::text=ANY($3::text[])) OR
      (v.is_proof AND v.metric_code||'@'||v.metric_version::text=ANY($9::text[]) AND v.proof_grain=ANY($10::text[])))
    AND v.station_id=ANY($4::text[]) AND (v.service_id IS NULL OR v.service_id=ANY($5::text[]))
    AND (v.device_id IS NULL OR v.device_id=ANY($6::text[])) AND (v.service_id IS NOT NULL OR v.device_id IS NOT NULL OR $7::boolean)
    AND NOT EXISTS(SELECT 1 FROM bsmoss_analysis.input_refresh_receipt r WHERE (r.workspace_id,r.change_id,r.subscription_sha256)=($1,v.id,$8))
    ORDER BY v.created_at,v.id LIMIT 64`, [s.workspaceId, s.sourceIds, s.metricKeys.filter(key => relevant.has(key)), s.stationIds, s.serviceIds, s.deviceIds,
    s.allowSiteParameters, subscription.sha256, subscription.policy.outputs.map(refKey), subscription.policy.grains])).rows;
  if (access.expiresAt <= (ports.now ?? Date.now)()) throw Error("access_expired");
  return { subscriptionSha256: subscription.sha256, changeIds: rows.map(row => row.id as string) };
}

export async function runInputRefreshStep(pool: Pool, ports: AccessPorts, rawPolicy: InputRefreshPolicy) {
  const policy = structuredClone(rawPolicy), pending = await pendingInputChanges(pool, ports, policy);
  for (const changeId of pending.changeIds) {
    const result = await superviseInputChange(pool, ports, changeId, policy);
    if (["busy", "deferred", "quarantined"].includes(result.status)) continue;
    return { ...result, changeId };
  }
  return { status: pending.changeIds.length ? "contended" as const : "idle" as const };
}
