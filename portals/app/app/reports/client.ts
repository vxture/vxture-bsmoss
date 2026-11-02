export class ReportClientError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
export async function reportJson<T>(url: string, signal: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store", credentials: "same-origin", ...(body === undefined ? {} : {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }) });
  if (!response.ok) {
    let code = "REPORT_UNAVAILABLE";
    try { const error = await response.json(); if (typeof error.code === "string") code = error.code; } catch { /* bounded user message */ }
    throw new ReportClientError(response.status, code);
  }
  return response.json();
}
export function reportErrorText(error: unknown): string {
  if (error instanceof ReportClientError) {
    if (error.status === 401) return "\u767b\u5f55\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u3002";
    if (error.status === 403) return "\u5f53\u524d\u8d26\u53f7\u65e0\u6b64\u64cd\u4f5c\u6743\u9650\u3002";
    if (error.status === 404) return "\u5bf9\u8c61\u4e0d\u53ef\u7528\u6216\u4e0d\u5728\u6388\u6743\u8303\u56f4\u5185\u3002";
    if (error.status === 409) return "\u6570\u636e\u6216\u53d1\u5e03\u7248\u672c\u5df2\u53d8\u5316\uff0c\u8bf7\u5237\u65b0\u540e\u6838\u5bf9\u518d\u64cd\u4f5c\u3002";
    if (error.status === 400 || error.status === 413 || error.status === 415) return "\u8bf7\u6838\u5bf9\u6a21\u677f\u3001\u65f6\u95f4\u548c\u547d\u4ee4\u53c2\u6570\u3002";
  }
  return "\u64cd\u4f5c\u6682\u672a\u5b8c\u6210\u3002\u53ef\u5237\u65b0\u67e5\u8be2\u7ed3\u679c\uff0c\u6216\u7528\u540c\u4e00\u547d\u4ee4\u91cd\u8bd5\u3002";
}
export const reportStatusLabels: Record<string, string> = {
  complete: "\u5b8c\u6574", incomplete: "\u4e0d\u5b8c\u6574", current: "\u5f53\u524d\u4e00\u81f4", stale: "\u5df2\u8fc7\u671f", preliminary: "\u5f85\u786e\u8ba4",
  missing: "\u7f3a\u6570", partial: "\u90e8\u5206\u6570\u636e", not_connected: "\u672a\u63a5\u5165", not_published: "\u672a\u53d1\u5e03\u7ed3\u679c",
  authority_unavailable: "\u6765\u6e90\u4f9d\u636e\u4e0d\u53ef\u7528", dependencies_incomplete: "\u9010\u65e5\u4f9d\u636e\u4e0d\u5b8c\u6574", not_applicable: "\u4e0d\u9002\u7528",
  day: "\u65e5\u62a5", week: "\u5468\u62a5", month: "\u6708\u62a5", pending: "\u7b49\u5f85\u5904\u7406", succeeded: "\u5df2\u751f\u6210\u6587\u4ef6", dead: "\u5df2\u7ec8\u6b62",
  report_not_active: "\u5f53\u524d\u53d1\u5e03\u5df2\u64a4\u56de\u6216\u66ff\u6362", report_stale: "\u53d1\u5e03\u6570\u636e\u5df2\u8fc7\u671f", report_incomplete: "\u62a5\u544a\u6570\u636e\u4e0d\u5b8c\u6574",
  export_renderer_unavailable: "\u62a5\u544a\u6e32\u67d3\u6682\u4e0d\u53ef\u7528", export_too_large: "\u62a5\u544a\u8d85\u51fa\u5bfc\u51fa\u5927\u5c0f\u4e0a\u9650",
};
export const reportStatus = (value: string) => reportStatusLabels[value] ?? value;
