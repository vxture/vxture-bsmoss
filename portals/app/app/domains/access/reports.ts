import { resolveMeasurementAccess, type AccessPorts, type AccessPlane, type MeasurementOperation } from "./resolve.ts";
import { assertReportScope, normalizeGenerateReport, normalizeReportQuery, type GenerateReport, type ReportQuery } from "../reports/rules.ts";
import type { ReportStore } from "../reports/store.ts";
import type { MeasurementScope } from "../measurements/store.ts";

export function createAuthorizedReports(ports: AccessPorts, stores: { create(scope: MeasurementScope): ReportStore }, plane: AccessPlane) {
  const now = ports.now ?? Date.now;
  async function open(operation: MeasurementOperation) {
    const access = await resolveMeasurementAccess(ports, operation, plane);
    if (access.expiresAt <= now()) throw Error("access_expired");
    const store = stores.create(access.scope);
    if (store.workspaceId !== access.context.workspaceId) throw Error("workspace_mismatch");
    const revalidate = async (required: MeasurementScope) => {
      if (access.expiresAt <= now()) throw Error("access_expired");
      const current = await resolveMeasurementAccess(ports, operation, plane);
      if (current.context.workspaceId !== access.context.workspaceId || current.context.sub !== access.context.sub) throw Error("permission_denied");
      assertReportScope(current.scope, required);
      if (current.expiresAt <= now()) throw Error("access_expired");
    };
    return { store, access, revalidate };
  }
  return Object.freeze({
    async generate(raw: GenerateReport) {
      const query = normalizeGenerateReport(raw), { store, access, revalidate } = await open("report_generate");
      return store.generate(query, access.context.sub, revalidate);
    },
    async read(raw: ReportQuery) {
      const query = normalizeReportQuery(raw), { store, revalidate } = await open("view");
      return store.read(query, revalidate);
    },
  });
}
