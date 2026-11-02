import type { Pool, PoolClient } from "pg";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey } from "../catalog/registry.ts";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { normalizeRollupConfig } from "../aggregation/object-rollup.ts";
import { readAggregateQueryInTransaction } from "../aggregation/pg-query.ts";
import { readObjectRollupInTransaction } from "../aggregation/pg-object-rollup.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { fields, reportScope, assertReportScope, unionReportScopes, type ReportBinding } from "../reports/rules.ts";
import type { RevalidateReport } from "../reports/store.ts";
import { analysisTemplate, analysisQuery, saveAnalysisPreference, applyAnalysisPreferences, analysisWindows, analysisMetricKeys,
  type AnalysisQuery, type AnalysisTemplate, type SaveAnalysisPreference, type AnalysisPanel, type AnalysisPoint, type AnalysisWorkspace } from "./analysis.ts";
import type { Panel } from "./resolve.ts";
import type { AnalysisStore } from "./analysis-store.ts";

interface Template { code: string; version: number; sha256: string; definition: AnalysisTemplate }
interface StoredPreference { schema: "analysis-preference-v1"; command: SaveAnalysisPreference; requiredScope: MeasurementScope }
const unavailable = new Set(["aggregate_capability_unavailable_or_ambiguous", "aggregate_capability_boundary", "aggregate_policy_required", "aggregate_mapping_gap",
  "aggregate_subject_mapping_ambiguous", "unaligned_mapping_boundary", "unaligned_service_boundary", "aggregate_dependency_policy_required", "mixed_native_grain",
  "unsupported_native_grain", "state_policy_required", "gauge_policy_required", "gauge_duration_required", "rollup_paused", "rollup_atom_unavailable",
  "rollup_ratio_basis_mismatch", "rollup_mapping_coverage_mismatch"]);
const denied = new Set(["report_scope_denied", "aggregate_scope_denied", "aggregate_dependency_scope_denied", "object_scope_denied", "rollup_scope_denied"]);

