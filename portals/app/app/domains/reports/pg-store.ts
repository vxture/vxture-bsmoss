import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey } from "../catalog/registry.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { bucketFor, nativeWindows } from "../aggregation/periods.ts";
import { mappedSubject } from "../aggregation/subjects.ts";
import { readAggregateQueryInTransaction } from "../aggregation/pg-query.ts";
import { readObjectRollupInTransaction } from "../aggregation/pg-object-rollup.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { assertReportScope, normalizeGenerateReport, normalizeReportQuery, normalizeReportTemplate,
  reportManifest, reportScope, unionReportScopes, validateReportManifest, type GenerateReport, type ReportQuery, type ReportObservation, type ReportTemplate, type ReportManifest } from "./rules.ts";
import type { ReportStore, StoredReport, RevalidateReport } from "./store.ts";

const unavailable = new Set(["aggregate_mapping_unavailable", "aggregate_capability_unavailable_or_ambiguous", "aggregate_capability_boundary", "aggregate_policy_required",
  "aggregate_mapping_gap", "aggregate_subject_mapping_ambiguous", "unaligned_mapping_boundary", "unaligned_service_boundary", "aggregate_dependency_policy_required",
  "mixed_native_grain", "unsupported_native_grain", "state_policy_required", "gauge_policy_required", "gauge_duration_required",
  "rollup_paused", "rollup_atom_unavailable", "rollup_ratio_basis_mismatch", "rollup_mapping_coverage_mismatch"]);

async function unavailableAggregateScope(client: PoolClient, scope: MeasurementScope, query: import("../aggregation/query.ts").AggregateQuery) {
  const def = FIRST_METRICS.get(query.metric)!;
  if (!scope.sourceIds.includes(query.sourceId) || !scope.metricKeys.includes(refKey(query.metric))) throw Error("report_scope_denied");
  const m = (await client.query(`SELECT m.*,n.kind FROM bsmoss_integration.source_mapping m LEFT JOIN bsmoss_resource.network_object n
    ON n.workspace_id=m.workspace_id AND n.id=m.network_object_id WHERE m.workspace_id=$1 AND m.id=$2 AND m.source_id=$3`, [scope.workspaceId, query.mappingId, query.sourceId])).rows[0];
  // Without a current stable locator, generation must wait for reviewed repair;
  // it cannot guess historical ownership or bypass the full scope check.
  if (!m) throw Error("aggregate_mapping_unavailable");
  if (!scope.stationIds.includes(m.station_id) || m.service_id && !scope.serviceIds.includes(m.service_id) || m.device_id && !scope.deviceIds.includes(m.device_id) ||
      !m.service_id && !m.device_id && !scope.allowSiteParameters) throw Error("report_scope_denied");
  if (def.attribution === "service_required" && (!m.service_id || !m.network_object_id) || def.object === "cell" && m.kind !== "cell" ||
      def.object === "station_meter" && (m.service_id || m.network_object_id || m.device_id) || def.object === "device" && (!m.device_id || m.service_id || m.network_object_id)) throw Error("mapping_object_mismatch");
  return reportScope({ workspaceId: scope.workspaceId, sourceIds: [query.sourceId], stationIds: [m.station_id], serviceIds: m.service_id ? [m.service_id] : [],
    deviceIds: m.device_id ? [m.device_id] : [], metricKeys: [refKey(query.metric), ...(def.semantic === "derived" ? def.dependencies.map(refKey) : [])], allowSiteParameters: !m.service_id && !m.device_id });
}

