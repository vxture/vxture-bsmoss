import { resolveMeasurementAccess, type AccessPorts, type MeasurementAccess } from "../access/resolve.ts";
import { refKey } from "../catalog/registry.ts";
import { resolveIntervalInputPolicy } from "./input-policy.ts";
import { mappedSubject } from "./subjects.ts";
import type { readRefreshSnapshot } from "./refresh-snapshot.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import type { MetricRef } from "../catalog/registry.ts";
import type { RefreshJob } from "./refresh-jobs.ts";

// The trusted reader's stable object tuple and actual input policy define the
// footprint. Unrelated grants are not needed to commit this result.
async function currentAccess(ports: AccessPorts, initial: MeasurementAccess) {
  const current = await resolveMeasurementAccess(ports, "aggregate", "data"), now = ports.now ?? Date.now;
  if (initial.expiresAt <= now() || current.expiresAt <= now()) throw Error("access_expired");
  if (current.context.workspaceId !== initial.context.workspaceId || current.context.sub !== initial.context.sub) throw Error("permission_denied");
  return current;
}
function assertObjectScope(scope: MeasurementScope, plan: { workspaceId: string; sourceId: string; subjectKey: string; metric: MetricRef }) {
  const ids: unknown = JSON.parse(plan.subjectKey);
  if (!Array.isArray(ids) || ids.length !== 5 || ids[0] !== "mapped-object-v1" ||
      typeof ids[1] !== "string" || ids.slice(2).some(id => id !== null && typeof id !== "string") ||
      mappedSubject(ids[1], ids[2], ids[3], ids[4]) !== plan.subjectKey) throw Error("refresh_snapshot_mismatch");
  if (plan.workspaceId !== scope.workspaceId || !scope.sourceIds.includes(plan.sourceId) || !scope.stationIds.includes(ids[1]) ||
      ids[2] !== null && !scope.serviceIds.includes(ids[2]) || ids[4] !== null && !scope.deviceIds.includes(ids[4]) ||
      ids[2] === null && ids[4] === null && !scope.allowSiteParameters || !scope.metricKeys.includes(refKey(plan.metric))) throw Error("aggregate_scope_denied");
}
export async function revalidateRefreshAccess(ports: AccessPorts, initial: MeasurementAccess,
  snapshot: Awaited<ReturnType<typeof readRefreshSnapshot>>) {
  const current = await currentAccess(ports, initial), scope = current.scope, plan = snapshot.plan;
  assertObjectScope(scope, plan);
  if (snapshot.kind === "interval") resolveIntervalInputPolicy(snapshot.plan.metric, snapshot.plan.grain, snapshot.plan.inputMode, scope.metricKeys);
}
// Failure records mutate only this job's lifecycle, never derived input data.
// A missing capability must remain recordable without fabricating its policy.
export async function revalidateRefreshFailureAccess(ports: AccessPorts, initial: MeasurementAccess, job: RefreshJob) {
  const current = await currentAccess(ports, initial);
  assertObjectScope(current.scope, { ...job, metric: job.target.metric });
}
