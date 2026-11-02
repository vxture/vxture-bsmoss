import type { Pool, PoolClient } from "pg";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey } from "../catalog/registry.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { fingerprintOf } from "./intervals.ts";
import { bucketFor } from "./periods.ts";
import { readAggregateQueryInTransaction } from "./pg-query.ts";
import { aggregateObjectRollup, atomKey, normalizeRollupConfig, normalizeRollupQuery,
  type RollupConfig, type RollupQuery, type ObjectRollupReader, type ObjectRollupResult, type RollupObservation } from "./object-rollup.ts";

// Only known authority-availability errors become missing members. SQL errors,
// corruption, permission failures and bounds violations must fail the read.
const unavailable = new Set(["aggregate_capability_unavailable_or_ambiguous", "aggregate_capability_boundary", "aggregate_policy_required",
  "aggregate_mapping_unavailable", "aggregate_mapping_gap", "aggregate_subject_mapping_ambiguous", "unaligned_mapping_boundary", "unaligned_service_boundary",
  "aggregate_dependency_policy_required", "mixed_native_grain", "unsupported_native_grain", "state_policy_required", "gauge_policy_required", "gauge_duration_required"]);

async function topology(client: PoolClient, scope: MeasurementScope, c: RollupConfig, query: RollupQuery) {
  const def = FIRST_METRICS.get(c.metric)!, period = bucketFor(query.at, query.grain);
  if (!scope.metricKeys.includes(refKey(c.metric)) || c.members.some(m => !scope.sourceIds.includes(m.sourceId)) ||
      c.atoms.some(a => !scope.stationIds.includes(a.stationId) || a.serviceId !== null && !scope.serviceIds.includes(a.serviceId) || a.deviceId !== undefined && !scope.deviceIds.includes(a.deviceId)) ||
      def.object === "station_meter" && !scope.allowSiteParameters) throw Error("rollup_scope_denied");
  const attribution: ObjectRollupResult["attribution"][number][] = [];
  for (const atom of c.atoms) {
    const row = (await client.query(`SELECT st.id,s.operator_entity_id,s.valid_from,s.valid_to,n.kind FROM bsmoss_resource.station st
      LEFT JOIN bsmoss_resource.station_service s ON s.workspace_id=st.workspace_id AND s.station_id=st.id AND s.id=$3
      LEFT JOIN bsmoss_resource.network_object n ON n.workspace_id=st.workspace_id AND n.station_id=st.id AND n.service_id=s.id AND n.id=$4
      WHERE st.workspace_id=$1 AND st.id=$2`, [scope.workspaceId, atom.stationId, atom.serviceId, atom.networkObjectId])).rows[0];
    if (!row || atom.serviceId !== null && (!row.operator_entity_id || row.kind !== "cell")) throw Error("rollup_atom_unavailable");
    if (atom.deviceId !== undefined && !(await client.query(`SELECT id FROM bsmoss_resource.device WHERE workspace_id=$1 AND id=$2 AND station_id=$3`,
      [scope.workspaceId, atom.deviceId, atom.stationId])).rows.length) throw Error("rollup_atom_unavailable");
    attribution.push({ ...atom, key: atomKey(atom), operatorEntityId: row.operator_entity_id ?? null,
      serviceApplicable: atom.serviceId === null ? null : row.valid_from < new Date(period.end) && row.valid_to > new Date(period.start) });
  }
  const absent = new Set<string>(), subjects = new Set<string>();
  for (const member of c.members) {
    const m = (await client.query(`SELECT m.*,n.kind FROM bsmoss_integration.source_mapping m
      LEFT JOIN bsmoss_resource.network_object n ON n.workspace_id=m.workspace_id AND n.id=m.network_object_id
      WHERE m.workspace_id=$1 AND m.id=$2 AND m.source_id=$3`, [scope.workspaceId, member.mappingId, member.sourceId])).rows[0];
    if (!m) { absent.add(member.id); continue; }
    const subject = JSON.stringify([m.source_id, m.station_id, m.service_id, m.network_object_id, m.device_id]);
    if (subjects.has(subject)) throw Error("duplicate_rollup_subject");
    subjects.add(subject);
    if (!scope.stationIds.includes(m.station_id) || m.service_id && !scope.serviceIds.includes(m.service_id) ||
        m.device_id && !scope.deviceIds.includes(m.device_id)) throw Error("rollup_scope_denied");
    const atoms = c.atoms.filter(a => member.atomKeys.includes(atomKey(a)));
    if (def.object === "device") {
      if (m.service_id || m.network_object_id || !m.device_id || atoms.some(a => a.stationId !== m.station_id || a.deviceId !== m.device_id)) throw Error("rollup_mapping_coverage_mismatch");
      continue;
    }
    if (m.device_id || atoms.some(a => a.stationId !== m.station_id || a.serviceId !== m.service_id) ||
        def.object === "station_meter" && m.network_object_id || def.attribution === "service_required" &&
        (!m.network_object_id || !["cell", "base_station", "statistic_point"].includes(m.kind) ||
          m.kind === "cell" && atoms.some(a => a.networkObjectId !== m.network_object_id)) ||
        def.object === "cell" && m.kind !== "cell") throw Error("rollup_mapping_coverage_mismatch");
  }
  return { attribution, absent };
}

