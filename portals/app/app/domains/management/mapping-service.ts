import { resolveMeasurementAccess, type AccessPorts } from "../access/resolve.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { reportScope } from "../reports/rules.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import type { MappingReader } from "./mapping-reader.ts";
import { mappingQuery } from "./mapping-rules.ts";
import { sourceIdentity } from "./source-rules.ts";
export function mappingManagement(ports: AccessPorts, readers: { create(scope: MeasurementScope): MappingReader }) {
  const now = ports.now ?? Date.now;
  async function run<T>(read: (reader: MappingReader) => Promise<T>) {
    const first = await resolveMeasurementAccess(ports, "mappings_view", "interactive");
    const reader = readers.create(first.scope);
    if (reader.workspaceId !== first.context.workspaceId) throw Error("workspace_mismatch");
    if (first.expiresAt <= now()) throw Error("access_expired");
    const result = await read(reader);
    if (first.expiresAt <= now()) throw Error("access_expired");
    const current = await resolveMeasurementAccess(ports, "mappings_view", "interactive");
    if (current.context.workspaceId !== first.context.workspaceId || current.context.sub !== first.context.sub || fingerprintOf(reportScope(current.scope)) !== fingerprintOf(reportScope(first.scope))) throw Error("permission_denied");
    if (current.expiresAt <= now()) throw Error("access_expired");
    return result;
  }
  return Object.freeze({ list: (params: URLSearchParams) => run(r => r.list(mappingQuery(params))),
    read: async (id: string, params: URLSearchParams) => {
      const result = await run(r => { if (params.size) throw Error("invalid_management_query"); return r.read(sourceIdentity(id)); });
      if (!result) throw Error("mapping_unavailable"); return result;
    } });
}
