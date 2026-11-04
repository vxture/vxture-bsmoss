import type { BusinessMetric } from "../domains/map-demo/period-contribution-rules";
export const metricNames = { all: "\u5168\u90e8\u6307\u6807", bytes: "\u6d41\u91cf", voiceSeconds: "\u901a\u8bdd", sms: "\u77ed\u4fe1" };
export const kindNames = { up: "\u7528\u91cf\u7a81\u589e", down: "\u7528\u91cf\u7a81\u964d", from_zero: "\u4ece\u96f6\u65b0\u589e", zero_run: "\u6301\u7eed\u96f6\u91cf", missing: "\u7f3a\u6570", insufficient: "\u57fa\u7ebf\u4e0d\u8db3" };
export const categoryNames = { all: "\u5168\u90e8\u7ebf\u7d22", business: "\u4e1a\u52a1\u7ebf\u7d22", quality: "\u6570\u636e\u8d28\u91cf", insufficient: "\u6761\u4ef6\u4e0d\u8db3" };
export const qualityNames = { verified: "\u6709\u6548", missing: "\u7f3a\u5931", pending: "\u5f85\u6838\u9a8c", rejected: "\u5df2\u9694\u79bb" };
export const reasonNames: Record<string, string> = { source_gap: "\u6765\u6e90\u7a97\u53e3\u7f3a\u5931", verification_pending: "\u8f93\u5165\u5f85\u8d28\u91cf\u6838\u9a8c", quality_rejected: "\u8f93\u5165\u5df2\u8d28\u91cf\u9694\u79bb", history_unavailable: "\u5386\u53f2\u6837\u672c\u4e0d\u53ef\u7528" };
export const statusNames = { all: "\u5168\u90e8\u6838\u9a8c\u72b6\u6001", open: "\u5f85\u6838\u9a8c", awaiting_review: "\u5f85\u590d\u6838", closed: "\u5df2\u590d\u6838" };
export function quantity(value: string | null, metric: BusinessMetric, denominator = 1): string {
  if (value === null) return "\u2014";
  const scale = metric === "bytes" ? 1073741824n : metric === "voiceSeconds" ? 60n : 1n, unit = metric === "bytes" ? "GiB" : metric === "voiceSeconds" ? "\u5206\u949f" : "\u6761";
  const input = BigInt(value), negative = input < 0n, unsigned = negative ? -input : input;
  const scaled = (unsigned * 100n + scale * BigInt(denominator) / 2n) / (scale * BigInt(denominator));
  return (negative ? "-" : "") + (scaled / 100n).toLocaleString("zh-CN") + "." + String(scaled % 100n).padStart(2, "0") + " " + unit;
}
export function deviation(current: string | null, reference: string | null) {
  if (current === null || reference === null) return "\u4e0d\u53ef\u5224\u5b9a";
  if (BigInt(reference) === 0n) return "\u53c2\u8003\u4e3a\u96f6";
  const delta = BigInt(current) * 2n - BigInt(reference), value = delta * 1000n / BigInt(reference), absolute = value < 0n ? -value : value;
  return (delta > 0n ? "+" : delta < 0n ? "-" : "") + String(absolute / 10n) + "." + String(absolute % 10n) + "%";
}
const clock = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
export const timeLabel = (iso: string) => clock.format(new Date(iso));
export const windowLabel = (start: string, end: string) => timeLabel(start) + " \u2013 " + timeLabel(end).slice(11);
