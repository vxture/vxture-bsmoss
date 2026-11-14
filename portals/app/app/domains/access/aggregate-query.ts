import { resolveMeasurementAccess, type AccessPorts, type AccessPlane } from "./resolve.ts";
import { normalizeAggregateQuery, type AggregateQueryReader, type AggregateQuery } from "../aggregation/query.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";

function scopeFingerprint(scope: MeasurementScope) {
  return fingerprintOf({ ...scope, sourceIds: [...scope.sourceIds].sort(), stationIds: [...scope.stationIds].sort(), metricKeys: [...scope.metricKeys].sort(),
    serviceIds: [...scope.serviceIds].sort(), deviceIds: [...scope.deviceIds].sort() });
}
// A query needs view permission, never aggregate write permission. The
// composition root constructs a new finite reader for each verified call.
export function createAuthorizedAggregateQuery(ports: AccessPorts, readers: { create(scope: MeasurementScope): AggregateQueryReader }, plane: AccessPlane) {
  const now = ports.now ?? Date.now;
  return Object.freeze({ async read(raw: AggregateQuery) {
    const input = normalizeAggregateQuery(raw), access = await resolveMeasurementAccess(ports, "view", plane);
    if (access.expiresAt <= now()) throw Error("access_expired");
    const reader = readers.create(access.scope);
    if (reader.workspaceId !== access.context.workspaceId) throw Error("workspace_mismatch");
    const result = await reader.read(input);
    if (access.expiresAt <= now()) throw Error("access_expired");
    const current = await resolveMeasurementAccess(ports, "view", plane);
    if (current.context.workspaceId !== access.context.workspaceId || current.context.sub !== access.context.sub ||
        scopeFingerprint(current.scope) !== scopeFingerprint(access.scope)) throw Error("permission_denied");
    if (current.expiresAt <= now()) throw Error("access_expired");
    return result;
  } });
}
