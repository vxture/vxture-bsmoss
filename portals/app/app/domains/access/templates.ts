import { resolveMeasurementAccess, type AccessPorts, type AccessPlane, type MeasurementOperation } from "./resolve.ts";
import { assertReportScope } from "../reports/rules.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import type { TemplateStoreFactory } from "../views/template-store.ts";
import { templateCandidate, templatePublication, templateSelection, templateReadQuery, type TemplateCandidate, type TemplatePublicationCommand, type TemplateSelectionCommand } from "../views/templates.ts";

export function createAuthorizedTemplates(ports: AccessPorts, stores: TemplateStoreFactory, plane: AccessPlane) {
  const now = ports.now ?? Date.now;
  async function open(operation: MeasurementOperation) {
    const access = await resolveMeasurementAccess(ports, operation, plane), store = stores.create(access.scope, access.context.sub);
    if (store.workspaceId !== access.context.workspaceId) throw Error("workspace_mismatch");
    const revalidate = async (required: MeasurementScope) => {
      if (access.expiresAt <= now()) throw Error("access_expired");
      const current = await resolveMeasurementAccess(ports, operation, plane);
      if (current.context.workspaceId !== access.context.workspaceId || current.context.sub !== access.context.sub) throw Error("permission_denied");
      assertReportScope(current.scope, required); if (current.expiresAt <= now()) throw Error("access_expired");
    };
    return { store, revalidate };
  }
  return Object.freeze({
    async preview(raw: TemplateCandidate) { const c = templateCandidate(raw), { store, revalidate } = await open("template_view"); return store.preview(c, revalidate); },
    async read(raw: { code: string; version?: number }) { const q = templateReadQuery(raw), { store, revalidate } = await open("template_view"); return store.read(q, revalidate); },
    async publish(raw: TemplatePublicationCommand) { const c = templatePublication(raw), { store, revalidate } = await open("template_publish"); return store.publish(c, revalidate); },
    async select(raw: TemplateSelectionCommand) { const c = templateSelection(raw), { store, revalidate } = await open("template_select"); return store.select(c, revalidate); },
  });
}
