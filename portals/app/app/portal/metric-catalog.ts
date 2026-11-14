import { CATEGORIES, type Category } from "../domains/catalog/registry";

export const OVERVIEW_CATALOG_VERSION = "bsmoss-overview-metrics-v1";
export const OVERVIEW_PREFERENCE_KEY = "bsmoss.overview.display.v1";
export const categoryNames: Record<Category, string> = { business_service: "\u7ecf\u8425\u670d\u52a1", operational_status: "\u8fd0\u8425\u72b6\u6001", runtime_parameter: "\u8fd0\u884c\u53c2\u6570" };
export type OverviewMetricId = "flow" | "uplink" | "downlink" | "voice" | "attempts" | "connected" | "sms" | "perSiteFlow" |
  "connection" | "load" | "dailyConnection" | "dailyLoad" | "latency" | "highLoad" | "normal" |
  "energy" | "temperature" | "temperatureMax" | "hot" | "battery" | "mains" | "batterySites" | "batteryHours" | "intensity";
const units = {
  TiB: { label: "TiB", divisor: 1099511627776 }, GiB: { label: "GiB", divisor: 1073741824 },
  wanMinute: { label: "\u4e07\u5206\u949f", divisor: 600000 }, hour: { label: "\u5c0f\u65f6", divisor: 3600 },
  wanCount: { label: "\u4e07\u6b21", divisor: 10000 }, count: { label: "\u6b21", divisor: 1 },
  wanMessage: { label: "\u4e07\u6761", divisor: 10000 }, message: { label: "\u6761", divisor: 1 },
  percent: { label: "%", divisor: .01 }, station: { label: "\u5ea7", divisor: 1 },
  ms: { label: "ms", divisor: 1 }, kWh: { label: "kWh", divisor: 1000 }, Wh: { label: "Wh", divisor: 1 },
  degC: { label: "\u00b0C", divisor: 1 }, stationHour: { label: "\u7ad9\u65f6", divisor: 1 },
  perSiteGiB: { label: "GiB/\u7ad9\u65e5", divisor: 1073741824 }, intensity: { label: "kWh/GiB", divisor: 1 },
};
export type OverviewUnit = keyof typeof units;
export const overviewUnit = (unit: OverviewUnit) => units[unit];
export interface OverviewMetricDefinition {
  id: OverviewMetricId; category: Category; label: string; units: readonly OverviewUnit[]; precision: number;
  basis: "day" | "snapshot"; description: string; change: "rate" | "points" | "delta"; catalogCode?: string;
}
const d = (id: OverviewMetricId, category: Category, label: string, allowed: OverviewUnit[], precision: number,
  basis: "day" | "snapshot", description: string, change: OverviewMetricDefinition["change"] = "rate", catalogCode?: string): OverviewMetricDefinition =>
  ({ id, category, label, units: allowed, precision, basis, description, change, ...(catalogCode ? { catalogCode } : {}) });