async function observe(pool: Pool, client: PoolClient, scope: MeasurementScope, rawTemplate: ReportTemplate, at: string): Promise<ReportObservation[]> {
  const template = normalizeReportTemplate(rawTemplate), period = bucketFor(at, template.grain), observations: ReportObservation[] = [];
  for (const panel of template.panels) {
    const binding = template.bindings.find(b => b.panelId === panel.id)!;
    if (!scope.metricKeys.includes(refKey(panel.metricRef))) throw Error("report_scope_denied");
    let observation: ReportObservation;
    if (binding.kind === "not_connected") {
      observation = { panelId: panel.id, data: { kind: "not_connected" }, dailyDependencies: [], requiredScope: reportScope({ workspaceId: scope.workspaceId,
        sourceIds: [], stationIds: [], serviceIds: [], deviceIds: [], metricKeys: [refKey(panel.metricRef)], allowSiteParameters: false }) };
    } else if (binding.kind === "aggregate") {
      const query = { sourceId: binding.sourceId, mappingId: binding.mappingId, metric: panel.metricRef, grain: template.grain, at: period.start };
      let read;
      try { read = await readAggregateQueryInTransaction(pool, scope, query, client); }
      catch (error) {
        if (!(error instanceof Error) || !unavailable.has(error.message) || error.message === "aggregate_mapping_unavailable") throw error;
      }
      if (!read) {
        observation = { panelId: panel.id, data: { kind: "aggregate", query, authorityVersion: null, publication: null },
          requiredScope: await unavailableAggregateScope(client, scope, query), dailyDependencies: [] };
      } else {
        const { snapshot, publication } = read, plan = snapshot.plan;
        const ids = JSON.parse(plan.subjectKey);
        if (!Array.isArray(ids) || ids.length !== 5 || ids[0] !== "mapped-object-v1" || mappedSubject(ids[1], ids[2], ids[3], ids[4]) !== plan.subjectKey) throw Error("invalid_report_subject");
        const metricKeys = [refKey(panel.metricRef)];
        if (snapshot.kind === "interval" && snapshot.plan.inputMode === "dependencies") metricKeys.push(...FIRST_METRICS.get(panel.metricRef)!.dependencies.map(refKey));
        observation = { panelId: panel.id, data: { kind: "aggregate", query, authorityVersion: plan.authorityVersion, publication }, dailyDependencies: [],
          requiredScope: reportScope({ workspaceId: scope.workspaceId, sourceIds: [plan.sourceId], stationIds: [ids[1]], serviceIds: ids[2] === null ? [] : [ids[2]],
            deviceIds: ids[4] === null ? [] : [ids[4]], metricKeys, allowSiteParameters: ids[2] === null && ids[4] === null }) };
      }
    } else {
      const query = { rollupId: binding.rollupId, grain: template.grain, at: period.start }, result = await readObjectRollupInTransaction(pool, scope, query, client);
      if (!result) throw Error("report_rollup_unavailable");
      observation = { panelId: panel.id, data: { kind: "rollup", query, result }, dailyDependencies: [], requiredScope: reportScope({ workspaceId: scope.workspaceId,
        sourceIds: result.members.map(m => m.sourceId), stationIds: result.attribution.map(a => a.stationId),
        serviceIds: result.attribution.flatMap(a => a.serviceId === null ? [] : [a.serviceId]), deviceIds: [], metricKeys: result.requiredMetricKeys,
        allowSiteParameters: FIRST_METRICS.get(result.metric)!.attribution === "physical_object" }) };
    }
    if (template.grain !== "day" && binding.kind !== "not_connected") {
      const daily = [];
      for (const day of nativeWindows(period, "day")) daily.push((await observe(pool, client, scope, { ...template, grain: "day", panels: [{ ...panel, grain: "day" }], bindings: [binding] }, day.start))[0]!);
      observation.dailyDependencies = daily.map(d => d.data);
      observation.requiredScope = unionReportScopes(scope.workspaceId, [observation.requiredScope, ...daily.map(d => d.requiredScope)]);
    }
    assertReportScope(scope, observation.requiredScope); observations.push(observation);
  }
  return observations;
}

function recordOf(row: Record<string, any>, scope: MeasurementScope): StoredReport {
  const manifest = validateReportManifest(row.manifest as ReportManifest);
  if (fingerprintOf(manifest) !== row.manifest_sha256 || manifest.workspaceId !== scope.workspaceId || manifest.template.code !== row.template_code ||
      String(manifest.template.version) !== row.template_version || manifest.grain !== row.grain || manifest.period.start !== row.period_start.toISOString() ||
      manifest.period.end !== row.period_end.toISOString()) throw Error("invalid_report_record");
  assertReportScope(scope, manifest.requiredScope); positiveRevision(row.revision); positiveRevision(row.current_revision);
  return { reportId: row.report_id, revision: row.revision, currentRevision: row.current_revision, manifest, manifestSha256: row.manifest_sha256,
    generatedBy: row.generated_by, generatedAt: row.generated_at.toISOString() };
}

