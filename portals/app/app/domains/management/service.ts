import type { AccessPorts } from "../access/resolve.ts";
import { resolveMeasurementAccess } from "../access/resolve.ts";
import { reportScope } from "../reports/rules.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import type { ManagementReader } from "./pg-reader.ts";
import { directoryQuery, jurisdictionQuery, memberIdentity } from "./rules.ts";
export function managementService(ports: AccessPorts, readers: { create(scope: MeasurementScope): ManagementReader }) {
 const now = ports.now ?? Date.now;
 async function run<T>(operation: "members_view" | "jurisdiction_view", read: (r: ManagementReader) => Promise<T>) {
  const access = await resolveMeasurementAccess(ports,operation,"interactive");
  const reader = readers.create(access.scope); if (reader.workspaceId!==access.context.workspaceId) throw Error("workspace_mismatch");
  if (access.expiresAt<=now()) throw Error("access_expired"); const result = await read(reader);
  if (access.expiresAt<=now()) throw Error("access_expired");
  const current = await resolveMeasurementAccess(ports,operation,"interactive");
  if (current.context.workspaceId!==access.context.workspaceId || current.context.sub!==access.context.sub || fingerprintOf(reportScope(current.scope))!==fingerprintOf(reportScope(access.scope))) throw Error("permission_denied");
  if (current.expiresAt<=now()) throw Error("access_expired"); return result;
 }
 return Object.freeze({
  members: (params: URLSearchParams) => run("members_view",r=>r.members(directoryQuery(params))),
  member: async (id: string, params = new URLSearchParams()) => { const record=await run("members_view",r=>{ if(params.size)throw Error("invalid_management_query"); return r.member(memberIdentity(id)); }); if(!record)throw Error("member_unavailable");return record; },
  jurisdiction: (params: URLSearchParams) => run("jurisdiction_view",r=>r.jurisdiction(jurisdictionQuery(params))),
 });
}
