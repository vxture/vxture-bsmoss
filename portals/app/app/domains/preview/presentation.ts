import type { Category } from "../catalog/registry.ts";
export const CATEGORY_LABELS: Record<Category, string> = {
  business_service: "\u7ecf\u8425\u670d\u52a1\u6027",
  operational_status: "\u8fd0\u8425\u72b6\u6001",
  runtime_parameter: "\u8fd0\u884c\u53c2\u6570",
};
export const OPERATORS = {
  all: "\u5168\u90e8\u8fd0\u8425\u5546",
  telecom: "\u4e2d\u56fd\u7535\u4fe1",
  unicom: "\u4e2d\u56fd\u8054\u901a",
  mobile: "\u4e2d\u56fd\u79fb\u52a8",
  broadcast: "\u4e2d\u56fd\u5e7f\u7535",
  other: "\u5176\u4ed6\u8fd0\u8425\u5546",
};
export const CITIES = {
  all: "\u9655\u897f\u7701 \u00b7 \u6837\u672c\u7ad9\u5740",
  xian: "\u897f\u5b89\u5e02",
  baoji: "\u5b9d\u9e21\u5e02",
  xianyang: "\u54b8\u9633\u5e02",
};
export const GRAIN_LABELS = {
  "15m": "15 \u5206\u949f",
  hour: "\u5c0f\u65f6",
  day: "\u65e5",
  week: "\u5468",
  month: "\u6708",
};

export function displayValue(
  value: number | null,
  unit: string,
  precision: number,
): string {
  if (value === null) return "\u2014";
  const divisor: Record<string, number> = {
    B: 1,
    MB: 1e6,
    GB: 1e9,
    GiB: 1073741824,
    second: 1,
    minute: 60,
    hour: 3600,
    Wh: 1,
    kWh: 1000,
    count: 1,
    "%": 0.01,
  };
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0,
  }).format(value / (divisor[unit] ?? 1));
}
export const UNIT_LABELS: Record<string, string> = {
  second: "\u79d2",
  minute: "\u5206\u949f",
  hour: "\u5c0f\u65f6",
  count: "\u6b21 / \u6761",
  B: "B",
  MB: "MB",
  GB: "GB",
  GiB: "GiB",
  "%": "%",
  Wh: "Wh",
  kWh: "kWh",
  state: "\u72b6\u6001",
  device_count: "\u53f0",
};
