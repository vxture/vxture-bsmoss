import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { CATEGORIES, refKey, type Grain } from "../catalog/registry.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { bucketFor, instant, nativeWindows } from "../aggregation/periods.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { normalizeAggregateQuery, type AggregateQuery, type AggregateQueryResult } from "../aggregation/query.ts";
import { normalizeRollupQuery, type ObjectRollupResult, type RollupQuery } from "../aggregation/object-rollup.ts";
import { validatePanel, type Panel } from "../views/resolve.ts";

export type ReportGrain = Extract<Grain, "day" | "week" | "month">;
export type ReportBinding = { panelId: string } & ({ kind: "aggregate"; sourceId: string; mappingId: string } | { kind: "rollup"; rollupId: string } | { kind: "not_connected" });
export interface ReportTemplate {
  schema: "periodic-report-template-v1"; title: string; grain: ReportGrain; panels: readonly Panel[]; bindings: readonly ReportBinding[];
}
export interface GenerateReport { templateCode: string; templateVersion: number; at: string; expectedRevision: string | null }
export interface ReportQuery { reportId: string; revision?: string }
export type ReportData = { kind: "aggregate"; query: AggregateQuery; authorityVersion: string | null; publication: AggregateQueryResult | null }
  | { kind: "rollup"; query: RollupQuery; result: ObjectRollupResult }
  | { kind: "not_connected" };
