import { resolveMeasurementAccess, type AccessPorts, type AccessPlane } from "./resolve.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { normalizeRollupQuery, type ObjectRollupReader, type RollupQuery } from "../aggregation/object-rollup.ts";

function scopeFingerprint(s: MeasurementScope) {
  return fingerprintOf({ ...s, sourceIds: [...s.sourceIds].sort(), stationIds: [...s.stationIds].sort(), metricKeys: [...s.metricKeys].sort(),
    serviceIds: [...s.serviceIds].sort(), deviceIds: [...s.deviceIds].sort() });
}
export function createAuthorizedObjectRollup(ports: AccessPorts, readers: { create(scope: MeasurementScope): ObjectRollupReader }, plane: AccessPlane) {
  const now = ports.now ?? Date.now;
  return Object.freeze({ async read(raw: RollupQuery) {
    const query = normalizeRollupQuery(raw), access = await resolveMeasurementAccess(ports, "view", plane);
    if (access.expiresAt <= now()) throw Error("access_expired");
    const reader = readers.create(access.scope);
    if (reader.workspaceId !== access.context.workspaceId) throw Error("workspace_mismatch");
    const result = await reader.read(query);
    if (access.expiresAt <= now()) throw Error("access_expired");
    const current = await resolveMeasurementAccess(ports, "view", plane);
    if (current.context.workspaceId !== access.context.workspaceId || current.context.sub !== access.context.sub ||
        scopeFingerprint(current.scope) !== scopeFingerprint(access.scope)) throw Error("permission_denied");
    if (current.expiresAt <= now()) throw Error("access_expired");
    return result;
  } });
}
