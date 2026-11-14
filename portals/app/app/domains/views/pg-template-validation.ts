import type { PoolClient } from "pg";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey } from "../catalog/registry.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { normalizeRollupConfig } from "../aggregation/object-rollup.ts";
import { validateRollupTopology } from "../aggregation/pg-object-rollup.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { assertReportScope, reportScope, unionReportScopes } from "../reports/rules.ts";
import { analysisMetricKeys } from "./analysis.ts";
import { templateCandidate, type TemplateCandidate, type TemplatePreview } from "./templates.ts";

// Configuration validation only: no fact, aggregate publication or measurement
// table is read. It proves finite ownership, not source quality or availability.
export async function validateTemplateBindings(client: PoolClient, scope: MeasurementScope, raw: TemplateCandidate): Promise<TemplatePreview> {
  const candidate = templateCandidate(raw), workspaceId = scope.workspaceId, scopes: MeasurementScope[] = [], references: TemplatePreview["references"][number][] = [];
  const empty = reportScope({ workspaceId, sourceIds: [], stationIds: [], serviceIds: [], deviceIds: [], metricKeys: [], allowSiteParameters: false });
  async function mapping(sourceId: string, id: string, metric: import("../catalog/registry.ts").MetricRef) {
    if (!scope.sourceIds.includes(sourceId)) throw Error("report_scope_denied");
    const m = (await client.query(`SELECT m.*,row_to_json(m) AS evidence,n.kind,n.station_id AS network_station,n.service_id AS network_service,
      s.station_id AS service_station,s.operator_entity_id,s.valid_from AS service_from,s.valid_to AS service_to,d.station_id AS device_station
      FROM bsmoss_integration.source_mapping m
      LEFT JOIN bsmoss_resource.network_object n ON n.workspace_id=m.workspace_id AND n.id=m.network_object_id
      LEFT JOIN bsmoss_resource.station_service s ON s.workspace_id=m.workspace_id AND s.id=m.service_id
      LEFT JOIN bsmoss_resource.device d ON d.workspace_id=m.workspace_id AND d.id=m.device_id
      WHERE m.workspace_id=$1 AND m.id=$2 AND m.source_id=$3`, [workspaceId, id, sourceId])).rows[0];
    if (!m) throw Error("template_binding_unavailable");
    const def = FIRST_METRICS.get(metric)!;
    const required = reportScope({ ...empty, sourceIds: [sourceId], stationIds: [m.station_id], serviceIds: m.service_id ? [m.service_id] : [],
      deviceIds: m.device_id ? [m.device_id] : [], metricKeys: [refKey(metric), ...(def.semantic === "derived" ? def.dependencies.map(refKey) : [])], allowSiteParameters: def.object === "station_meter" });
    assertReportScope(scope, required);
    if (m.service_id && m.service_station !== m.station_id || m.network_object_id && (m.network_station !== m.station_id || m.network_service !== m.service_id) ||
        m.device_id && m.device_station !== m.station_id || def.attribution === "service_required" && (!m.service_id || !m.network_object_id || m.device_id) ||
        def.object === "cell" && m.kind !== "cell" || def.object === "device" && (!m.device_id || m.service_id || m.network_object_id) ||
        def.object === "station_meter" && (m.device_id || m.service_id || m.network_object_id)) throw Error("template_binding_mismatch");
    references.push({ kind: "mapping", id, sha256: fingerprintOf(m) }); scopes.push(required);
  }
  for (const panel of candidate.definition.panels) {
    const required = reportScope({ ...empty, metricKeys: analysisMetricKeys(panel) }); assertReportScope(scope, required); scopes.push(required);
    const binding = candidate.definition.bindings.find(b => b.panelId === panel.id)!;
    if (binding.kind === "aggregate") await mapping(binding.sourceId, binding.mappingId, panel.metricRef);
    if (binding.kind === "rollup") {
      const row = (await client.query(`SELECT *,config_sha256=encode(sha256(convert_to(config::text,'UTF8')),'hex') AS valid
        FROM bsmoss_integration.object_rollup_revision WHERE workspace_id=$1 AND id=$2 ORDER BY revision DESC LIMIT 1`, [workspaceId, binding.rollupId])).rows[0];
      if (!row) throw Error("template_binding_unavailable"); if (!row.valid) throw Error("invalid_rollup_evidence");
      const c = normalizeRollupConfig(row.config).config;
      if (c.status !== "active" || refKey(c.metric) !== refKey(panel.metricRef)) throw Error("template_binding_mismatch");
      const query = { rollupId: binding.rollupId, grain: panel.grain, at: c.validPeriod.start };
      const topology = await validateRollupTopology(client, scope, c, query); if (topology.absent.size) throw Error("template_binding_unavailable");
      scopes.push(reportScope({ ...required, sourceIds: c.members.map(m => m.sourceId), stationIds: c.atoms.map(a => a.stationId),
        serviceIds: c.atoms.flatMap(a => a.serviceId ? [a.serviceId] : []), deviceIds: c.atoms.flatMap(a => a.deviceId ? [a.deviceId] : []),
        allowSiteParameters: FIRST_METRICS.get(c.metric)!.object === "station_meter" }));
      references.push({ kind: "rollup", id: binding.rollupId, sha256: fingerprintOf({ revision: row.revision, config: row.config, reviewRef: row.review_ref }) });
      for (const member of c.members) await mapping(member.sourceId, member.mappingId, panel.metricRef);
    }
  }
  const requiredScope = unionReportScopes(workspaceId, scopes); assertReportScope(scope, requiredScope);
  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  const unique = [...new Map(references.map(r => [JSON.stringify([r.kind, r.id]), r])).values()].sort((a, b) => compare(a.kind, b.kind) || compare(a.id, b.id));
  const evidence = { candidateSha256: fingerprintOf(candidate), requiredScope, references: unique };
  return { ...evidence, validationSha256: fingerprintOf(evidence) };
}