export interface ReportObservation { panelId: string; data: ReportData; dailyDependencies: readonly ReportData[]; requiredScope: MeasurementScope }
const scopeLists = ["sourceIds", "stationIds", "serviceIds", "deviceIds", "metricKeys"] as const;
export function fields(value: unknown, allowed: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) throw Error("invalid_report_fields");
}
export function reportScope(raw: MeasurementScope): MeasurementScope {
  fields(raw, ["workspaceId", ...scopeLists, "allowSiteParameters"]); jobIdentity(raw.workspaceId);
  const s = structuredClone(raw);
  for (const key of scopeLists) {
    const list = s[key]; if (!Array.isArray(list) || list.length > 10000) throw Error("invalid_report_scope"); list.forEach(jobIdentity);
    s[key] = [...new Set(list)].sort();
  }
  if (typeof s.allowSiteParameters !== "boolean") throw Error("invalid_report_scope");
  return s;
}
export function assertReportScope(grant: MeasurementScope, required: MeasurementScope) {
  const s = reportScope(grant), r = reportScope(required);
  if (s.workspaceId !== r.workspaceId || scopeLists.some(k => r[k].some(id => !s[k].includes(id))) || r.allowSiteParameters && !s.allowSiteParameters) throw Error("report_scope_denied");
}
export function unionReportScopes(workspaceId: string, scopes: readonly MeasurementScope[]) {
  scopes.forEach(s => { if (s.workspaceId !== workspaceId) throw Error("workspace_mismatch"); reportScope(s); });
  return reportScope({ workspaceId, sourceIds: scopes.flatMap(s => [...s.sourceIds]), stationIds: scopes.flatMap(s => [...s.stationIds]),
    serviceIds: scopes.flatMap(s => [...s.serviceIds]), deviceIds: scopes.flatMap(s => [...s.deviceIds]), metricKeys: scopes.flatMap(s => [...s.metricKeys]),
    allowSiteParameters: scopes.some(s => s.allowSiteParameters) });
}
export function normalizeReportTemplate(raw: ReportTemplate): ReportTemplate {
  const t = structuredClone(raw); fields(t, ["schema", "title", "grain", "panels", "bindings"]); jobIdentity(t.title);
  if (t.schema !== "periodic-report-template-v1" || !["day", "week", "month"].includes(t.grain) || !Array.isArray(t.panels) ||
      !t.panels.length || t.panels.length > 16 || !Array.isArray(t.bindings) || t.bindings.length !== t.panels.length) throw Error("invalid_report_template");
  const ids = new Set<string>(), bindings = new Set<string>();
  for (const p of t.panels) { validatePanel(p, FIRST_METRICS); jobIdentity(p.id); if (p.grain !== t.grain || ids.has(p.id)) throw Error("invalid_report_panel"); ids.add(p.id); }
  for (const b of t.bindings) {
    fields(b, b.kind === "aggregate" ? ["panelId", "kind", "sourceId", "mappingId"] : b.kind === "rollup" ? ["panelId", "kind", "rollupId"] : ["panelId", "kind"]);
    jobIdentity(b.panelId);
    if (!ids.has(b.panelId) || bindings.has(b.panelId)) throw Error("invalid_report_binding"); bindings.add(b.panelId);
    if (b.kind === "aggregate") { jobIdentity(b.sourceId); jobIdentity(b.mappingId); }
    else if (b.kind === "rollup") jobIdentity(b.rollupId);
    else if (b.kind !== "not_connected") throw Error("invalid_report_binding");
  }
  t.panels = [...t.panels].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  t.bindings = t.panels.map(p => t.bindings.find(b => b.panelId === p.id)!);
  return t;
}
export function normalizeGenerateReport(raw: GenerateReport): GenerateReport {
  fields(raw, ["templateCode", "templateVersion", "at", "expectedRevision"]); jobIdentity(raw.templateCode);
  if (!Number.isSafeInteger(raw.templateVersion) || raw.templateVersion < 1) throw Error("invalid_report_template_version");
  if (raw.expectedRevision !== null) positiveRevision(raw.expectedRevision);
  return { ...raw, at: new Date(instant(raw.at)).toISOString() };
}
export function normalizeReportQuery(raw: ReportQuery): ReportQuery {
  fields(raw, ["reportId", "revision"]); jobIdentity(raw.reportId);
  if (raw.revision !== undefined) positiveRevision(raw.revision);
  return structuredClone(raw);
}
export function dependencyFingerprint(data: ReportData): string {
  if (data.kind === "rollup") return data.result.fingerprint;
  if (data.kind === "not_connected") return fingerprintOf(data);
  const p = data.publication;
  return fingerprintOf({ query: data.query, authorityVersion: data.authorityVersion,
    publication: p ? { seriesId: p.seriesId, revision: p.revision, currentRevision: p.currentRevision,
      inputFingerprint: p.result.inputFingerprint, currentInputFingerprint: p.currentInputFingerprint, freshness: p.freshness, reasons: p.reasons } : null });
}
export function reportManifest(workspaceId: string, code: string, version: number, rawTemplate: ReportTemplate, at: string, raw: readonly ReportObservation[]) {
  jobIdentity(workspaceId); jobIdentity(code);
  if (!Number.isSafeInteger(version) || version < 1) throw Error("invalid_report_template_version");
  const definition = normalizeReportTemplate(rawTemplate), period = bucketFor(at, definition.grain), panels = definition.panels;
  const observations = structuredClone(raw), byId = new Map(observations.map(o => [o.panelId, o]));
  if (byId.size !== observations.length || byId.size !== panels.length || panels.some(p => !byId.has(p.id))) throw Error("report_observation_mismatch");
  const items = panels.map(panel => {
    const o = byId.get(panel.id)!, binding = definition.bindings.find(b => b.panelId === panel.id)!, data = o.data;
    function validate(data: ReportData, grain: Grain, at: string) {
      if (data.kind !== binding.kind) throw Error("report_binding_mismatch");
      const expected = bucketFor(at, grain);
      if (data.kind === "aggregate" && binding.kind === "aggregate") {
        const q = normalizeAggregateQuery(data.query);
        if (q.revision !== undefined || q.sourceId !== binding.sourceId || q.mappingId !== binding.mappingId || refKey(q.metric) !== refKey(panel.metricRef) ||
          q.grain !== grain || q.at !== expected.start) throw Error("report_binding_mismatch");
        if (data.authorityVersion !== null && !/^[a-f0-9]{64}$/.test(data.authorityVersion)) throw Error("invalid_report_authority");
        const p = data.publication;
        if (data.authorityVersion === null && p !== null) throw Error("invalid_report_authority");
        if (p && (p.result.workspaceId !== workspaceId || p.result.sourceId !== q.sourceId || refKey(p.result.metric) !== refKey(q.metric) ||
          p.result.grain !== q.grain || fingerprintOf(p.result.period) !== fingerprintOf(expected))) throw Error("report_data_mismatch");
        return data.authorityVersion === null ? "authority_unavailable" : !p ? "not_published" : p.freshness === "stale" ? "stale" : p.result.completeness;
    } else if (data.kind === "rollup" && binding.kind === "rollup") {
        const q = normalizeRollupQuery(data.query), r = data.result;
        if (q.rollupId !== binding.rollupId || q.at !== expected.start || q.grain !== grain || r.workspaceId !== workspaceId || r.rollupId !== q.rollupId ||
          refKey(r.metric) !== refKey(panel.metricRef) || r.grain !== q.grain || fingerprintOf(r.period) !== fingerprintOf(expected)) throw Error("report_data_mismatch");
        return r.freshness === "stale" ? "stale" : r.completeness;
      } else return "not_connected";
    }
    let status = validate(data, definition.grain, period.start);
    const days = definition.grain === "day" || data.kind === "not_connected" ? [] : nativeWindows(period, "day");
    if (!Array.isArray(o.dailyDependencies) || o.dailyDependencies.length !== days.length) throw Error("report_daily_dependencies_required");
    const dailyDependencies = o.dailyDependencies.map((data, i) => ({ data, status: validate(data, "day", days[i]!.start), dependencyFingerprint: dependencyFingerprint(data) }));
    if (!["authority_unavailable", "not_published"].includes(status) && dailyDependencies.some(d => d.status === "stale")) status = "stale";
    else if (status === "complete" && dailyDependencies.some(d => !["complete", "not_applicable"].includes(d.status))) status = "dependencies_incomplete";
    const requiredScope = reportScope(o.requiredScope);
    if (requiredScope.workspaceId !== workspaceId || !requiredScope.metricKeys.includes(refKey(panel.metricRef))) throw Error("report_scope_denied");
    return { panel, binding, data, dailyDependencies, status, requiredScope,
      dependencyFingerprint: fingerprintOf({ main: dependencyFingerprint(data), daily: dailyDependencies.map(d => d.dependencyFingerprint) }) };
  });
  const requiredScope = unionReportScopes(workspaceId, items.map(i => i.requiredScope));
  const complete = items.every(i => ["complete", "not_applicable"].includes(i.status));
  const active = items.filter(i => i.status !== "not_applicable");
  const watermark = items.some(i => ["stale", "not_connected", "not_published", "authority_unavailable", "dependencies_incomplete"].includes(i.status)) ? period.start : active.map(i =>
    i.data.kind === "aggregate" ? i.data.publication!.result.watermark : i.data.kind === "rollup" ? i.data.result.watermark : period.start).sort()[0] ?? period.end;
  const manifest = { version: "bsmoss-report-snapshot-v1" as const, status: "generated" as const, workspaceId,
    template: { code, version, definition: structuredClone(rawTemplate), definitionSha256: fingerprintOf(rawTemplate) }, grain: definition.grain, period,
    sections: CATEGORIES.map(category => ({ category, status: items.some(i => i.panel.category === category) ? "included" : "not_configured",
      panelIds: items.filter(i => i.panel.category === category).map(i => i.panel.id) })),
    dataCompleteness: complete ? "complete" : "incomplete", capturedFreshness: items.some(i => i.status === "stale" || i.dailyDependencies.some(d => d.status === "stale")) ? "stale" : "current", watermark, requiredScope, items };
  return JSON.parse(JSON.stringify(manifest)) as typeof manifest;
}
export type ReportManifest = ReturnType<typeof reportManifest>;
export function validateReportManifest(raw: ReportManifest): ReportManifest {
  fields(raw, ["version", "status", "workspaceId", "template", "grain", "period", "sections", "dataCompleteness", "capturedFreshness", "watermark", "requiredScope", "items"]);
  const rebuilt = reportManifest(raw.workspaceId, raw.template.code, raw.template.version, raw.template.definition, raw.period.start,
    raw.items.map(i => ({ panelId: i.panel.id, data: i.data, dailyDependencies: i.dailyDependencies.map(d => d.data), requiredScope: i.requiredScope })));
  if (fingerprintOf(rebuilt) !== fingerprintOf(raw)) throw Error("invalid_report_manifest");
  return rebuilt;
}
