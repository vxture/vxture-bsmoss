import type { Pool, PoolClient } from "pg";
import type { MeasurementScope } from "../measurements/store.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey } from "../catalog/registry.ts";
import type { InputRefreshPolicy } from "./input-refresh.ts";
import { authorityChange, authorityObjectAllowed, authorityOutputRelevant, authoritySubject, objectFromMapping, planAuthorityImpact, type AuthorityCandidate } from "./authority-impact.ts";
import { readRefreshSnapshot } from "./refresh-snapshot.ts";
import { aggregateIntervals } from "./intervals.ts";
import { aggregateStatePeriod } from "./state-period.ts";
import { aggregateGaugePeriod } from "./gauge-period.ts";
import type { AggregateTarget } from "./snapshot.ts";

export async function authorizedAuthorityChange(client: PoolClient, scope: MeasurementScope, changeId: string) {
  const row = (await client.query(`SELECT a.*,a.evidence_sha256=encode(sha256(convert_to(jsonb_build_object('before',a.before_snapshot,'after',a.after_snapshot)::text,'UTF8')),'hex') AS valid
    FROM bsmoss_metering.input_change c JOIN bsmoss_integration.authority_change a ON (a.workspace_id,a.id)=(c.workspace_id,c.authority_change_id)
    WHERE c.workspace_id=$1 AND c.id=$2`, [scope.workspaceId, changeId])).rows[0];
  if (!row) throw Error("input_change_unavailable");
  if (!row.valid) throw Error("invalid_authority_evidence");
  return authorityChange(row, scope);
}
function authorityUnavailable(error: unknown) {
  if ((error as { code?: string })?.code) return false;
  return /^(aggregate_capability_|aggregate_mapping_|aggregate_subject_mapping_|aggregate_policy_|aggregate_dependency_policy_|state_policy_|invalid_state_hold_policy|gauge_policy_|gauge_duration_required|invalid_gauge_duration_policy|unsupported_native_grain|mixed_native_grain|unaligned_mapping_boundary|unaligned_service_boundary|state_mapping_|mapping_object_mismatch|authority_history_required)/.test((error as Error)?.message ?? "");
}
// All effects are derived from immutable authority evidence plus existing facts
// and publications. No caller-supplied ranges, objects or result values.
export async function authorityEvidence(pool: Pool, client: PoolClient, scope: MeasurementScope, changeId: string, policy: InputRefreshPolicy, subscription: string, actor: string) {
  const change = await authorizedAuthorityChange(client, scope, changeId), anchor = change.snapshots.at(-1)!;
  const sources = change.kind === "station_service" ? scope.sourceIds : [anchor.source_id as string];
  const mappings = (await client.query(`SELECT m FROM (
      SELECT DISTINCT ON (entity_id) coalesce(after_snapshot,before_snapshot) AS m FROM bsmoss_integration.authority_change
      WHERE workspace_id=$1 AND entity_kind='source_mapping' AND coalesce(after_snapshot,before_snapshot)->>'source_id'=ANY($2::text[])
      AND ($8::text IS NULL OR entity_id=$8) AND ($9::text IS NULL OR coalesce(after_snapshot,before_snapshot)->>'service_id'=$9)
      ORDER BY entity_id,revision DESC
    ) history WHERE m->>'station_id'=ANY($3::text[]) AND (m->>'service_id' IS NULL OR m->>'service_id'=ANY($4::text[]))
    AND (m->>'device_id' IS NULL OR m->>'device_id'=ANY($5::text[])) AND (m->>'service_id' IS NOT NULL OR m->>'device_id' IS NOT NULL OR $6::boolean)
    ORDER BY m->>'id' LIMIT $7`, [scope.workspaceId, sources, scope.stationIds, scope.serviceIds, scope.deviceIds, scope.allowSiteParameters, 1001,
    change.kind === "source_mapping" ? change.entityId : null, change.kind === "station_service" ? change.entityId : null])).rows;
  if (mappings.length > 1000) throw Error("authority_bound_exceeded");
  const objects = mappings.map(row => objectFromMapping(row.m));
  if (objects.some(o => !authorityObjectAllowed(o, scope))) throw Error("object_scope_denied");
  const outputs = policy.outputs.filter(output => authorityOutputRelevant(change, output));
  const refs = [...new Set(outputs.flatMap(ref => [ref, ...FIRST_METRICS.get(ref)!.dependencies]).map(refKey))];
  const ranges = change.snapshots.map(s => ({ start: s.valid_from, end: s.valid_to }));
  const pairs = [...new Map(objects.map(o => [JSON.stringify([o.sourceId, authoritySubject(o)]), { source: o.sourceId, subject: authoritySubject(o) }])).values()];
  const publications = (await client.query(`SELECT s.id,s.source_id,s.subject_key,s.metric_code,s.metric_version,s.grain,s.period_start,s.period_end,s.current_revision,r.input_fingerprint
    FROM bsmoss_analysis.aggregate_series s JOIN jsonb_to_recordset($2::jsonb) AS p(source text,subject text) ON (s.source_id,s.subject_key)=(p.source,p.subject)
    JOIN bsmoss_analysis.aggregate_revision r ON (r.workspace_id,r.series_id,r.revision)=(s.workspace_id,s.id,s.current_revision)
    WHERE s.workspace_id=$1 AND s.metric_code||'@'||s.metric_version::text=ANY($3::text[]) AND s.grain=ANY($4::text[])
    AND EXISTS(SELECT 1 FROM jsonb_to_recordset($5::jsonb) AS w(start text,"end" text) WHERE s.period_start<w."end"::timestamptz AND s.period_end>w.start::timestamptz)
    ORDER BY s.id LIMIT 65`, [scope.workspaceId, JSON.stringify(pairs), outputs.map(refKey), policy.grains, JSON.stringify(ranges)])).rows;
  if (publications.length > 64) throw Error("authority_bound_exceeded");
  const bySubject = new Map(objects.map(o => [JSON.stringify([o.sourceId, authoritySubject(o)]), o]));
  const published: AuthorityCandidate[] = publications.map(row => ({ object: bySubject.get(JSON.stringify([row.source_id, row.subject_key]))!,
    metric: { code: row.metric_code, version: Number(row.metric_version) }, grain: row.grain, period: { start: row.period_start.toISOString(), end: row.period_end.toISOString() },
    published: { seriesId: row.id, revision: row.current_revision, inputFingerprint: row.input_fingerprint } }));
  const states = refs.filter(key => FIRST_METRICS.list().some(m => refKey(m) === key && m.semantic === "state"));
  const facts = (await client.query(`SELECT DISTINCT m.mapping_id,m.metric_code,m.metric_version,m.period_start,m.period_end FROM bsmoss_metering.measurement m
    WHERE m.workspace_id=$1 AND m.mapping_id=ANY($2::text[]) AND m.source_id=ANY($3::text[]) AND m.metric_code||'@'||m.metric_version::text=ANY($4::text[])
    AND EXISTS(SELECT 1 FROM jsonb_to_recordset($5::jsonb) AS w(start text,"end" text) WHERE m.period_start<w."end"::timestamptz
      AND greatest(m.period_end,CASE WHEN m.metric_code||'@'||m.metric_version::text=ANY($6::text[]) THEN m.period_start+interval '24 hours' ELSE m.period_end END)>w.start::timestamptz)
    ORDER BY m.mapping_id,m.metric_code,m.metric_version,m.period_start,m.period_end LIMIT 1001`,
  [scope.workspaceId, objects.map(o => o.mappingId), sources, refs, JSON.stringify(ranges), states])).rows;
  const candidates = planAuthorityImpact(change, objects, facts.map(row => ({ mappingId: row.mapping_id, metric: { code: row.metric_code, version: Number(row.metric_version) },
    period: { start: row.period_start.toISOString(), end: row.period_end.toISOString() } })), published, { ...policy, outputs });
  const targets: AggregateTarget[] = [], effects = [];
  for (const candidate of candidates) {
    const o = candidate.object;
    const mapping = (await client.query(`SELECT id FROM bsmoss_integration.source_mapping WHERE workspace_id=$1 AND source_id=$2 AND station_id=$3
      AND service_id IS NOT DISTINCT FROM $4 AND network_object_id IS NOT DISTINCT FROM $5 AND device_id IS NOT DISTINCT FROM $6
      ORDER BY (valid_from<$8 AND valid_to>$7) DESC,valid_from,id LIMIT 1`, [scope.workspaceId, o.sourceId, o.stationId, o.serviceId, o.networkObjectId, o.deviceId, candidate.period.start, candidate.period.end])).rows[0];
    const target = mapping ? { sourceId: o.sourceId, mappingId: mapping.id as string, metric: candidate.metric, grain: candidate.grain, at: candidate.period.start } : null;
    let fresh: string | null = null;
    if (target) {
      try {
        const snapshot = await readRefreshSnapshot(pool, scope, target, client);
        if (snapshot.plan.subjectKey !== authoritySubject(o)) throw Error("aggregate_scope_denied");
        const ownCapability = change.kind !== "source_capability" || change.snapshots.some(s => s.metric_code + "@" + s.metric_version === refKey(candidate.metric));
        if (!ownCapability && snapshot.kind === "interval" && snapshot.plan.inputMode === "direct") continue;
        fresh = snapshot.kind === "state" ? aggregateStatePeriod(snapshot.plan, snapshot.inputs).inputFingerprint
          : snapshot.kind === "gauge" ? aggregateGaugePeriod(snapshot.plan, snapshot.inputs).inputFingerprint : aggregateIntervals(snapshot.plan, snapshot.inputs).inputFingerprint;
      } catch (error) { if (!authorityUnavailable(error)) throw error; }
    }
    let invalidated = false;
    if (candidate.published && candidate.published.inputFingerprint !== fresh) {
      const head = (await client.query('SELECT current_revision FROM bsmoss_analysis.aggregate_series WHERE workspace_id=$1 AND id=$2 FOR UPDATE', [scope.workspaceId, candidate.published.seriesId])).rows[0];
      if (head?.current_revision !== candidate.published.revision) throw Error("aggregate_revision_conflict");
      await client.query(`INSERT INTO bsmoss_analysis.aggregate_authority_invalidation(workspace_id,series_id,invalidated_revision,authority_change_id,subscription_sha256,reason,recorded_by)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, [scope.workspaceId, candidate.published.seriesId, candidate.published.revision, change.id, subscription,
        fresh ? "awaiting_recompute" : "authority_unavailable", actor]);
      invalidated = true;
    }
    if (fresh && target) targets.push(target);
    effects.push({ sourceId: o.sourceId, subjectKey: authoritySubject(o), metric: candidate.metric, grain: candidate.grain, period: candidate.period,
      outcome: fresh ? "queued" : "authority_unavailable", invalidated, ...(candidate.published ? { publication: candidate.published } : {}) });
  }
  return { kind: "authority" as const, targets, change: { kind: "authority", authorityChangeId: change.id, entityKind: change.kind, entityId: change.entityId,
    revision: change.revision, operation: change.operation, evidenceSha256: change.evidenceSha256 }, records: effects };
}
