import { decodeJobCursor } from "../supervision/jobs.ts";
export interface IntakeListQuery { limit: number; after?: string }
export function intakeListQuery(raw: IntakeListQuery) {
  if (!raw || Array.isArray(raw) || Object.keys(raw).some(k => !["limit", "after"].includes(k)) || !Number.isSafeInteger(raw.limit) || raw.limit < 1 || raw.limit > 10 ||
      raw.after !== undefined && typeof raw.after !== "string") throw Error("invalid_intake_query");
  try { if (raw.after !== undefined) { const c = decodeJobCursor(raw.after); if (c.status !== "all" || !/^[a-f0-9]{64}$/.test(c.jobId)) throw Error(); } } catch { throw Error("invalid_intake_query"); }
  return structuredClone(raw);
}
export function intakeListFromUrl(url: URL) {
  const p = url.searchParams;
  if (url.search.length > 10000 || [...p.keys()].some(k => !["limit", "after"].includes(k)) || p.getAll("limit").length > 1 || p.getAll("after").length > 1 ||
      p.has("limit") && !/^(?:[1-9]|10)$/.test(p.get("limit")!)) throw Error("invalid_intake_query");
  return intakeListQuery({ limit: Number(p.get("limit") ?? "10"), ...(p.has("after") ? { after: p.get("after")! } : {}) });
}
