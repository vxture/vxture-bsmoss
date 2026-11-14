import { reportScope, assertReportScope } from "../reports/rules.ts";
import type { MeasurementScope } from "../measurements/store.ts";
export interface DirectoryQuery { search: string; status: "all" | "active" | "inactive"; after?: string; limit: number }
export interface JurisdictionQuery { search: string; city: string; after?: string; limit: number }
export interface MemberRole { code: string; name: string; permissions: string[] }
export interface MemberRecord { id: string; sub: string; displayName: string; status: "active" | "inactive"; expiresAt: string; scope: MeasurementScope; roles: MemberRole[] }
export type MemberSummary = Omit<MemberRecord, "scope"> & { counts: Record<"sources" | "stations" | "services" | "devices" | "metrics", number>; siteParameters: boolean };
export interface StationRecord { id: string; name: string; province: string; city: string; services: number; devices: number }
export interface ManagementPage<T> { items: T[]; next: string | null; capturedAt: string }
export const uuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text = (v: string) => v.length <= 2048 && v.trim() === v && v !== "*" && !/[\x00-\x1f\x7f]/.test(v);
function queryBase(params: URLSearchParams, allowed: string[]) {
 for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) throw Error("invalid_management_query");
 const search = params.get("search") ?? "", after = params.get("after") ?? undefined, rawLimit = params.get("limit") ?? "20";
 if (search.length > 100 || !text(search) || after !== undefined && (!after || !text(after)) || !/^[1-9][0-9]?$/.test(rawLimit) || +rawLimit > 50) throw Error("invalid_management_query");
 return { search, ...(after === undefined ? {} : { after }), limit: +rawLimit };
}
export function directoryQuery(p: URLSearchParams): DirectoryQuery {
 const q = queryBase(p, ["search", "status", "after", "limit"]), status = p.get("status") ?? "all";
 if (!["all", "active", "inactive"].includes(status) || q.after && !uuid(q.after)) throw Error("invalid_management_query");
 return { ...q, status: status as DirectoryQuery["status"] };
}
export function jurisdictionQuery(p: URLSearchParams): JurisdictionQuery {
 const q = queryBase(p, ["search", "city", "after", "limit"]), city = p.get("city") ?? "all";
 if (city !== "all" && !/^61[0-9]{4}$/.test(city)) throw Error("invalid_management_query");
 return { ...q, city };
}
export function memberIdentity(id: string) { if (!uuid(id)) throw Error("invalid_management_query"); return id; }
export function memberRecord(row: any, viewer: MeasurementScope): MemberRecord {
 const scope = reportScope(row.scope); assertReportScope(viewer, scope);
 if (!uuid(row.id) || typeof row.sub !== "string" || !row.sub || !text(row.sub) || !["active", "inactive"].includes(row.status) || !Number.isFinite(Date.parse(row.expires_at)) || !Array.isArray(row.roles)) throw Error("invalid_management_record");
 const roles: MemberRole[] = row.roles.map((r: any) => {
  if (typeof r.code !== "string" || typeof r.name !== "string" || !Array.isArray(r.permissions) || r.permissions.some((p: unknown) => typeof p !== "string")) throw Error("invalid_management_record");
  return { code: r.code, name: r.name, permissions: [...new Set<string>(r.permissions)].sort() };
 });
 return { id: row.id, sub: row.sub, displayName: row.display_name || row.sub, status: row.status, expiresAt: new Date(row.expires_at).toISOString(), scope, roles };
}
export function memberSummary({ scope, ...record }: MemberRecord): MemberSummary {
 return { ...record, counts: { sources: scope.sourceIds.length, stations: scope.stationIds.length, services: scope.serviceIds.length, devices: scope.deviceIds.length, metrics: scope.metricKeys.length }, siteParameters: scope.allowSiteParameters };
}