// Read-only view projections of the existing synthetic observations. Never activates a formal catalog metric.
export const OVERVIEW_METRICS: readonly OverviewMetricDefinition[] = [
  d("flow", "business_service", "\u53cc\u5411\u6d41\u91cf", ["TiB", "GiB"], 2, "day", "\u4e0a\u884c\u4e0e\u4e0b\u884c\u5b57\u8282\u4e4b\u548c\uff0c\u6309\u670d\u52a1\u5173\u7cfb\u53bb\u91cd\u7d2f\u52a0\u3002", "rate", "service.data.total_bytes"),
  d("uplink", "business_service", "\u4e0a\u884c\u6d41\u91cf", ["TiB", "GiB"], 2, "day", "\u540c\u7ad9\u7fa4\u6240\u6709\u670d\u52a1\u5173\u7cfb\u7684\u4e0a\u884c\u5b57\u8282\u7d2f\u8ba1\u3002", "rate", "service.data.uplink_bytes"),
  d("downlink", "business_service", "\u4e0b\u884c\u6d41\u91cf", ["TiB", "GiB"], 2, "day", "\u540c\u5c42\u4e0b\u884c\u5b57\u8282\u7d2f\u8ba1\uff0c\u4e0d\u4e0e\u53cc\u5411\u603b\u91cf\u91cd\u590d\u76f8\u52a0\u3002", "rate", "service.data.downlink_bytes"),
  d("voice", "business_service", "\u63a5\u901a\u901a\u8bdd", ["wanMinute", "hour"], 2, "day", "\u5df2\u63a5\u901a\u901a\u8bdd\u65f6\u957f\uff0c\u4ee5\u539f\u59cb\u79d2\u6570\u7d2f\u8ba1\u540e\u8f6c\u6362\u5355\u4f4d\u3002", "rate", "service.voice.connected_seconds"),
  d("attempts", "business_service", "\u547c\u53eb\u5c1d\u8bd5", ["wanCount", "count"], 2, "day", "\u540c\u4e00\u7edf\u8ba1\u70b9\u7684\u547c\u53eb\u5c1d\u8bd5\u6b21\u6570\u7d2f\u8ba1\u3002", "rate", "service.voice.attempt_count"),
  d("connected", "business_service", "\u63a5\u901a\u6b21\u6570", ["wanCount", "count"], 2, "day", "\u540c\u4e00\u7edf\u8ba1\u70b9\u7684\u5df2\u63a5\u901a\u6b21\u6570\u7d2f\u8ba1\u3002", "rate", "service.voice.connected_count"),
  d("sms", "business_service", "\u77ed\u4fe1\u91cf", ["wanMessage", "message"], 2, "day", "\u670d\u52a1\u5173\u7cfb\u6210\u529f\u77ed\u4fe1\u8ba1\u6570\u7d2f\u8ba1\u3002", "rate", "service.sms.success_count"),
  d("perSiteFlow", "business_service", "\u5355\u7ad9\u65e5\u5747\u6d41\u91cf", ["perSiteGiB"], 2, "day", "\u5f53\u65e5\u53cc\u5411\u6d41\u91cf\u9664\u4ee5\u540c\u8303\u56f4\u6709\u6548\u7269\u7406\u7ad9\u5740\u6570\uff0c\u4e0d\u6309\u8fd0\u8425\u5546\u91cd\u590d\u8ba1\u7ad9\u3002"),
  d("connection", "operational_status", "\u65f6\u70b9\u63a5\u901a\u7387", ["percent"], 1, "snapshot", "\u72b6\u6001\u5c0f\u65f6\u63a5\u901a\u6b21\u6570\u603b\u548c\u9664\u4ee5\u5c1d\u8bd5\u6b21\u6570\u603b\u548c\uff0c\u4e0d\u5e73\u5747\u7ad9\u5740\u767e\u5206\u6bd4\u3002", "points", "status.voice.connection_rate"),
  d("load", "operational_status", "\u65f6\u70b9\u8d44\u6e90\u8d1f\u8f7d", ["percent"], 1, "snapshot", "\u72b6\u6001\u5c0f\u65f6\u5df2\u7528\u8d44\u6e90\u603b\u548c\u9664\u4ee5\u5bb9\u91cf\u603b\u548c\uff1b\u5e76\u975e\u5382\u5bb6PRB\u5b9e\u6d4b\u3002", "points"),
  d("dailyConnection", "operational_status", "\u5168\u65e5\u63a5\u901a\u7387", ["percent"], 1, "day", "24\u5c0f\u65f6\u63a5\u901a\u603b\u6b21\u6570\u9664\u4ee5\u5c1d\u8bd5\u603b\u6b21\u6570\u3002", "points", "status.voice.connection_rate"),
  d("dailyLoad", "operational_status", "\u5168\u65e5\u8d44\u6e90\u8d1f\u8f7d", ["percent"], 1, "day", "24\u5c0f\u65f6\u5df2\u7528\u8d44\u6e90\u6837\u672c\u603b\u548c\u9664\u4ee5\u5bb9\u91cf\u6837\u672c\u603b\u548c\uff0c\u4e0d\u7d2f\u52a0\u767e\u5206\u6bd4\u3002", "points"),
  d("latency", "operational_status", "\u65f6\u70b9\u5e73\u5747\u65f6\u5ef6", ["ms"], 1, "snapshot", "\u540c\u4e00\u65f6\u70b9\u7ad9\u5740\u65f6\u5ef6\u6837\u672c\u7684\u7b97\u672f\u5747\u503c\uff0c\u4e0d\u4ee3\u8868P95\u6216\u7528\u6237\u52a0\u6743\u65f6\u5ef6\u3002", "delta"),
  d("highLoad", "operational_status", "\u9ad8\u8d1f\u8f7d\u7ad9\u5740", ["station"], 0, "snapshot", "\u72b6\u6001\u5c0f\u65f6\u8d44\u6e90\u8d1f\u8f7d\u4e0d\u4f4e\u4e8e85%\u7684\u7269\u7406\u7ad9\u5740\u6570\u3002", "delta"),
  d("normal", "operational_status", "\u6b63\u5e38\u7ad9\u5740", ["station"], 0, "snapshot", "\u72b6\u6001\u5c0f\u65f6\u88ab\u65e2\u6709\u7ad9\u5740\u72b6\u6001\u89c4\u5219\u5224\u4e3a\u6b63\u5e38\u7684\u6570\u91cf\uff0c\u4e0d\u7b49\u540c\u670d\u52a1\u53ef\u7528\u7387\u3002", "delta"),
  d("energy", "runtime_parameter", "\u7269\u7406\u7535\u8017", ["kWh", "Wh"], 1, "day", "\u7269\u7406\u7ad9\u5740\u7535\u8017\u7d2f\u8ba1\uff0c\u4e0d\u91cd\u590d\u6309\u670d\u52a1\u5173\u7cfb\u8ba1\u91cf\uff0c\u4e0d\u5206\u644a\u8fd0\u8425\u5546\u3002", "rate", "runtime.energy.site_wh"),
  d("temperature", "runtime_parameter", "\u65f6\u70b9\u5e73\u5747\u6e29\u5ea6", ["degC"], 1, "snapshot", "\u540c\u4e00\u65f6\u70b9\u7ad9\u5740\u73af\u5883\u6e29\u5ea6\u6837\u672c\u7684\u7b97\u672f\u5747\u503c\uff0c\u4e0d\u4f5c\u8de8\u65f6\u6bb5\u7d2f\u52a0\u3002", "delta", "runtime.environment.temperature_c"),
  d("temperatureMax", "runtime_parameter", "\u5168\u65e5\u6700\u9ad8\u6e29\u5ea6", ["degC"], 1, "day", "\u5168\u90e8\u7269\u7406\u7ad9\u65f6\u6e29\u5ea6\u6837\u672c\u7684\u6700\u5927\u503c\u3002", "delta", "runtime.environment.temperature_c"),
  d("hot", "runtime_parameter", "\u9ad8\u6e29\u7ad9\u5740", ["station"], 0, "snapshot", "\u72b6\u6001\u5c0f\u65f6\u73af\u5883\u6e29\u5ea6\u4e0d\u4f4e\u4e8e35\u00b0C\u7684\u7ad9\u5740\u6570\u3002", "delta"),
  d("battery", "runtime_parameter", "\u5907\u7528\u4f9b\u7535\u7ad9\u5740", ["station"], 0, "snapshot", "\u72b6\u6001\u5c0f\u65f6\u5904\u4e8e\u5907\u7528\u4f9b\u7535\u7684\u7269\u7406\u7ad9\u5740\u6570\uff0c\u4e0d\u63a8\u65ad\u7535\u6c60\u6545\u969c\u3002", "delta"),
  d("mains", "runtime_parameter", "\u5e02\u7535\u4f9b\u7535\u7ad9\u5740", ["station"], 0, "snapshot", "\u72b6\u6001\u5c0f\u65f6\u5904\u4e8e\u5e02\u7535\u4f9b\u7535\u7684\u7269\u7406\u7ad9\u5740\u6570\u3002", "delta"),
  d("batterySites", "runtime_parameter", "\u5168\u65e5\u5907\u7528\u4f9b\u7535\u7ad9\u5740", ["station"], 0, "day", "\u5168\u65e5\u51fa\u73b0\u5907\u7528\u4f9b\u7535\u7684\u552f\u4e00\u7ad9\u5740\u6570\uff0c\u540c\u7ad9\u591a\u4e2a\u5c0f\u65f6\u4ec5\u8ba1\u4e00\u5ea7\u3002", "delta"),
  d("batteryHours", "runtime_parameter", "\u5907\u7528\u4f9b\u7535\u7d2f\u8ba1", ["stationHour"], 0, "day", "\u5168\u65e5\u5907\u7528\u4f9b\u7535\u7269\u7406\u7ad9\u65f6\u6837\u672c\u6570\uff0c\u6bcf\u4e2a\u6837\u672c\u4e3a\u4e00\u5c0f\u65f6\u3002", "delta"),
  d("intensity", "runtime_parameter", "\u5355\u4f4d\u6d41\u91cf\u7535\u8017", ["intensity"], 3, "day", "\u7269\u7406\u7535\u8017\u9664\u4ee5\u540c\u7ad9\u7fa4\u53cc\u5411\u6d41\u91cf\uff1b\u96f6\u6d41\u91cf\u6216\u7535\u8017\u7f3a\u5931\u65f6\u4e0d\u53ef\u8bc4\u4f30\u3002", "delta"),
];
export interface OverviewDisplayPreference {
  version: 1; catalogVersion: string;
  selections: Record<Category, { id: OverviewMetricId; unit: OverviewUnit }[]>;
}
export const defaultOverviewDisplay = (): OverviewDisplayPreference => ({
  version: 1, catalogVersion: OVERVIEW_CATALOG_VERSION, selections: {
    business_service: [{ id: "flow", unit: "TiB" }, { id: "voice", unit: "wanMinute" }, { id: "sms", unit: "wanMessage" }],
    operational_status: [{ id: "connection", unit: "percent" }, { id: "load", unit: "percent" }, { id: "normal", unit: "station" }],
    runtime_parameter: [{ id: "energy", unit: "kWh" }, { id: "battery", unit: "station" }, { id: "hot", unit: "station" }],
  },
});
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const keys = (o: Record<string, unknown>, expected: readonly string[]) => Object.keys(o).length === expected.length && Object.keys(o).every(k => expected.includes(k));
export function parseOverviewDisplay(value: unknown): OverviewDisplayPreference {
  if (!object(value) || !keys(value, ["version", "catalogVersion", "selections"]) || value.version !== 1 ||
    value.catalogVersion !== OVERVIEW_CATALOG_VERSION || !object(value.selections) || !keys(value.selections, CATEGORIES)) throw Error("invalid_overview_display");
  const selections = {} as OverviewDisplayPreference["selections"];
  for (const category of CATEGORIES) {
    const items = value.selections[category];
    if (!Array.isArray(items) || items.length < 2 || items.length > 4) throw Error("invalid_overview_selection");
    const ids = new Set<string>();
    selections[category] = items.map(item => {
      if (!object(item) || !keys(item, ["id", "unit"])) throw Error("invalid_overview_metric");
      const def = OVERVIEW_METRICS.find(m => m.id === item.id && m.category === category);
      if (!def || typeof item.unit !== "string" || !def.units.includes(item.unit as OverviewUnit) || ids.has(def.id)) throw Error("invalid_overview_metric");
      ids.add(def.id); return { id: def.id, unit: item.unit as OverviewUnit };
    });
  }
  return { version: 1, catalogVersion: OVERVIEW_CATALOG_VERSION, selections };
}
export function metricDisplay(value: number | null, unit: OverviewUnit, precision: number) {
  if (value === null) return "\u2014";
  return (value / overviewUnit(unit).divisor).toLocaleString("zh-CN", { maximumFractionDigits: ["station", "stationHour", "count", "message", "Wh"].includes(unit) ? 0 : precision });
}
