import { resolveMeasurementAccess, type AccessPorts, type AccessPlane } from "./resolve.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { assertReportScope } from "../reports/rules.ts";
import { normalizeRecoverReportJob, type RecoverReportJob, type ReportRecoveryStore } from "../supervision/report-jobs.ts";

export function createAuthorizedReportRecovery(ports: AccessPorts, stores: { create(scope: MeasurementScope): ReportRecoveryStore }, plane: AccessPlane) {
  return Object.freeze({ async recover(raw: RecoverReportJob) {
    const command = normalizeRecoverReportJob(raw), initial = await resolveMeasurementAccess(ports, "report_jobs_recover", plane);
    const now = ports.now ?? Date.now, store = stores.create(initial.scope);
    if (store.workspaceId !== initial.context.workspaceId) throw Error("workspace_mismatch");
    return store.recover(command, initial.context.sub, async required => {
      const current = await resolveMeasurementAccess(ports, "report_jobs_recover", plane);
      if (initial.expiresAt <= now() || current.expiresAt <= now()) throw Error("access_expired");
      if (initial.context.sub !== current.context.sub || initial.context.workspaceId !== current.context.workspaceId) throw Error("permission_denied");
      assertReportScope(current.scope, required);
    });
  } });
}
