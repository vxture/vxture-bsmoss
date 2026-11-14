import { resolveMeasurementAccess, type AccessPorts, type AccessPlane } from "./resolve.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { assertReportScope } from "../reports/rules.ts";
import { reportJobList, reportJobQuery, type ReportJobStore, type ReportJobListQuery, type ReportJobQuery } from "../supervision/report-jobs.ts";

export function createAuthorizedReportJobs(ports: AccessPorts, stores: { create(scope: MeasurementScope): ReportJobStore }, plane: AccessPlane) {
  async function open() {
    const initial = await resolveMeasurementAccess(ports, "report_jobs_view", plane), now = ports.now ?? Date.now, store = stores.create(initial.scope);
    if (store.workspaceId !== initial.context.workspaceId) throw Error("workspace_mismatch");
    const revalidate = async (required: MeasurementScope) => {
      const current = await resolveMeasurementAccess(ports, "report_jobs_view", plane);
      if (initial.expiresAt <= now() || current.expiresAt <= now()) throw Error("access_expired");
      if (initial.context.sub !== current.context.sub || initial.context.workspaceId !== current.context.workspaceId) throw Error("permission_denied");
      assertReportScope(current.scope, required);
    };
    return { store, revalidate };
  }
  return Object.freeze({
    async list(raw: ReportJobListQuery) { const q = reportJobList(raw), { store, revalidate } = await open(); return store.list(q, revalidate); },
    async read(raw: ReportJobQuery) { const q = reportJobQuery(raw), { store, revalidate } = await open(); return store.read(q, revalidate); },
  });
}
