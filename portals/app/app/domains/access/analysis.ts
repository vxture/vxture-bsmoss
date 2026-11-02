import { resolveMeasurementAccess, type AccessPorts, type AccessPlane } from "./resolve.ts";
import { assertReportScope } from "../reports/rules.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { analysisQuery, saveAnalysisPreference, type AnalysisQuery, type SaveAnalysisPreference } from "../views/analysis.ts";
import type { AnalysisStoreFactory } from "../views/analysis-store.ts";

export function createAuthorizedAnalysis(ports: AccessPorts, stores: AnalysisStoreFactory, plane: AccessPlane) {
  const now = ports.now ?? Date.now;
  async function open() {
    const access = await resolveMeasurementAccess(ports, "view", plane), store = stores.create(access.scope, access.context.sub);
    if (store.workspaceId !== access.context.workspaceId) throw Error("workspace_mismatch");
    const revalidate = async (required: MeasurementScope) => {
      if (access.expiresAt <= now()) throw Error("access_expired");
      const current = await resolveMeasurementAccess(ports, "view", plane);
      if (current.context.workspaceId !== access.context.workspaceId || current.context.sub !== access.context.sub) throw Error("permission_denied");
      assertReportScope(current.scope, required); if (current.expiresAt <= now()) throw Error("access_expired");
    };
    return { store, revalidate };
  }
  return Object.freeze({
    async read(raw: AnalysisQuery) { const q = analysisQuery(raw), { store, revalidate } = await open(); return store.read(q, revalidate); },
    async save(raw: SaveAnalysisPreference) { const c = saveAnalysisPreference(raw), { store, revalidate } = await open(); return store.save(c, revalidate); },
  });
}
