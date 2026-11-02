// Immutable versioned metric definitions. No source activation or access grant.
export const CATEGORIES = ["business_service", "operational_status", "runtime_parameter"] as const;
export const GRAINS = ["15m", "hour", "day", "week", "month"] as const;
export type Category = typeof CATEGORIES[number];
export type Grain = typeof GRAINS[number];
export interface MetricRef { code: string; version: number }
export interface MetricDefinition extends MetricRef {
  category: Category; unit: "second" | "count" | "byte" | "ratio" | "Wh" | "enum" | "degC";
  semantic: "interval_delta" | "derived" | "ratio" | "state" | "gauge";
  lifecycle: "planned" | "validated" | "active" | "retired";
  object: "network_object" | "cell" | "station_meter" | "device";
  attribution: "service_required" | "physical_object";
  timeAggregation: "sum" | "derived_sum" | "ratio_parts" | "state_duration" | "gauge_summary";
  objectAggregation: "disjoint_sum" | "ratio_parts" | "state_counts" | "not_additive";
  grains: readonly Grain[]; displayUnits: readonly string[];
  dependencies: readonly MetricRef[];
}
const UNITS: Record<MetricDefinition["unit"], readonly string[]> = {
  second: ["second", "minute", "hour"], count: ["count"], byte: ["B", "MB", "GB", "GiB"],
  ratio: ["%"], Wh: ["Wh", "kWh"], enum: ["state", "second", "device_count"], degC: ["degC"],
};
export function refKey(ref: MetricRef) { return ref.code + "@" + ref.version; }
export function createRegistry(input: readonly MetricDefinition[]) {
  const map = new Map<string, Readonly<MetricDefinition>>();
  for (const m of input) {
    if (!/^(service|status|runtime)(\.[a-z][a-z0-9_]*){2,}$/.test(m.code) || !Number.isSafeInteger(m.version) || m.version < 1) throw new Error("invalid_reference");
    const prefix = { business_service: "service.", operational_status: "status.", runtime_parameter: "runtime." };
    if (!CATEGORIES.includes(m.category) || !m.code.startsWith(prefix[m.category])) throw new Error("invalid_category");
    if (!["planned", "validated", "active", "retired"].includes(m.lifecycle)) throw new Error("invalid_lifecycle");
    if (!["network_object", "cell", "station_meter", "device"].includes(m.object) || !["service_required", "physical_object"].includes(m.attribution)) throw new Error("invalid_object");
    if (!m.grains.length || new Set(m.grains).size !== m.grains.length || m.grains.some(g => !GRAINS.includes(g))) throw new Error("invalid_grain");
    if (!UNITS[m.unit] || !m.displayUnits.length || new Set(m.displayUnits).size !== m.displayUnits.length || m.displayUnits.some(u => !UNITS[m.unit].includes(u))) throw new Error("invalid_unit");
    const valid = m.semantic === "interval_delta" ? ["second", "count", "byte", "Wh"].includes(m.unit) && m.timeAggregation === "sum" && m.objectAggregation === "disjoint_sum"
      : m.semantic === "derived" ? m.unit === "byte" && m.timeAggregation === "derived_sum" && m.objectAggregation === "disjoint_sum" && m.dependencies.length === 2
      : m.semantic === "ratio" ? m.unit === "ratio" && m.timeAggregation === "ratio_parts" && m.objectAggregation === "ratio_parts"
      : m.semantic === "state" ? m.unit === "enum" && m.timeAggregation === "state_duration" && m.objectAggregation === "state_counts"
      : m.semantic === "gauge" ? m.unit === "degC" && m.object === "device" && m.attribution === "physical_object" && m.timeAggregation === "gauge_summary" && m.objectAggregation === "not_additive"
      : false;
    if (!valid) throw new Error("invalid_aggregation");
    if (["state", "interval_delta", "gauge"].includes(m.semantic) && m.dependencies.length) throw new Error("unexpected_dependency");
    const key = refKey(m);
    if (map.has(key)) throw new Error("duplicate_definition");
    map.set(key, Object.freeze({ ...m, grains: Object.freeze([...m.grains]), displayUnits: Object.freeze([...m.displayUnits]), dependencies: Object.freeze(m.dependencies.map(d => Object.freeze({ ...d }))) }));
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(key: string) {
    if (visiting.has(key)) throw new Error("dependency_cycle");
    if (visited.has(key)) return;
    visiting.add(key);
    const metric = map.get(key)!;
    if (new Set(metric.dependencies.map(refKey)).size !== metric.dependencies.length) throw new Error("duplicate_dependency");
    for (const ref of metric.dependencies) {
      const dependency = map.get(refKey(ref));
      if (!dependency) throw new Error("missing_dependency");
      if (metric.semantic === "derived" && (dependency.unit !== metric.unit || dependency.semantic !== "interval_delta" && dependency.semantic !== "derived")) throw new Error("incompatible_dependency");
      if (metric.semantic === "ratio" && dependency.unit !== "count") throw new Error("incompatible_dependency");
      if (metric.object !== dependency.object || metric.attribution !== dependency.attribution) throw new Error("incompatible_dimension");
      if (metric.grains.some(g => !dependency.grains.includes(g))) throw new Error("incompatible_grain");
      visit(refKey(ref));
    }
    visiting.delete(key); visited.add(key);
  }
  for (const key of map.keys()) visit(key);
  return Object.freeze({
    get: (ref: MetricRef) => map.get(refKey(ref)),
    list: () => Object.freeze([...map.values()]),
  });
}
export function assertDisplay(metric: Readonly<MetricDefinition>, grain: Grain, unit: string) {
  if (!metric.grains.includes(grain)) throw new Error("unsupported_grain");
  if (!metric.displayUnits.includes(unit)) throw new Error("unsupported_unit");
}

