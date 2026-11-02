import { resolveMeasurementAccess, type AccessPorts, type AccessPlane, type MeasurementOperation } from "./resolve.ts";
import { assertReportScope } from "../reports/rules.ts";
import { normalizeExportRequest, normalizeExportQuery, type ExportRequest, type ExportQuery, type ReportExportStore } from "../reports/exports.ts";
import type { MeasurementScope } from "../measurements/store.ts";

export function createAuthorizedReportExports(ports: AccessPorts, stores: { create(scope: MeasurementScope): ReportExportStore }, plane: AccessPlane) {
  const now = ports.now ?? Date.now;
  async function open(operation: MeasurementOperation) {
    const access = await resolveMeasurementAccess(ports, operation, plane);
    if (access.expiresAt <= now()) throw Error("access_expired");
    const store = stores.create(access.scope); if (store.workspaceId !== access.context.workspaceId) throw Error("workspace_mismatch");
    const revalidate = async (required: MeasurementScope) => {
      if (access.expiresAt <= now()) throw Error("access_expired");
      const current = await resolveMeasurementAccess(ports, operation, plane);
      if (current.context.workspaceId !== access.context.workspaceId || current.context.sub !== access.context.sub) throw Error("permission_denied");
      assertReportScope(current.scope, required); if (current.expiresAt <= now()) throw Error("access_expired");
    };
    return { store, access, revalidate };
  }
  return Object.freeze({
    async request(raw: ExportRequest) { const command = normalizeExportRequest(raw), { store, access, revalidate } = await open("report_export"); return store.request(command, access.context.sub, revalidate); },
    async run(raw: ExportQuery) { const query = normalizeExportQuery(raw), { store, access, revalidate } = await open("report_export_execute"); return store.run(query, access.context.sub, revalidate); },
    async status(raw: ExportQuery) { const query = normalizeExportQuery(raw), { store, revalidate } = await open("report_export"); return store.status(query, revalidate); },
    async download(raw: ExportQuery) { const query = normalizeExportQuery(raw), { store, revalidate } = await open("report_export"); return store.download(query, revalidate); },
  });
}