// The report generator owns its write transaction; this core neither starts nor
// commits a transaction and all member reads stay on that same snapshot.
export async function readObjectRollupInTransaction(pool: Pool, scope: MeasurementScope, raw: RollupQuery, client: PoolClient): Promise<ObjectRollupResult | null> {
  const query = normalizeRollupQuery(raw), workspaceId = scope.workspaceId;
  const row = (await client.query(`SELECT *,config_sha256=encode(sha256(convert_to(config::text,'UTF8')),'hex') AS valid
    FROM bsmoss_integration.object_rollup_revision WHERE workspace_id=$1 AND id=$2 ORDER BY revision DESC LIMIT 1`, [workspaceId, query.rollupId])).rows[0];
  if (!row) return null;
  if (!row.valid) throw Error("invalid_rollup_evidence");
  const { config, sha256 } = normalizeRollupConfig(row.config);
  if (config.status !== "active") throw Error("rollup_paused");
  aggregateObjectRollup(config, query.grain, query.at, config.members.map(m => ({ memberId: m.id, currentAuthorityVersion: null, publication: null, unavailable: true })));
  const { attribution, absent } = await topology(client, scope, config, query), observations: RollupObservation[] = [];
  const requiredMetrics = new Set([refKey(config.metric)]), metric = FIRST_METRICS.get(config.metric)!;
  if (metric.semantic === "derived") metric.dependencies.forEach(m => requiredMetrics.add(refKey(m)));
  for (const member of config.members) {
    if (absent.has(member.id)) { observations.push({ memberId: member.id, currentAuthorityVersion: null, publication: null, unavailable: true }); continue; }
    try {
      const { snapshot, publication } = await readAggregateQueryInTransaction(pool, scope, {
        sourceId: member.sourceId, mappingId: member.mappingId, metric: config.metric, grain: query.grain, at: query.at }, client);
      if (metric.object === "device" ? snapshot.kind !== metric.semantic : snapshot.kind !== "interval") throw Error("unsupported_rollup_metric");
      if (snapshot.kind === "gauge" && (config.basis?.kind !== "device_mean_bins" || snapshot.plan.policy.mode !== config.basis.mode || snapshot.plan.policy.scale !== config.basis.scale)) throw Error("rollup_gauge_basis_mismatch");
      if (snapshot.kind === "interval" && snapshot.plan.inputMode === "dependencies") metric.dependencies.forEach(m => requiredMetrics.add(refKey(m)));
      if (config.basis && config.basis.kind !== "device_mean_bins") {
        const capability = (await client.query(`SELECT rules FROM bsmoss_integration.source_capability
          WHERE workspace_id=$1 AND source_id=$2 AND metric_code=$3 AND metric_version=$4 AND status='active'
          AND valid_from<=$5 AND valid_to>=$6`, [workspaceId, member.sourceId, config.metric.code, config.metric.version, snapshot.plan.period.start, snapshot.plan.period.end])).rows;
        const basis = capability[0]?.rules?.intervalAggregation?.objectBasis;
        if (capability.length !== 1 || !basis || basis.kind !== config.basis.kind || basis.ref !== config.basis.ref ||
            Object.keys(basis).some(k => !["kind", "ref"].includes(k))) throw Error("rollup_ratio_basis_mismatch");
      }
      observations.push({ memberId: member.id, currentAuthorityVersion: snapshot.plan.authorityVersion, publication, unavailable: false });
    } catch (error) {
      if (!(error instanceof Error) || !unavailable.has(error.message)) throw error;
      observations.push({ memberId: member.id, currentAuthorityVersion: null, publication: null, unavailable: true });
    }
  }
  const result = aggregateObjectRollup(config, query.grain, query.at, observations);
  const { fingerprint: calculationFingerprint, ...calculation } = result;
  const response = { ...calculation, calculationFingerprint, workspaceId, rollupId: query.rollupId, configRevision: row.revision,
    configSha256: row.config_sha256, semanticSha256: sha256, reviewRef: row.review_ref, attribution,
    requiredMetricKeys: [...requiredMetrics].sort(),
    applicableServiceCount: new Set(attribution.flatMap(a => a.serviceApplicable && a.serviceId !== null ? [a.serviceId] : [])).size };
  return { ...response, fingerprint: fingerprintOf(response) };
}

export class PgObjectRollupReader implements ObjectRollupReader {
  readonly workspaceId: string;
  private readonly scope: MeasurementScope;
  constructor(private readonly pool: Pool, scope: MeasurementScope) {
    this.scope = structuredClone(scope); this.workspaceId = scope.workspaceId; jobIdentity(this.workspaceId);
    for (const list of [scope.sourceIds, scope.stationIds, scope.metricKeys, scope.serviceIds, scope.deviceIds]) {
      if (!Array.isArray(list) || list.length > 10000) throw Error("invalid_aggregate_scope"); list.forEach(jobIdentity);
    }
    if (typeof scope.allowSiteParameters !== "boolean") throw Error("invalid_aggregate_scope");
  }
  async read(raw: RollupQuery): Promise<ObjectRollupResult | null> {
    const query = normalizeRollupQuery(raw), client = await this.pool.connect(); let discard = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await readObjectRollupInTransaction(this.pool, this.scope, query, client);
      await client.query("COMMIT");
      return result;
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
}
