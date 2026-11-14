import { FIRST_METRICS } from "../../domains/catalog/first-metrics";
import { refKey, type Grain, type MetricRef } from "../../domains/catalog/registry";
import { validatePanel, type Panel } from "../../domains/views/resolve";
import type { TemplateCandidate } from "../../domains/views/templates";
import type { ReportBinding, ReportGrain } from "../../domains/reports/rules";

// Browser-safe draft assistance. Publication always repeats authoritative
// validation on the server, including object ownership and configuration hashes.
export const EDITOR_METRICS = FIRST_METRICS.list().filter(m => m.lifecycle !== "retired");
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
function only(x: Record<string, unknown>, keys: readonly string[]) { return Object.keys(x).every(k => keys.includes(k)); }
export function editableTemplate(text: string): TemplateCandidate | null {
  try {
    if (text.length > 16384) return null;
    const c: unknown = JSON.parse(text);
    if (!object(c) || !only(c, ["kind", "definition"]) || c.kind !== "page" && c.kind !== "report" || !object(c.definition)) return null;
    const d = c.definition, report = c.kind === "report";
    if (!only(d, report ? ["schema", "title", "grain", "panels", "bindings"] : ["schema", "title", "panels", "bindings"]) ||
        d.schema !== (report ? "periodic-report-template-v1" : "analysis-template-v1") || typeof d.title !== "string" ||
        report && (typeof d.grain !== "string" || !["day", "week", "month"].includes(d.grain)) || !Array.isArray(d.panels) || !d.panels.length || d.panels.length > 16 ||
        !Array.isArray(d.bindings) || d.bindings.length !== d.panels.length) return null;
    const ids = new Set<string>(), bound = new Set<string>();
    for (const p of d.panels) {
      if (!object(p) || !object(p.metricRef) || typeof p.id !== "string" || ids.has(p.id) || report && p.grain !== d.grain) return null;
      validatePanel(p as unknown as Panel, FIRST_METRICS); ids.add(p.id);
    }
    for (const b of d.bindings) {
      if (!object(b) || typeof b.panelId !== "string" || !ids.has(b.panelId) || bound.has(b.panelId)) return null;
      if (b.kind === "aggregate") { if (!only(b, ["panelId", "kind", "sourceId", "mappingId"]) || typeof b.sourceId !== "string" || typeof b.mappingId !== "string") return null; }
      else if (b.kind === "rollup") { if (!only(b, ["panelId", "kind", "rollupId"]) || typeof b.rollupId !== "string") return null; }
      else if (b.kind !== "not_connected" || !only(b, ["panelId", "kind"])) return null;
      bound.add(b.panelId);
    }
    return c as unknown as TemplateCandidate;
  } catch { return null; }
}
export function editorViews(panel: Panel): readonly Panel["view"][] {
  return FIRST_METRICS.get(panel.metricRef)?.semantic === "state" ? panel.displayUnit === "state" ? ["card", "table", "timeline"] : ["table"] : ["card", "trend", "table", "ranking"];
}
function renumber(c: TemplateCandidate): TemplateCandidate {
  const panels = c.definition.panels.map((p, order) => ({ ...p, order }));
  return { ...c, definition: { ...c.definition, panels, bindings: panels.map(p => c.definition.bindings.find(b => b.panelId === p.id)!) } } as TemplateCandidate;
}
export function newTemplate(kind: TemplateCandidate["kind"]): TemplateCandidate {
  const refs = ["service.voice.connected_seconds", "status.voice.connection_rate", "runtime.device.state"];
  const panels = refs.map((code, order) => {
    const m = EDITOR_METRICS.find(m => m.code === code)!;
    return { id: "panel-" + (order + 1), metricRef: { code, version: m.version }, category: m.category,
      grain: "day" as const, displayUnit: m.displayUnits[0]!, view: "card" as const, precision: 2, order, visible: true };
  });
  const common = { title: "", panels, bindings: panels.map(p => ({ panelId: p.id, kind: "not_connected" as const })) };
  return kind === "page" ? { kind, definition: { schema: "analysis-template-v1", ...common } } : { kind, definition: { schema: "periodic-report-template-v1", ...common, grain: "day" } };
}
export type EditorChange = { type: "title"; value: string } | { type: "report-grain"; value: ReportGrain }
  | { type: "panel"; id: string; patch: Partial<Pick<Panel, "visible" | "view" | "grain" | "displayUnit" | "precision">> }
  | { type: "metric"; id: string; ref: MetricRef } | { type: "binding"; binding: ReportBinding }
  | { type: "move"; id: string; direction: -1 | 1 } | { type: "remove"; id: string } | { type: "add"; ref: MetricRef };
