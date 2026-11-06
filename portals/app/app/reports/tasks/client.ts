import { ReportClientError } from "../../reports/client";
import { jobLabel } from "../../operations/aggregation/client";
const labels: Record<string, string> = {
  generation: "\u5468\u671f\u751f\u6210", export: "\u5bfc\u51fa", registration_paused: "\u767b\u8bb0\u5df2\u6682\u505c", registration_changed: "\u767b\u8bb0\u5df2\u6362\u7248",
  report_binding_unavailable: "\u62a5\u544a\u6570\u636e\u7ed1\u5b9a\u4e0d\u53ef\u7528", storage_failed: "\u5b58\u50a8\u672a\u5b8c\u6210", report_not_active: "\u53d1\u5e03\u5df2\u5931\u6548",
  report_stale: "\u62a5\u544a\u6570\u636e\u5df2\u53d8\u5316", report_incomplete: "\u62a5\u544a\u6570\u636e\u672a\u5b8c\u6574", export_too_large: "\u5236\u54c1\u8d85\u51fa\u5927\u5c0f\u9650\u5236",
  export_renderer_unavailable: "\u6e32\u67d3\u7248\u672c\u4e0d\u53ef\u7528", render_failed: "\u6e32\u67d3\u672a\u5b8c\u6210", inserted: "\u65b0\u4fee\u8ba2", duplicate: "\u590d\u7528\u5df2\u6709\u4fee\u8ba2",
};
export const reportJobLabel = (value: string) => labels[value] ?? jobLabel(value);
export function reportJobError(error: unknown) {
  if (error instanceof ReportClientError) {
    if (error.status === 401) return "\u767b\u5f55\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u3002";
    if (error.status === 403) return "\u5f53\u524d\u8d26\u53f7\u65e0\u4efb\u52a1\u67e5\u770b\u6743\u9650\u3002";
    if (error.status === 404) return "\u4efb\u52a1\u4e0d\u53ef\u7528\u6216\u4e0d\u5728\u6388\u6743\u8303\u56f4\u5185\u3002";
  }
  return "\u6682\u65f6\u65e0\u6cd5\u8bfb\u53d6\u4efb\u52a1\uff0c\u8bf7\u5237\u65b0\u91cd\u8bd5\u3002";
}
