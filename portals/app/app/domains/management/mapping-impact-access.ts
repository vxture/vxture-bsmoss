import { resolveMeasurementAccess, type AccessPorts, type MeasurementAccess } from "../access/resolve.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { reportScope } from "../reports/rules.ts";
const operations = { aggregates: "mapping_aggregates_impact_view", reports: "mapping_reports_impact_view" } as const;
type ImpactAccess = Partial<Record<keyof typeof operations, MeasurementAccess>>;
export async function resolveMappingImpactAccess(ports: AccessPorts, first: MeasurementAccess): Promise<ImpactAccess> {
  const result: ImpactAccess = {};
  for (const k of ["aggregates", "reports"] as const) {
    try { result[k] = await resolveMeasurementAccess(ports, operations[k], "interactive"); }
    catch (e) { if (!(e instanceof Error) || e.message !== "permission_denied") throw e; }
    if (result[k] && (result[k]!.context.sub !== first.context.sub || result[k]!.context.workspaceId !== first.context.workspaceId)) throw Error("permission_denied");
  }
  return result;
}
export async function revalidateMappingImpactAccess(ports: AccessPorts, first: MeasurementAccess, impact: ImpactAccess) {
  for (const k of ["aggregates", "reports"] as const) {
    const original = impact[k]; if (!original) continue;
    const current = await resolveMeasurementAccess(ports, operations[k], "interactive"), now = ports.now ?? Date.now;
    if (original.expiresAt <= now() || current.expiresAt <= now()) throw Error("access_expired");
    if (current.context.sub !== first.context.sub || current.context.workspaceId !== first.context.workspaceId || fingerprintOf(reportScope(current.scope)) !== fingerprintOf(reportScope(original.scope))) throw Error("permission_denied");
  }
}
