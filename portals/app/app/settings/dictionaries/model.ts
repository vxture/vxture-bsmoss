import { FIRST_METRICS } from "../../domains/catalog/first-metrics";
import { CATEGORIES, refKey, type MetricDefinition } from "../../domains/catalog/registry";
import { CLASSIFICATIONS, filterDefinitions } from "../../domains/business-parameters/catalog";
import { reportLabels } from "../../domains/reports/display";
export type DictionaryView = "classifications" | "metrics";
export const dictionaryView = (value: string | string[] | undefined): DictionaryView => value === "metrics" ? "metrics" : "classifications";
export const classificationGroups: Record<string, string> = {siteType: "\u7ad9\u70b9\u7c7b\u578b", scene: "\u4e1a\u52a1\u573a\u666f", sharing: "\u5171\u4eab\u65b9\u5f0f"};
const words: Record<string, string> = {
 byte: "B", second: "\u79d2", minute: "\u5206\u949f", hour: "\u5c0f\u65f6", day: "\u65e5", week: "\u5468", month: "\u6708", "15m": "15\u5206\u949f", count: "\u6b21 / \u6761",
 enum: "\u72b6\u6001", ratio: "\u6bd4\u4f8b", degC: "\u00b0C", state: "\u72b6\u6001", device_count: "\u8bbe\u5907\u6570",
 network_object: "\u7f51\u7edc\u5bf9\u8c61", cell: "\u5c0f\u533a", station_meter: "\u7ad9\u5740\u7535\u8868", device: "\u8bbe\u5907",
 service_required: "\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb", physical_object: "\u7269\u7406\u5bf9\u8c61",
 sum: "\u533a\u95f4\u589e\u91cf\u6c42\u548c", derived_sum: "\u4f9d\u8d56\u6307\u6807\u6c42\u548c", ratio_parts: "\u7d2f\u8ba1\u5206\u5b50 / \u7d2f\u8ba1\u5206\u6bcd",
 state_duration: "\u72b6\u6001\u6301\u7eed\u65f6\u95f4", gauge_summary: "\u65f6\u957f\u6216\u6837\u672c\u6c47\u603b", disjoint_sum: "\u4e92\u65a5\u5bf9\u8c61\u6c42\u548c",
 state_counts: "\u8bbe\u5907\u72b6\u6001\u5206\u5e03", not_additive: "\u4e0d\u53ef\u76f4\u63a5\u76f8\u52a0",
 interval_delta: "\u533a\u95f4\u589e\u91cf", derived: "\u4f9d\u8d56\u8ba1\u7b97", state_semantic: "\u72b6\u6001\u65f6\u5e8f", gauge: "\u89c2\u6d4b\u503c",
 planned: "\u5f85\u63a5\u5165", validated: "\u5df2\u6821\u9a8c", active: "\u5df2\u542f\u7528", retired: "\u5df2\u9000\u5f79",
};
export const word = (key: string) => words[key] ?? key;
export const metricUnit = (m: Readonly<MetricDefinition>, unit: string) => unit === "count" ? m.code.startsWith("service.sms.") ? "\u6761" : "\u6b21" : word(unit);

export const metrics = FIRST_METRICS.list();
export const dictionaryGroups = (view: DictionaryView) => view === "metrics" ? CATEGORIES.map(value => ({value, label: reportLabels[value]})) : Object.entries(classificationGroups).map(([value,label]) => ({value,label}));
export function dictionaryRows(view: DictionaryView, search: string, group = "all") {
 if (view === "classifications") return filterDefinitions(CLASSIFICATIONS,search,group).map(definition => ({id:definition.id, code:definition.code, name:definition.name, group:classificationGroups[definition.group], version:definition.version, summary:definition.summary, definition, metric:undefined}));
 const terms=search.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return metrics.filter(m => (group === "all" || group === m.category) && terms.every(term => [m.code,reportLabels[m.code],reportLabels[m.category],"v"+m.version,metricUnit(m,m.unit),...m.displayUnits.map(unit=>metricUnit(m,unit)),word(m.object),word(m.attribution),word(m.timeAggregation),word(m.objectAggregation),...m.dependencies.flatMap(d=>[d.code,reportLabels[d.code]])].join(" ").toLowerCase().includes(term))).map(metric => ({id:refKey(metric), code:metric.code, name:reportLabels[metric.code], group:reportLabels[metric.category], version:"v"+metric.version, summary:metricUnit(metric,metric.unit), definition:undefined, metric}));
}
export type DictionaryRow = ReturnType<typeof dictionaryRows>[number];
