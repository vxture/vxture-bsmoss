import type { ReportData } from "./rules.ts";

export function reportTime(iso: string) {
  return new Date(Date.parse(iso) + 8 * 3600000).toISOString().slice(0, 19).replace("T", " ") + " (\u5317\u4eac\u65f6\u95f4)";
}
export const reportLabels: Record<string, string> = {
  business_service: "\u7ecf\u8425\u670d\u52a1", operational_status: "\u8fd0\u8425\u72b6\u6001", runtime_parameter: "\u8fd0\u884c\u53c2\u6570",
  complete: "\u5b8c\u6574", not_applicable: "\u4e0d\u9002\u7528", not_configured: "\u672a\u914d\u7f6e", included: "\u5df2\u914d\u7f6e",
  "service.voice.connected_seconds": "\u901a\u8bdd\u65f6\u957f", "service.voice.attempt_count": "\u547c\u53eb\u5c1d\u8bd5", "service.voice.connected_count": "\u547c\u53eb\u63a5\u901a",
  "service.data.uplink_bytes": "\u4e0a\u884c\u6d41\u91cf", "service.data.downlink_bytes": "\u4e0b\u884c\u6d41\u91cf", "service.data.total_bytes": "\u603b\u6d41\u91cf",
  "service.sms.success_count": "\u77ed\u4fe1\u6210\u529f\u91cf", "status.voice.connection_rate": "\u547c\u53eb\u63a5\u901a\u7387", "status.radio.prb_utilization": "PRB\u5229\u7528\u7387",
  "runtime.energy.site_wh": "\u7ad9\u5740\u7535\u8017", "runtime.device.state": "\u8bbe\u5907\u72b6\u6001", "runtime.environment.temperature_c": "\u73af\u5883\u6e29\u5ea6",
};
function decimal(n: bigint, d: bigint, precision: number) {
  if (d <= 0n) return "\u65e0\u6709\u6548\u5206\u6bcd";
  const negative = n < 0n, absolute = negative ? -n : n, scale = 10n ** BigInt(precision);
  const rounded = (absolute * scale * 2n + d) / (2n * d), text = rounded.toString().padStart(precision + 1, "0");
  return (negative && rounded !== 0n ? "-" : "") + (precision ? text.slice(0, -precision) + "." + text.slice(-precision) : text);
}
export function reportValueText(data: ReportData, displayUnit: string, precision: number): string {
  const distribution = reportDistributionRows(data, displayUnit, precision);
  if (distribution) return distribution.title + ": " + distribution.rows.map(r => r.label + "=" + r.value).join("; ");
  const value = data.kind === "aggregate" ? data.publication?.result.value : data.kind === "rollup" ? data.result.value : null;
  if (!value) {
    const result = data.kind === "aggregate" ? data.publication?.result : data.kind === "rollup" ? data.result : null;
    return result?.unit === "ratio" && result.completeness === "complete" ? "\u65e0\u6709\u6548\u5206\u6bcd\uff08\u89c1\u8ba1\u91cf\u4f9d\u636e\uff09" : "\u65e0\u53ef\u7528\u503c";
  }
  if (value.kind === "integer") {
    const divisors: Record<string, bigint> = { B: 1n, MB: 1000000n, GB: 1000000000n, GiB: 1073741824n, second: 1n, minute: 60n, hour: 3600n, Wh: 1n, kWh: 1000n, count: 1n };
    const divisor = divisors[displayUnit]; if (!divisor) throw Error("invalid_export_unit");
    return (divisor === 1n ? value.value : "\u2248 " + decimal(BigInt(value.value), divisor, precision)) + " " + displayUnit;
  }
  if (value.kind === "ratio") return "\u2248 " + decimal(BigInt(value.numerator) * 100n, BigInt(value.denominator), precision) + "% (" + value.numerator + " / " + value.denominator + ")";
  if (value.kind === "gauge") {
    const scale = 10n ** BigInt(value.scale), mean = decimal(BigInt(value.mean.numerator), BigInt(value.mean.denominator) * scale, precision);
    return (value.mode === "sample_mean" ? "\u6837\u672c\u5747\u503c" : "\u65f6\u957f\u52a0\u6743\u5747\u503c") + " \u2248 " + mean + " degC; min " + decimal(BigInt(value.minimum.unscaled), scale, value.scale) + " @ " + reportTime(value.minimum.observedAt) + "; max " + decimal(BigInt(value.maximum.unscaled), scale, value.scale) + " @ " + reportTime(value.maximum.observedAt);
  }
  if (displayUnit === "device_count") return "\u671f\u672b\u8bbe\u5907\u5206\u5e03: " + value.endState + "=1";
  return "\u5404\u72b6\u6001\u65f6\u957f(" + (displayUnit === "second" ? "second" : "ms") + "): " + Object.entries(value.durationMilliseconds).map(([state, duration]) =>
    state + "=" + (displayUnit === "second" ? decimal(BigInt(duration), 1000n, precision) : duration)).join("; ") + "; \u5df2\u77e5\u8f6c\u6362=" + value.knownTransitions + "; \u671f\u672b=" + value.endState;
}

export function reportDistributionRows(data: ReportData, displayUnit: string, precision: number) {
  if (data.kind !== "rollup" || !("distribution" in data.result)) return null;
  const d = data.result.distribution;
  if (d.kind === "device_states") {
    const names: Record<string, string> = { running: "\u8fd0\u884c", standby: "\u5f85\u673a", fault: "\u6545\u969c", offline: "\u79bb\u7ebf", maintenance: "\u68c0\u4fee", unknown: "\u672a\u77e5" };
    const seconds = displayUnit === "second";
    return { title: seconds ? "\u8bbe\u5907\u72b6\u6001\u7d2f\u8ba1\u65f6\u957f" : "\u671f\u672b\u8bbe\u5907\u5206\u5e03",
      rows: Object.entries(d.endCounts).map(([state, count]) => ({ label: names[state] ?? state,
        value: seconds ? decimal(BigInt(d.deviceMilliseconds[state as keyof typeof d.deviceMilliseconds]), 1000n, precision) + " \u8bbe\u5907\u79d2" : count + " \u53f0" })) };
  }
  const threshold = (v: string) => decimal(BigInt(v), 10n ** BigInt(d.scale), d.scale);
  return { title: (d.mode === "sample_mean" ? "\u8bbe\u5907\u6837\u672c\u5747\u6e29" : "\u8bbe\u5907\u65f6\u957f\u52a0\u6743\u5747\u6e29") + "\u5206\u5e03",
    rows: [...d.bins.map(b => ({ label: b.lowerInclusive === null ? "< " + threshold(b.upperExclusive!) + " degC"
      : b.upperExclusive === null ? ">= " + threshold(b.lowerInclusive) + " degC" : "[" + threshold(b.lowerInclusive) + ", " + threshold(b.upperExclusive) + ") degC", value: b.deviceCount + " \u53f0" })),
    { label: "\u672a\u77e5", value: d.unknownDevices + " \u53f0" }] };
}
