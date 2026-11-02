import {
  persistMeasurement,
  listMeasurements,
} from "../measurements/service.ts";
import type {
  MeasurementDraft,
  MeasurementFilter,
  MeasurementStore,
  MeasurementScope,
} from "../measurements/store.ts";
import {
  resolveMeasurementAccess,
  type AccessPorts,
  type AccessPlane,
} from "./resolve.ts";

export type UnattributedDraft = Omit<
  MeasurementDraft,
  "workspaceId" | "quality"
> & {
  quality: Omit<MeasurementDraft["quality"], "decidedBy">;
};
export interface ScopedMeasurementStoreFactory {
  // Composition example: scope => new PgMeasurementStore(pool, scope, registry).
  // Never return a shared store constructed with some other request's scope.
  create(scope: MeasurementScope): MeasurementStore;
}
function fields(input: object, allowed: readonly string[]) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowed.includes(key))
  )
    throw new Error("untrusted_request_field");
}

/** Server-only facade. The request cannot supply identity, grants or row scope. */
export function createAuthorizedMeasurements(
  ports: AccessPorts,
  stores: ScopedMeasurementStoreFactory,
  plane: AccessPlane,
) {
  const now = ports.now ?? Date.now;
  return Object.freeze({
    async list(input: MeasurementFilter) {
      const filter = structuredClone(input);
      fields(filter, ["stationId", "metric", "from", "to", "limit", "afterId"]);
      const access = await resolveMeasurementAccess(ports, "view", plane);
      const store = stores.create(access.scope);
      if (access.expiresAt <= now()) throw new Error("access_expired");
      return listMeasurements(access.context, store, filter);
    },
    async append(input: UnattributedDraft) {
      const draft = structuredClone(input);
      if (
        Object.hasOwn(draft, "workspaceId") ||
        !draft.quality ||
        Object.hasOwn(draft.quality, "decidedBy")
      )
        throw new Error("untrusted_identity_field");
      fields(draft, [
        "sourceId",
        "eventId",
        "revision",
        "previousRevision",
        "payloadSha256",
        "payloadUri",
        "occurredAt",
        "metric",
        "componentKey",
        "stationId",
        "mappingId",
        "transformVersion",
        "periodStart",
        "periodEnd",
        "value",
        "quality",
      ]);
      fields(draft.quality, ["status", "ruleVersion", "reason"]);
      const access = await resolveMeasurementAccess(ports, "ingest", plane);
      const store = stores.create(access.scope);
      if (access.expiresAt <= now()) throw new Error("access_expired");
      return persistMeasurement(access.context, store, {
        ...draft,
        workspaceId: access.context.workspaceId,
        quality: { ...draft.quality, decidedBy: access.context.sub },
      });
    },
  });
}
