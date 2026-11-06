import { ReportClientError } from "../../reports/client";
export const jobLabels: Record<string, string> = {
  all: "\u5168\u90e8", pending: "\u7b49\u5f85", leased: "\u6267\u884c\u4e2d", succeeded: "\u5df2\u5b8c\u6210", dead: "\u5df2\u7ec8\u6b62",
  ready: "\u53ef\u6267\u884c", delayed: "\u7b49\u5f85\u91cd\u8bd5", running: "\u6267\u884c\u4e2d", lease_expired: "\u79df\u7ea6\u5df2\u5230\u671f", terminal: "\u7ec8\u6001",
  retry: "\u91cd\u8bd5", expired: "\u79df\u7ea6\u8d85\u65f6", source_unavailable: "\u6765\u6e90\u4f9d\u636e\u4e0d\u53ef\u7528", execution_failed: "\u6267\u884c\u672a\u5b8c\u6210",
  serialization_conflict: "\u5e76\u53d1\u51b2\u7a81", database_unavailable: "\u6570\u636e\u5e93\u6682\u4e0d\u53ef\u7528", lease_expired_code: "\u79df\u7ea6\u5df2\u8fc7\u671f",
  day: "\u65e5", week: "\u5468", month: "\u6708", hour: "\u5c0f\u65f6", "15m": "15\u5206\u949f", "5m": "5\u5206\u949f",
  "service.data.uplink_bytes": "\u4e0a\u884c\u6d41\u91cf", "service.data.downlink_bytes": "\u4e0b\u884c\u6d41\u91cf", "service.data.total_bytes": "\u603b\u6d41\u91cf",
  "status.voice.connection_rate": "\u8bed\u97f3\u63a5\u901a\u7387", "runtime.device.state": "\u8bbe\u5907\u72b6\u6001", "runtime.environment.temperature_c": "\u73af\u5883\u6e29\u5ea6", "runtime.energy.site_wh": "\u7ad9\u7ea7\u7535\u8017",
};
export const jobLabel = (value: string) => jobLabels[value] ?? value;
export function jobError(error: unknown): string {
  if (error instanceof ReportClientError) {
    if (error.status === 401) return "\u767b\u5f55\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u3002";
    if (error.status === 403) return "\u5f53\u524d\u8d26\u53f7\u65e0\u6b64\u64cd\u4f5c\u6743\u9650\u3002";
    if (error.status === 404) return "\u4efb\u52a1\u4e0d\u53ef\u7528\u6216\u4e0d\u5728\u6388\u6743\u8303\u56f4\u5185\u3002";
    if (error.status === 409) return "\u4efb\u52a1\u72b6\u6001\u5df2\u53d8\u5316\uff0c\u8bf7\u5237\u65b0\u540e\u6838\u5bf9\u5904\u7f6e\u8bb0\u5f55\u3002";
    if ([400, 413, 415].includes(error.status)) return "\u8bf7\u6838\u5bf9\u590d\u6838\u4f9d\u636e\u548c\u547d\u4ee4\u53c2\u6570\u3002";
  }
  return "\u6682\u672a\u786e\u8ba4\u64cd\u4f5c\u7ed3\u679c\u3002\u8bf7\u67e5\u8be2\u5904\u7f6e\u8bb0\u5f55\uff0c\u6216\u4f7f\u7528\u539f\u547d\u4ee4\u91cd\u8bd5\u3002";
}
