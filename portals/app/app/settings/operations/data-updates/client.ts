import { ReportClientError } from "../../../reports/client";
import { validTaskId } from "../../../domains/data-updates/contracts";
export const phases = { dispatching: "\u6b63\u5728\u5904\u7406\u589e\u91cf", recomputing: "\u6b63\u5728\u91cd\u7b97", failed: "\u9700\u8981\u5904\u7f6e", processed: "\u5904\u7406\u5b8c\u6210" };
export const failures: Record<string, string> = {
  serialization_conflict: "\u5e76\u53d1\u51b2\u7a81", database_unavailable: "\u5b58\u50a8\u6682\u4e0d\u53ef\u7528", capacity_limit: "\u8d85\u51fa\u5904\u7406\u5bb9\u91cf",
  source_unavailable: "\u6765\u6e90\u4f9d\u636e\u4e0d\u53ef\u7528", evidence_invalid: "\u8bc1\u636e\u6821\u9a8c\u672a\u901a\u8fc7", execution_failed: "\u91cd\u7b97\u672a\u5b8c\u6210", lease_expired: "\u6267\u884c\u79df\u7ea6\u5df2\u8fc7\u671f",
};
export function updateError(e: unknown) {
  if (e instanceof ReportClientError) {
    if (e.status === 401) return "\u767b\u5f55\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u3002";
    if (e.status === 403) return "\u5f53\u524d\u8d26\u53f7\u6ca1\u6709\u6b64\u64cd\u4f5c\u6743\u9650\u3002";
    if (e.status === 404) return "\u4efb\u52a1\u4e0d\u53ef\u7528\u6216\u4e0d\u5728\u5f53\u524d\u6388\u6743\u8303\u56f4\u3002";
    if (e.status === 409) return "\u4efb\u52a1\u6216\u914d\u7f6e\u5df2\u53d8\u5316\uff0c\u8bf7\u91cd\u65b0\u6838\u5bf9\u3002";
  }
  return "\u6682\u65f6\u65e0\u6cd5\u786e\u8ba4\u7ed3\u679c\u3002\u8bf7\u91cd\u65b0\u67e5\u8be2\uff0c\u91cd\u8bd5\u64cd\u4f5c\u9700\u4f7f\u7528\u539f\u547d\u4ee4\u3002";
}
export function taskFromUrl(url: string) {
  const p = new URL(url).searchParams;
  if (!p.has("task")) return null;
  const id = p.get("task"); if (p.getAll("task").length !== 1 || !validTaskId(id)) throw Error("invalid_task_link"); return id;
}
export function taskHref(id: string) {
  if (!validTaskId(id)) throw Error("invalid_task_link"); return "/settings/operations/data-updates?task=" + id;
}
export async function updateJson<T>(path: string, signal: AbortSignal, body?: unknown): Promise<T> {
  const timed = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
  const r = await fetch(path, { signal: timed, cache: "no-store", credentials: "same-origin", ...(body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
  if (!r.ok) throw new ReportClientError(r.status, "UPDATE_UNAVAILABLE");
  return r.json();
}
