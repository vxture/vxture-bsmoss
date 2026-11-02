import { authorize, type AccessContext } from "../shared/model.ts";
import type { MeasurementScope } from "../measurements/store.ts";

// Internal ports, not platform wire schemas. Only an RP that has verified the
// signature, issuer, audience, lifetime and server session may implement C1.
export interface VerifiedIdentity {
  sub: string;
  activeWorkspace: string | null;
  accountStatus: string | null;
  governanceRoles: readonly string[];
  expiresAt: number;
}
export interface Coverage {
  workspaceId: string;
  product: string;
  tier: string | null;
  bundled: boolean;
  expiresAt: number;
}
export interface LocalGrant {
  workspaceId: string;
  sub: string;
  active: boolean;
  permissions: readonly string[];
  scope: MeasurementScope;
  expiresAt: number;
}
export type MeasurementOperation = "view" | "ingest" | "aggregate" | "report_generate";
export type AccessPlane = "interactive" | "data";
export interface AccessPorts {
  // These closures are wired by the server composition root, never by a request.
  readVerifiedIdentity(): Promise<VerifiedIdentity | null>;
  readCoverage(workspaceId: string): Promise<Coverage>;
  readLocalGrant(
    subject: Readonly<{
      workspaceId: string;
      sub: string;
      operation: MeasurementOperation;
      workspaceOwner: boolean;
    }>,
  ): Promise<LocalGrant | null>;
  // Product-owned policy. No plan/tier ladder or production matrix is invented
  // here; an unconfigured policy must grant no features.
  featuresFor(
    coverage: Readonly<Coverage>,
    plane: AccessPlane,
  ): readonly string[];
  now?: () => number;
}
export interface MeasurementAccess {
  context: AccessContext;
  scope: MeasurementScope;
  expiresAt: number;
}
const permissions = {
  view: "metering.view",
  ingest: "metering.ingest",
  aggregate: "metering.aggregate",
  report_generate: "reports.generate",
} as const;
function required(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    value !== "*"
  );
}
function fresh(expiresAt: number, now: number) {
  return Number.isFinite(expiresAt) && expiresAt > now;
}
function scopeSnapshot(
  scope: MeasurementScope,
  workspaceId: string,
): MeasurementScope {
  if (!scope || scope.workspaceId !== workspaceId)
    throw new Error("scope_workspace_mismatch");
  const list = (values: readonly string[]) => {
    if (!Array.isArray(values) || !values.every(required))
      throw new Error("invalid_scope");
    return Object.freeze([...new Set(values)]);
  };
  if (typeof scope.allowSiteParameters !== "boolean")
    throw new Error("invalid_scope");
  return Object.freeze({
    workspaceId,
    sourceIds: list(scope.sourceIds),
    stationIds: list(scope.stationIds),
    metricKeys: list(scope.metricKeys),
    serviceIds: list(scope.serviceIds),
    deviceIds: list(scope.deviceIds),
    allowSiteParameters: scope.allowSiteParameters,
  });
}
// A frozen Set still has a working .add(). Expose a read-only view instead.
function readonlySet(values: readonly string[]): ReadonlySet<string> {
  if (!Array.isArray(values) || !values.every(required))
    throw new Error("invalid_grants");
  const set = new Set(values);
  const view: ReadonlySet<string> = {
    size: set.size,
    has: (value) => set.has(value),
    entries: () => set.entries(),
    keys: () => set.keys(),
    values: () => set.values(),
    [Symbol.iterator]: () => set[Symbol.iterator](),
    forEach: (callback, thisArg) =>
      set.forEach((value) => callback.call(thisArg, value, value, view)),
    union: (other) => set.union(other),
    intersection: (other) => set.intersection(other),
    difference: (other) => set.difference(other),
    symmetricDifference: (other) => set.symmetricDifference(other),
    isSubsetOf: (other) => set.isSubsetOf(other),
    isSupersetOf: (other) => set.isSupersetOf(other),
    isDisjointFrom: (other) => set.isDisjointFrom(other),
  };
  return Object.freeze(view);
}

/** Resolve both access gates and row scope anew for each service invocation. */
export async function resolveMeasurementAccess(
  ports: AccessPorts,
  operation: MeasurementOperation,
  plane: AccessPlane,
): Promise<MeasurementAccess> {
  if (
    !Object.hasOwn(permissions, operation) ||
    !["interactive", "data"].includes(plane)
  )
    throw new Error("invalid_access_operation");
  const now = ports.now ?? Date.now;
  const rawIdentity = await ports.readVerifiedIdentity();
  const identity = rawIdentity ? structuredClone(rawIdentity) : null;
  if (
    !identity ||
    !required(identity.sub) ||
    !required(identity.activeWorkspace) ||
    identity.accountStatus !== "active" ||
    !fresh(identity.expiresAt, now()) ||
    !Array.isArray(identity.governanceRoles) ||
    !identity.governanceRoles.every(required)
  )
    throw new Error("identity_required");
  const workspaceId = identity.activeWorkspace;
  const coverage = structuredClone(await ports.readCoverage(workspaceId));
  if (
    !coverage ||
    coverage.workspaceId !== workspaceId ||
    coverage.product !== "bsmoss" ||
    !fresh(coverage.expiresAt, now()) ||
    !(coverage.tier === null || required(coverage.tier)) ||
    typeof coverage.bundled !== "boolean"
  )
    throw new Error("invalid_coverage");
  // Platform gates: bundled coverage enables only the data plane. Functional
  // interpretation remains in the separate product-owned policy.
  if (coverage.tier === null && !(plane === "data" && coverage.bundled))
    throw new Error("feature_denied");
  const features = readonlySet(
    ports.featuresFor(Object.freeze(coverage), plane),
  );
  if (!features.has("metering")) throw new Error("feature_denied");
  const workspaceOwner = identity.governanceRoles.includes("workspace:owner");
  const rawGrant = await ports.readLocalGrant(
    Object.freeze({
      workspaceId,
      sub: identity.sub,
      operation,
      workspaceOwner,
    }),
  );
  const grant = rawGrant ? structuredClone(rawGrant) : null;
  if (
    !grant ||
    grant.workspaceId !== workspaceId ||
    grant.sub !== identity.sub ||
    grant.active !== true ||
    !fresh(grant.expiresAt, now())
  )
    throw new Error("permission_denied");
  // Workspace owner has a view/ingest baseline; generation requires an explicit
  // local grant. Even the owner receives a finite data scope from the store.
  const permission = permissions[operation];
  const granted = readonlySet(grant.permissions);
  const context = Object.freeze({
    workspaceId,
    sub: identity.sub,
    features,
    permissions: readonlySet(
      workspaceOwner && (operation === "view" || operation === "ingest")
        ? [permission]
        : [...granted].filter((p) => p === permission),
    ),
  });
  authorize(context, "metering", permission);
  const scope = scopeSnapshot(grant.scope, workspaceId);
  const expiresAt = Math.min(
    identity.expiresAt,
    coverage.expiresAt,
    grant.expiresAt,
  );
  if (!fresh(expiresAt, now())) throw new Error("access_expired");
  return Object.freeze({ context, scope, expiresAt });
}
