import { resolveMeasurementAccess, type AccessPorts, type AccessPlane } from "./resolve.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { assertReportScope } from "../reports/rules.ts";
import { normalizeJobList, normalizeJobQuery, normalizeRecoverJob, type AggregateJobStore, type JobListQuery, type JobQuery, type RecoverJob } from "../supervision/jobs.ts";

export function createAuthorizedAggregateJobs(ports: AccessPorts, stores: { create(scope: MeasurementScope): AggregateJobStore }, plane: AccessPlane) {
  async function open(operation: "job_view" | "job_recover") {
    const access = await resolveMeasurementAccess(ports, operation, plane), now = ports.now ?? Date.now, store = stores.create(access.scope);
    if (store.workspaceId !== access.context.workspaceId) throw Error("workspace_mismatch");
    const revalidate = async (required: MeasurementScope) => {
      const current = await resolveMeasurementAccess(ports, operation, plane);
      if (access.expiresAt <= now() || current.expiresAt <= now()) throw Error("access_expired");
      if (current.context.workspaceId !== access.context.workspaceId || current.context.sub !== access.context.sub) throw Error("permission_denied");
      assertReportScope(current.scope, required);
    };
    return { store, access, revalidate };
  }
  return Object.freeze({
    async list(raw: JobListQuery) { const q = normalizeJobList(raw), { store, revalidate } = await open("job_view"); return store.list(q, revalidate); },
    async read(raw: JobQuery) { const q = normalizeJobQuery(raw), { store, revalidate } = await open("job_view"); return store.read(q, revalidate); },
    async recover(raw: RecoverJob) { const c = normalizeRecoverJob(raw), { store, access, revalidate } = await open("job_recover"); return store.recover(c, access.context.sub, revalidate); },
  });
}
