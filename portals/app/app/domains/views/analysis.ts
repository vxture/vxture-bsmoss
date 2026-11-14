import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey } from "../catalog/registry.ts";
import { GRAINS } from "../catalog/registry.ts";
import { bucketFor, instant, type Period } from "../aggregation/periods.ts";
import { positiveRevision } from "../aggregation/intervals.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { fields, type ReportBinding, type ReportData } from "../reports/rules.ts";
import { validatePanel, type Panel, type Preference } from "./resolve.ts";

export interface AnalysisTemplate { schema: "analysis-template-v1"; title: string; panels: readonly Panel[]; bindings: readonly ReportBinding[] }
export interface AnalysisQuery { at: string }
export interface SaveAnalysisPreference {
  commandId: string; templateCode: string; templateVersion: number; templateSha256: string; expectedRevision: string | null; preferences: readonly Preference[];
}
export interface AnalysisPreference extends SaveAnalysisPreference { schema: "analysis-preference-v1" }
export interface AnalysisPoint { period: Period; status: string; data: ReportData | null; freshness: "current" | "stale" | "unavailable"; reasons: readonly string[] }
export interface AnalysisPanel { panel: Panel; binding: ReportBinding; options: { grains: readonly string[]; units: readonly string[] }; points: readonly AnalysisPoint[] }
export interface AnalysisWorkspace {
  template: { code: string; version: number; sha256: string; title: string } | null;
  preferenceRevision: string | null; at: string; panels: readonly AnalysisPanel[];
}
export function analysisTemplate(raw: AnalysisTemplate): AnalysisTemplate {
  fields(raw, ["schema", "title", "panels", "bindings"]); jobIdentity(raw.title);
  if (raw.schema !== "analysis-template-v1" || !Array.isArray(raw.panels) || !raw.panels.length || raw.panels.length > 16 ||
    !Array.isArray(raw.bindings) || raw.bindings.length !== raw.panels.length) throw Error("invalid_analysis_template");
  const ids = new Set<string>();
  for (const p of raw.panels) { validatePanel(p, FIRST_METRICS); jobIdentity(p.id); if (ids.has(p.id)) throw Error("invalid_analysis_panel"); ids.add(p.id); }
  const bindings = new Set<string>();
  for (const b of raw.bindings) {
    fields(b, b.kind === "aggregate" ? ["panelId", "kind", "sourceId", "mappingId"] : b.kind === "rollup" ? ["panelId", "kind", "rollupId"] : ["panelId", "kind"]);
    if (!ids.has(b.panelId) || bindings.has(b.panelId)) throw Error("invalid_analysis_binding"); bindings.add(b.panelId);
    if (b.kind === "aggregate") { jobIdentity(b.sourceId); jobIdentity(b.mappingId); }
    else if (b.kind === "rollup") jobIdentity(b.rollupId); else if (b.kind !== "not_connected") throw Error("invalid_analysis_binding");
  }
  return structuredClone(raw);
}
export function analysisQuery(raw: AnalysisQuery): AnalysisQuery { fields(raw, ["at"]); return { at: new Date(instant(raw.at)).toISOString() }; }
export function analysisPreferences(raw: readonly Preference[]): Preference[] {
  if (!Array.isArray(raw) || raw.length > 16) throw Error("invalid_analysis_preferences");
  const ids = new Set<string>();
  return raw.map(p => {
    fields(p, ["id", "visible", "order", "displayUnit", "grain", "precision"]); jobIdentity(p.id);
    if (ids.has(p.id)) throw Error("invalid_analysis_preferences"); ids.add(p.id);
    if (p.visible !== undefined && typeof p.visible !== "boolean" || p.order !== undefined && !Number.isSafeInteger(p.order) ||
      p.precision !== undefined && (!Number.isInteger(p.precision) || p.precision < 0 || p.precision > 9) ||
      p.grain !== undefined && !GRAINS.includes(p.grain) || p.displayUnit !== undefined && (typeof p.displayUnit !== "string" || !p.displayUnit || p.displayUnit.length > 32)) throw Error("invalid_analysis_preferences");
    return structuredClone(p);
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
export function saveAnalysisPreference(raw: SaveAnalysisPreference): SaveAnalysisPreference {
  fields(raw, ["commandId", "templateCode", "templateVersion", "templateSha256", "expectedRevision", "preferences"]);
  jobIdentity(raw.commandId); jobIdentity(raw.templateCode);
  if (!Number.isSafeInteger(raw.templateVersion) || raw.templateVersion < 1 || typeof raw.templateSha256 !== "string" || !/^[a-f0-9]{64}$/.test(raw.templateSha256)) throw Error("invalid_analysis_preferences");
  if (raw.expectedRevision !== null) positiveRevision(raw.expectedRevision);
  return { ...raw, preferences: analysisPreferences(raw.preferences) };
}
export function applyAnalysisPreferences(template: AnalysisTemplate, preferences: readonly Preference[]): Panel[] {
  const t = analysisTemplate(template), prefs = analysisPreferences(preferences);
  if (prefs.some(p => !t.panels.some(panel => panel.id === p.id))) throw Error("unknown_analysis_panel");
  return t.panels.map(p => {
    const panel = { ...p, ...prefs.find(pref => pref.id === p.id) }; validatePanel(panel, FIRST_METRICS); return panel;
  }).sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export function analysisWindows(panel: Panel, at: string): Period[] {
  validatePanel(panel, FIRST_METRICS); const windows = [bucketFor(at, panel.grain)], count = ["trend", "table", "ranking", "timeline"].includes(panel.view) ? 7 : 1;
  if (Date.parse(windows[0]!.start) < Date.parse("1992-01-01T00:00:00+08:00")) throw Error("unsupported_calendar_date");
  for (let i = 1; i < count; i++) {
    const previous = Date.parse(windows[0]!.start) - 1;
    if (previous < Date.parse("1992-01-01T00:00:00+08:00")) break;
    try { windows.unshift(bucketFor(new Date(previous).toISOString(), panel.grain)); }
    catch (error) { if (error instanceof Error && error.message === "unsupported_calendar_date") break; throw error; }
  }
  return windows;
}
export function analysisMetricKeys(panel: Panel) {
  const metric = FIRST_METRICS.get(panel.metricRef)!;
  return [refKey(panel.metricRef), ...(metric.semantic === "derived" ? metric.dependencies.map(refKey) : [])];
}