export function editTemplate(raw: TemplateCandidate, change: EditorChange): TemplateCandidate {
  // Clone before editing; loaded immutable evidence never doubles as a draft.
  let c = structuredClone(raw), panels = [...c.definition.panels], bindings = [...c.definition.bindings];
  if (change.type === "title") { c.definition.title = change.value; return c; }
  if (change.type === "report-grain") {
    if (c.kind !== "report" || !["day", "week", "month"].includes(change.value)) throw Error("invalid_editor_grain");
    c.definition.grain = change.value; c.definition.panels = panels.map(p => ({ ...p, grain: change.value })); return c;
  }
  if (change.type === "add") {
    if (panels.length >= 16) throw Error("editor_panel_limit");
    const m = FIRST_METRICS.get(change.ref); if (!m || m.lifecycle === "retired") throw Error("unavailable_metric");
    let n = 1; while (panels.some(p => p.id === "panel-" + n)) n++;
    const id = "panel-" + n;
    panels.push({ id, metricRef: { code: m.code, version: m.version }, category: m.category, grain: c.kind === "report" ? c.definition.grain : "day", displayUnit: m.displayUnits[0]!, precision: 2, order: panels.length, visible: true, view: "card" });
    bindings.push({ panelId: id, kind: "not_connected" });
  } else {
    const id = change.type === "binding" ? change.binding.panelId : change.id, index = panels.findIndex(p => p.id === id);
    if (index < 0) throw Error("unknown_panel");
    const p = panels[index]!;
    if (change.type === "remove") {
      if (panels.length <= 1) throw Error("editor_panel_minimum");
      panels.splice(index, 1); bindings = bindings.filter(b => b.panelId !== id);
    } else if (change.type === "move") {
      const to = index + change.direction; if (to < 0 || to >= panels.length) return c;
      [panels[index], panels[to]] = [panels[to]!, panels[index]!];
    } else if (change.type === "binding") bindings = bindings.map(b => b.panelId === id ? structuredClone(change.binding) : b);
    else if (change.type === "metric") {
      const m = FIRST_METRICS.get(change.ref); if (!m || m.lifecycle === "retired") throw Error("unavailable_metric");
      if (refKey(p.metricRef) === refKey(change.ref)) return c;
      const next = { ...p, category: m.category, metricRef: { code: m.code, version: m.version },
        displayUnit: m.displayUnits.includes(p.displayUnit) ? p.displayUnit : m.displayUnits[0]!, grain: m.grains.includes(p.grain) ? p.grain : m.grains[0]! };
      if (!editorViews(next).includes(next.view)) next.view = "table";
      panels[index] = next; bindings = bindings.map(b => b.panelId === id ? { panelId: id, kind: "not_connected" } : b);
    } else {
      const next = { ...p, ...change.patch };
      if (c.kind === "report") next.grain = c.definition.grain;
      if (!editorViews(next).includes(next.view)) next.view = "table";
      validatePanel(next, FIRST_METRICS); panels[index] = next;
    }
  }
  c = { ...c, definition: { ...c.definition, panels, bindings } } as TemplateCandidate;
  return renumber(c);
}