export class PgReportStore implements ReportStore {
  readonly workspaceId: string;
  private readonly scope: MeasurementScope;
  constructor(private readonly pool: Pool, scope: MeasurementScope) { this.scope = reportScope(scope); this.workspaceId = this.scope.workspaceId; }
  async generate(raw: GenerateReport, actor: string, revalidate: RevalidateReport) {
    const query = normalizeGenerateReport(raw); jobIdentity(actor);
    const client = await this.pool.connect(); let discard = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      const template = (await client.query(`SELECT definition FROM bsmoss_views.template_version
        WHERE workspace_id=$1 AND code=$2 AND version=$3 AND template_kind='report'`, [this.workspaceId, query.templateCode, query.templateVersion])).rows[0];
      if (!template) throw Error("report_template_unavailable");
      const observations = await observe(this.pool, client, this.scope, template.definition, query.at);
      const manifest = reportManifest(this.workspaceId, query.templateCode, query.templateVersion, template.definition, query.at, observations);
      assertReportScope(this.scope, manifest.requiredScope);
      const sha256 = fingerprintOf(manifest), args = [this.workspaceId, query.templateCode, query.templateVersion, manifest.grain, manifest.period.start, manifest.period.end];
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify(["bsmoss-report", ...args])]);
      await client.query(`INSERT INTO bsmoss_analysis.report_series(workspace_id,template_code,template_version,grain,period_start,period_end,id)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,template_code,template_version,grain,period_start,period_end) DO NOTHING`, [...args, randomUUID()]);
      const head = (await client.query(`SELECT * FROM bsmoss_analysis.report_series WHERE workspace_id=$1 AND template_code=$2 AND template_version=$3
        AND grain=$4 AND period_start=$5 AND period_end=$6 FOR UPDATE`, args)).rows[0];
      const duplicate = (await client.query(`SELECT *,manifest=$4::jsonb AS same FROM bsmoss_analysis.report_revision
        WHERE workspace_id=$1 AND report_id=$2 AND manifest_sha256=$3`, [this.workspaceId, head.id, sha256, JSON.stringify(manifest)])).rows[0];
      let row, status: "inserted" | "duplicate";
      if (duplicate) {
        if (!duplicate.same) throw Error("conflicting_report_replay");
        row = duplicate; status = "duplicate";
      } else {
        if (head.current_revision !== query.expectedRevision) throw Error("report_revision_conflict");
        const revision = (BigInt(head.current_revision ?? "0") + 1n).toString(); positiveRevision(revision);
        row = (await client.query(`INSERT INTO bsmoss_analysis.report_revision(workspace_id,report_id,revision,manifest_sha256,manifest,generated_by)
          VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [this.workspaceId, head.id, revision, sha256, JSON.stringify(manifest), actor])).rows[0];
        await client.query("UPDATE bsmoss_analysis.report_series SET current_revision=$3 WHERE workspace_id=$1 AND id=$2", [this.workspaceId, head.id, revision]);
        await client.query(`INSERT INTO bsmoss_analysis.report_outbox(workspace_id,id,report_id,revision,event_type) VALUES($1,$2,$3,$4,'report.generated')`, [this.workspaceId, randomUUID(), head.id, revision]);
        head.current_revision = revision; status = "inserted";
      }
      const record = recordOf({ ...head, ...row, current_revision: head.current_revision }, this.scope);
      await revalidate(record.manifest.requiredScope);
      await client.query("COMMIT"); return { status, record };
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
  async read(raw: ReportQuery, revalidate: RevalidateReport) {
    const query = normalizeReportQuery(raw), client = await this.pool.connect(); let discard = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const row = (await client.query(`SELECT s.*,r.* FROM bsmoss_analysis.report_series s JOIN bsmoss_analysis.report_revision r
        ON (r.workspace_id,r.report_id)=(s.workspace_id,s.id) AND r.revision=coalesce($3::numeric,s.current_revision)
        WHERE s.workspace_id=$1 AND s.id=$2`, [this.workspaceId, query.reportId, query.revision ?? null])).rows[0];
      if (!row) { await revalidate(reportScope({ ...this.scope, sourceIds: [], stationIds: [], serviceIds: [], deviceIds: [], metricKeys: [], allowSiteParameters: false })); await client.query("COMMIT"); return null; }
      const record = recordOf(row, this.scope), m = record.manifest, reasons: string[] = [];
      if (record.revision !== record.currentRevision) reasons.push("older_generated_revision");
      if (m.capturedFreshness === "stale") reasons.push("captured_stale_publication");
      const template = (await client.query(`SELECT definition,template_kind FROM bsmoss_views.template_version WHERE workspace_id=$1 AND code=$2 AND version=$3`, [this.workspaceId, m.template.code, m.template.version])).rows[0];
      if (!template || template.template_kind !== "report" || fingerprintOf(template.definition) !== m.template.definitionSha256) reasons.push("template_definition_changed");
      for (const item of m.items) {
        if (item.data.kind === "not_connected") continue;
        if (item.data.kind === "rollup") {
          // A newer config can cover objects this historical reader does not
          // own. Compare its pointer first, never read its new member payload.
          const head = (await client.query(`SELECT revision,config_sha256 FROM bsmoss_integration.object_rollup_revision WHERE workspace_id=$1 AND id=$2 ORDER BY revision DESC LIMIT 1`, [this.workspaceId, item.data.query.rollupId])).rows[0];
          if (!head || head.revision !== item.data.result.configRevision || head.config_sha256 !== item.data.result.configSha256) { reasons.push(item.panel.id + ":rollup_configuration_changed"); continue; }
        }
        try {
          const current = (await observe(this.pool, client, this.scope, { ...m.template.definition, panels: [item.panel], bindings: [item.binding] }, m.period.start))[0]!;
          if (current.data.kind === "aggregate" && current.data.authorityVersion === null && item.data.kind === "aggregate" && item.data.authorityVersion !== null) { reasons.push(item.panel.id + ":authority_unavailable"); continue; }
          const currentItem = reportManifest(this.workspaceId, m.template.code, m.template.version, { ...m.template.definition, panels: [item.panel], bindings: [item.binding] }, m.period.start, [current]).items[0]!;
          if (currentItem.dependencyFingerprint !== item.dependencyFingerprint) reasons.push(item.panel.id + ":input_or_publication_changed");
        } catch (error) {
          if (!(error instanceof Error) || !unavailable.has(error.message)) throw error;
          reasons.push(item.panel.id + ":authority_unavailable");
        }
      }
      await revalidate(m.requiredScope); await client.query("COMMIT");
      return { ...record, freshness: reasons.length ? "stale" as const : "current" as const, reasons: [...new Set(reasons)].sort() };
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
}
