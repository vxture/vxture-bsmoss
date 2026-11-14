import { assertDisplay, refKey, type Category, type Grain, type MetricRef, type createRegistry } from "../catalog/registry.ts";
type Registry = ReturnType<typeof createRegistry>;
export interface Panel {
  id: string; category: Category; metricRef: MetricRef;
  view: "card" | "trend" | "table" | "ranking" | "timeline";
  grain: Grain; displayUnit: string; precision: number; order: number; visible: boolean;
}
export type Patch = Partial<Omit<Panel, "id">> & { id: string };
export type Preference = Pick<Panel, "id"> & Partial<Pick<Panel, "visible" | "order" | "displayUnit" | "grain" | "precision">>;
export interface Capability { metricRef: MetricRef; grains: readonly Grain[] }
export interface ResolveInput {
  workspaceId: string; template: { workspaceId: string; code: string; version: number; panels: readonly Panel[] };
  roles?: readonly { priority: number; panels: readonly Patch[] }[];
  page?: readonly Patch[]; preferences?: readonly Preference[]; mode: "interactive" | "report";
  // Trusted server-resolved access conclusions and capabilities for the same scoped query.
  allowedMetricKeys: ReadonlySet<string>; capabilities: readonly Capability[];
}
const panelKeys = ["id", "category", "metricRef", "view", "grain", "displayUnit", "precision", "order", "visible"];
function keys(value: object, allowed: readonly string[]) {
  if (Object.keys(value).some(k => !allowed.includes(k))) throw new Error("unknown_field");
}
export function validatePanel(panel: Panel, registry: Registry) {
  keys(panel,panelKeys); keys(panel.metricRef,["code","version"]);
  const m = registry.get(panel.metricRef);
  if (!panel.id.trim() || !m || m.lifecycle === "retired") throw new Error("unavailable_metric");
  if (panel.category !== m.category) throw new Error("category_mismatch");
  assertDisplay(m,panel.grain,panel.displayUnit);
  if (!Number.isInteger(panel.precision) || panel.precision < 0 || panel.precision > 9 || !Number.isSafeInteger(panel.order) || typeof panel.visible !== "boolean") throw new Error("invalid_display");
  const views = m.semantic === "state" ? ["table","timeline","card"] : ["card","trend","table","ranking"];
  if (!views.includes(panel.view)) throw new Error("unsupported_view");
  if (m.semantic === "state" && (panel.view === "timeline" || panel.view === "card") && panel.displayUnit !== "state") throw new Error("state_view_unit_mismatch");
}
function apply(panels: Map<string,Panel>, patches: readonly Patch[], registry: Registry) {
  const seen = new Set<string>();
  for (const patch of patches) {
    keys(patch,panelKeys);
    if (seen.has(patch.id)) throw new Error("duplicate_panel"); seen.add(patch.id);
    const prior = panels.get(patch.id); if (!prior) throw new Error("unknown_panel");
    const merged = {...prior,...patch}; validatePanel(merged,registry); panels.set(patch.id,merged);
  }
}
export function resolvePanels(registry: Registry, input: ResolveInput) {
  if (!input.workspaceId || input.template.workspaceId !== input.workspaceId) throw new Error("workspace_mismatch");
  if (!input.template.code.trim() || !Number.isSafeInteger(input.template.version) || input.template.version < 1) throw new Error("invalid_template");
  if (!["interactive","report"].includes(input.mode)) throw new Error("invalid_mode");
  const panels = new Map<string,Panel>();
  for (const p of input.template.panels) {
    validatePanel(p,registry); if (panels.has(p.id)) throw new Error("duplicate_panel");
    panels.set(p.id,{...p,metricRef:{...p.metricRef}});
  }
  const roles = [...(input.roles ?? [])].sort((a,b) => a.priority-b.priority);
  const edits = new Set<string>();
  for (const role of roles) {
    if (!Number.isSafeInteger(role.priority)) throw new Error("invalid_role_priority");
    for (const p of role.panels) for (const field of Object.keys(p).filter(k => k !== "id")) {
      const key = JSON.stringify([role.priority,p.id,field]);
      if (edits.has(key)) throw new Error("role_priority_conflict"); edits.add(key);
    }
    apply(panels,role.panels,registry);
  }
  apply(panels,input.page ?? [],registry);
  // Dependency access is checked as well: a hidden derived metric cannot leak restricted inputs.
  function authorized(ref: MetricRef): boolean {
    const m = registry.get(ref)!;
    return input.allowedMetricKeys.has(refKey(ref)) && m.dependencies.every(authorized);
  }
  const permitted = new Map([...panels].filter(([,p]) => authorized(p.metricRef)));
  if (input.mode === "interactive") {
    const seen = new Set<string>();
    for (const pref of input.preferences ?? []) {
      keys(pref,["id","visible","order","displayUnit","grain","precision"]);
      if (seen.has(pref.id)) throw new Error("duplicate_preference"); seen.add(pref.id);
      if (!panels.has(pref.id)) throw new Error("unknown_panel");
      // Old saved preferences for revoked access are ignored, never resurrected.
      if (permitted.has(pref.id)) apply(permitted,[pref],registry);
    }
  }
  function available(ref: MetricRef, grain: Grain): boolean {
    const m = registry.get(ref)!;
    const own = input.capabilities.some(c => refKey(c.metricRef) === refKey(ref) && c.grains.includes(grain));
    return own && m.dependencies.every(d => available(d,grain));
  }
  return Object.freeze({
    templateCode: input.template.code, templateVersion: input.template.version,
    panels: Object.freeze([...permitted.values()].filter(p => p.visible).sort((a,b) => a.order-b.order || a.id.localeCompare(b.id)).map(p => Object.freeze({
      ...p,metricRef:Object.freeze({...p.metricRef}),
      availability: available(p.metricRef,p.grain) ? "supported" as const : "not_connected" as const,
      requiredContext: Object.freeze(["quality","freshness","revision","definition"] as const),
    }))),
  });
}
