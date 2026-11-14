import { decodeJobCursor } from "../supervision/jobs.ts";
export interface UpdateListQuery { limit: number; after?: string }
export function updateListQuery(raw: UpdateListQuery) {
  if (!raw || Array.isArray(raw) || Object.keys(raw).some(k => !["limit", "after"].includes(k)) || !Number.isSafeInteger(raw.limit) || raw.limit < 1 || raw.limit > 10 ||
      raw.after !== undefined && typeof raw.after !== "string") throw Error("invalid_update_query");
  try { if (raw.after !== undefined && decodeJobCursor(raw.after).status !== "all") throw Error("invalid_update_query"); } catch { throw Error("invalid_update_query"); }
  return structuredClone(raw);
}
export function updateListFromUrl(url: URL) {
  const p = url.searchParams;
  if (url.search.length > 10000 || [...p.keys()].some(k => !["limit", "after"].includes(k)) || p.getAll("limit").length > 1 || p.getAll("after").length > 1 ||
      p.has("limit") && !/^(?:[1-9]|10)$/.test(p.get("limit")!)) throw Error("invalid_update_query");
  return updateListQuery({ limit: Number(p.get("limit") ?? "10"), ...(p.has("after") ? { after: p.get("after")! } : {}) });
}