export class PgAnalysisStore implements AnalysisStore {
  readonly workspaceId: string; private readonly scope: MeasurementScope;
  constructor(private readonly pool: Pool, scope: MeasurementScope, private readonly subject: string) {
    this.scope = reportScope(scope); this.workspaceId = scope.workspaceId; jobIdentity(subject);
  }
  private emptyScope() { return reportScope({ ...this.scope, sourceIds: [], stationIds: [], serviceIds: [], deviceIds: [], metricKeys: [], allowSiteParameters: false }); }
  private async transaction<T>(readOnly: boolean, work: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect(); let discard = false;
    try { await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ" + (readOnly ? " READ ONLY" : "")); const result = await work(client); await client.query("COMMIT"); return result; }
    catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; } finally { client.release(discard); }
  }
  private async template(client: PoolClient, lock = false): Promise<Template | null> {
    const row = (await client.query(`SELECT t.* FROM bsmoss_views.template_selection s JOIN bsmoss_views.template_version t
      ON (t.workspace_id,t.code,t.version)=(s.workspace_id,s.template_code,s.template_version)
      WHERE s.workspace_id=$1 AND s.scope_key='analysis:default'${lock ? " FOR SHARE OF s" : ""}`, [this.workspaceId])).rows[0];
    if (!row) return null;
    if (row.template_kind !== "page" || !Number.isSafeInteger(Number(row.version))) throw Error("invalid_analysis_template");
    return { code: row.code, version: Number(row.version), sha256: fingerprintOf(row.definition), definition: analysisTemplate(row.definition) };
  }
  private preference(row: Record<string, any>): StoredPreference {
    const d = row.definition as StoredPreference; fields(d, ["schema", "command", "requiredScope"]);
    const c = saveAnalysisPreference(d.command); positiveRevision(row.revision);
    if (d.schema !== "analysis-preference-v1" || !row.valid || fingerprintOf(d) !== row.definition_sha256 || row.workspace_id !== this.workspaceId ||
      row.subject !== this.subject || !row.recorded_by || c.templateCode !== row.template_code || String(c.templateVersion) !== row.template_version ||
      fingerprintOf(c) !== fingerprintOf(d.command) || BigInt(row.revision) !== BigInt(c.expectedRevision ?? "0") + 1n) throw Error("invalid_analysis_preference_evidence");
    const requiredScope = reportScope(d.requiredScope); if (requiredScope.workspaceId !== this.workspaceId) throw Error("invalid_analysis_preference_evidence");
    return { ...d, command: c, requiredScope };
  }
  private async latest(client: PoolClient, t: Pick<Template, "code" | "version">) {
    return (await client.query(`SELECT *,database_sha256=encode(sha256(convert_to(definition::text,'UTF8')),'hex') AS valid FROM bsmoss_views.user_preference
      WHERE workspace_id=$1 AND subject=$2 AND template_code=$3 AND template_version=$4 ORDER BY revision DESC LIMIT 1`, [this.workspaceId, this.subject, t.code, t.version])).rows[0] ?? null;
  }
  // Prove finite object authority before returning even a hidden panel's binding.
  private async locator(client: PoolClient, panel: Panel, binding: ReportBinding): Promise<MeasurementScope | null> {
    let required = reportScope({ ...this.emptyScope(), metricKeys: analysisMetricKeys(panel) });
    assertReportScope(this.scope, required);
    if (binding.kind === "aggregate") {
      if (!this.scope.sourceIds.includes(binding.sourceId)) throw Error("report_scope_denied");
      const m = (await client.query(`SELECT * FROM bsmoss_integration.source_mapping WHERE workspace_id=$1 AND id=$2 AND source_id=$3`, [this.workspaceId, binding.mappingId, binding.sourceId])).rows[0];
      if (!m) return null;
      required = reportScope({ ...required, sourceIds: [binding.sourceId], stationIds: [m.station_id], serviceIds: m.service_id ? [m.service_id] : [],
        deviceIds: m.device_id ? [m.device_id] : [], allowSiteParameters: !m.service_id && !m.device_id });
    } else if (binding.kind === "rollup") {
      const row = (await client.query(`SELECT *,config_sha256=encode(sha256(convert_to(config::text,'UTF8')),'hex') AS valid
        FROM bsmoss_integration.object_rollup_revision WHERE workspace_id=$1 AND id=$2 ORDER BY revision DESC LIMIT 1`, [this.workspaceId, binding.rollupId])).rows[0];
      if (!row) return null; if (!row.valid) throw Error("invalid_rollup_evidence");
      const c = normalizeRollupConfig(row.config).config, def = FIRST_METRICS.get(panel.metricRef)!;
      if (refKey(c.metric) !== refKey(panel.metricRef)) throw Error("invalid_analysis_binding");
      required = reportScope({ ...required, sourceIds: c.members.map(m => m.sourceId), stationIds: c.atoms.map(a => a.stationId),
        serviceIds: c.atoms.flatMap(a => a.serviceId ? [a.serviceId] : []), deviceIds: c.atoms.flatMap(a => a.deviceId ? [a.deviceId] : []),
        metricKeys: analysisMetricKeys(panel), allowSiteParameters: def.object === "station_meter" });
      assertReportScope(this.scope, required);
      for (const member of c.members) {
        const mapped = await this.locator(client, panel, { panelId: panel.id, kind: "aggregate", sourceId: member.sourceId, mappingId: member.mappingId });
        if (mapped) required = unionReportScopes(this.workspaceId, [required, mapped]);
      }
    }
    assertReportScope(this.scope, required); return required;
  }
  private async point(client: PoolClient, panel: Panel, binding: ReportBinding, at: string, required: MeasurementScope): Promise<{ point: AnalysisPoint; required: MeasurementScope }> {
    const period = analysisWindows({ ...panel, view: "card" }, at)[0]!;
    if (binding.kind === "not_connected") return { required, point: { period, status: "not_connected", data: { kind: "not_connected" }, freshness: "unavailable", reasons: [] } };
    try {
      if (binding.kind === "aggregate") {
        const query = { sourceId: binding.sourceId, mappingId: binding.mappingId, metric: panel.metricRef, grain: panel.grain, at: period.start },
          { snapshot, publication } = await readAggregateQueryInTransaction(this.pool, this.scope, query, client), def = FIRST_METRICS.get(panel.metricRef)!;
        const metricKeys = [refKey(panel.metricRef), ...(snapshot.kind === "interval" && snapshot.plan.inputMode === "dependencies" ? def.dependencies.map(refKey) : [])];
        required = unionReportScopes(this.workspaceId, [required, { ...required, metricKeys }]);
        return { required, point: { period, status: publication?.result.completeness ?? "not_published", data: { kind: "aggregate", query, authorityVersion: snapshot.plan.authorityVersion, publication },
          freshness: publication?.freshness ?? "unavailable", reasons: publication?.reasons ?? [] } };
      }
      const query = { rollupId: binding.rollupId, grain: panel.grain, at: period.start }, result = await readObjectRollupInTransaction(this.pool, this.scope, query, client);
      if (!result) throw Error("invalid_analysis_binding");
      required = unionReportScopes(this.workspaceId, [required, { ...required, metricKeys: result.requiredMetricKeys }]);
      return { required, point: { period, status: result.completeness, data: { kind: "rollup", query, result }, freshness: result.freshness === "stale" ? "stale" : "current", reasons: result.freshness === "stale" ? ["member_input_or_authority_changed"] : [] } };
    } catch (error) {
      if (!(error instanceof Error) || !unavailable.has(error.message)) throw error;
      return { required, point: { period, status: "authority_unavailable", data: null, freshness: "unavailable", reasons: ["authority_unavailable"] } };
    }
  }
  private async panels(client: PoolClient, template: Template, panels: readonly Panel[], at: string, includePoints: boolean) {
    const entries: AnalysisPanel[] = [], scopes: MeasurementScope[] = [];
    for (const panel of panels) {
      const binding = template.definition.bindings.find(b => b.panelId === panel.id)!;
      try {
        let required = await this.locator(client, panel, binding); if (!required) continue;
        const points: AnalysisPoint[] = [], windows = analysisWindows(includePoints && panel.visible ? panel : { ...panel, view: "card" }, at);
        if (includePoints && panel.visible) for (const window of windows) { const read = await this.point(client, panel, binding, window.start, required); required = unionReportScopes(this.workspaceId, [required, read.required]); points.push(read.point); }
        assertReportScope(this.scope, required); scopes.push(required); const metric = FIRST_METRICS.get(panel.metricRef)!;
        entries.push({ panel, binding, options: { grains: metric.grains, units: metric.displayUnits }, points });
      } catch (error) { if (!(error instanceof Error) || !denied.has(error.message)) throw error; }
    }
    return { entries, required: unionReportScopes(this.workspaceId, scopes) };
  }
  async read(raw: AnalysisQuery, revalidate: RevalidateReport): Promise<AnalysisWorkspace> {
    const q = analysisQuery(raw);
    return this.transaction(true, async client => {
      const t = await this.template(client);
      if (!t) { await revalidate(this.emptyScope()); return { template: null, preferenceRevision: null, at: q.at, panels: [] }; }
      const saved = await this.latest(client, t), preference = saved ? this.preference(saved) : null;
      if (preference && preference.command.templateSha256 !== t.sha256) throw Error("analysis_template_changed");
      const configured = applyAnalysisPreferences(t.definition, preference?.command.preferences ?? []), result = await this.panels(client, t, configured, q.at, true);
      await revalidate(result.required);
      return { template: { code: t.code, version: t.version, sha256: t.sha256, title: t.definition.title }, preferenceRevision: saved?.revision ?? null, at: q.at, panels: result.entries };
    });
  }
  async save(raw: SaveAnalysisPreference, revalidate: RevalidateReport): Promise<import("./analysis-store.ts").AnalysisPreferenceReceipt> {
    // RR snapshots can precede a competing writer's advisory lock release.
    // Retry with a fresh snapshot so identical commands replay their receipt.
    for (let attempt = 0; ; attempt++) {
      try { return await this.saveOnce(raw, revalidate); }
      catch (error) { if (attempt >= 2 || !error || typeof error !== "object" || !("code" in error) || !["40001", "40P01", "23505"].includes(String(error.code))) throw error; }
    }
  }
  private async saveOnce(raw: SaveAnalysisPreference, revalidate: RevalidateReport) {
    const c = saveAnalysisPreference(raw);
    return this.transaction(false, async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify(["bsmoss-analysis-preference", this.workspaceId, this.subject, c.templateCode, c.templateVersion])]);
      const prior = (await client.query(`SELECT *,database_sha256=encode(sha256(convert_to(definition::text,'UTF8')),'hex') AS valid FROM bsmoss_views.user_preference
        WHERE workspace_id=$1 AND subject=$2 AND template_code=$3 AND template_version=$4 AND definition->'command'->>'commandId'=$5`, [this.workspaceId, this.subject, c.templateCode, c.templateVersion, c.commandId])).rows[0];
      const current = await this.latest(client, { code: c.templateCode, version: c.templateVersion }); if (current) this.preference(current);
      if (prior) {
        const saved = this.preference(prior); if (fingerprintOf(saved.command) !== fingerprintOf(c)) throw Error("analysis_preference_conflict");
        assertReportScope(this.scope, saved.requiredScope); await revalidate(saved.requiredScope);
        return { status: "duplicate" as const, revision: prior.revision as string, currentRevision: current.revision as string, commandId: c.commandId };
      }
      const t = await this.template(client, true);
      if (!t || t.code !== c.templateCode || t.version !== c.templateVersion || t.sha256 !== c.templateSha256) throw Error("analysis_template_changed");
      if ((current?.revision ?? null) !== c.expectedRevision) throw Error("analysis_preference_conflict");
      let configured: Panel[];
      try { configured = applyAnalysisPreferences(t.definition, c.preferences); } catch { throw Error("invalid_analysis_preferences"); }
      const permitted = await this.panels(client, t, configured, new Date().toISOString(), false);
      if (c.preferences.some(p => !permitted.entries.some(e => e.panel.id === p.id))) throw Error("report_scope_denied");
      const definition: StoredPreference = { schema: "analysis-preference-v1", command: c, requiredScope: permitted.required }, revision = (BigInt(current?.revision ?? "0") + 1n).toString(); positiveRevision(revision);
      await client.query(`INSERT INTO bsmoss_views.user_preference(workspace_id,subject,template_code,template_version,revision,definition,definition_sha256)
        VALUES($1,$2,$3,$4,$5,$6,$7)`, [this.workspaceId, this.subject, t.code, t.version, revision, definition, fingerprintOf(definition)]);
      const stored = await this.latest(client, t); if (!stored || stored.revision !== revision || fingerprintOf(this.preference(stored)) !== fingerprintOf(definition)) throw Error("invalid_analysis_preference_evidence");
      await revalidate(permitted.required); return { status: "inserted" as const, revision, currentRevision: revision, commandId: c.commandId };
    });
  }
}
