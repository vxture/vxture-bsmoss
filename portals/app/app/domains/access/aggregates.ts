import { refKey } from "../catalog/registry.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { publishIntervalAggregate } from "../aggregation/service.ts";
import type { AggregateSnapshotReader, AggregateTarget } from "../aggregation/snapshot.ts";
import type { AggregateScope, AggregateStore } from "../aggregation/store.ts";
import { positiveRevision } from "../aggregation/intervals.ts";
import { resolveMeasurementAccess, type AccessPlane, type AccessPorts } from "./resolve.ts";

export interface AggregatePorts {
  reader(scope: MeasurementScope): AggregateSnapshotReader;
  store(scope: AggregateScope): AggregateStore;
}
export interface AggregateRequest extends AggregateTarget { expectedRevision: string | null }
function fields(input: unknown, allowed: readonly string[]) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) throw new Error("untrusted_request_field");
}
// Server-only facade, re-resolving platform/local gates on every invocation.
export function createAuthorizedAggregates(ports: AccessPorts, adapters: AggregatePorts, plane: AccessPlane) {
  const now = ports.now ?? Date.now;
  return Object.freeze({
    async recompute(input: AggregateRequest) {
      const request = structuredClone(input);
      fields(request, ["sourceId", "mappingId", "metric", "grain", "at", "expectedRevision"]);
      fields(request.metric, ["code", "version"]);
      if (request.expectedRevision !== null) positiveRevision(request.expectedRevision);
      const access = await resolveMeasurementAccess(ports, "aggregate", plane);
      if (access.expiresAt <= now()) throw new Error("access_expired");
      const reader = adapters.reader(access.scope);
      if (reader.workspaceId !== access.context.workspaceId) throw new Error("workspace_mismatch");
      const { expectedRevision, ...target } = request;
      const snapshot = await reader.load(target);
      if (snapshot.plan.workspaceId !== access.context.workspaceId) throw new Error("workspace_mismatch");
      if (access.expiresAt <= now()) throw new Error("access_expired");
      const store = adapters.store({ workspaceId: access.context.workspaceId, series: [{ sourceId: snapshot.plan.sourceId,
        subjectKey: snapshot.plan.subjectKey, metricKey: refKey(snapshot.plan.metric) }] });
      if (access.expiresAt <= now()) throw new Error("access_expired");
      return publishIntervalAggregate(access.context, store, snapshot.plan, snapshot.inputs, expectedRevision);
    },
  });
}
