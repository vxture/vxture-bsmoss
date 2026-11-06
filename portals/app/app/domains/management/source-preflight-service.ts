import { resolveMeasurementAccess, type AccessPorts, type MeasurementAccess } from "../access/resolve.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { reportScope } from "../reports/rules.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import type { SourcePreflightReader } from "./source-preflight-reader.ts";
import { sourceProposal } from "./source-preflight-rules.ts";
import { sourceIdentity } from "./source-rules.ts";
export function sourcePreflight(ports: AccessPorts, readers: { create(scope: MeasurementScope): SourcePreflightReader }) {
  const now = ports.now ?? Date.now;
  return { async preview(id: string, raw: unknown) {
    const first = await resolveMeasurementAccess(ports, "sources_preflight", "interactive");
    const reader = readers.create(first.scope);
    if (reader.workspaceId !== first.context.workspaceId) throw Error("workspace_mismatch");
    if (first.expiresAt <= now()) throw Error("access_expired");
    let impact: MeasurementAccess | undefined;
    try { impact = await resolveMeasurementAccess(ports, "source_intake_impact_view", "interactive"); }
    catch (e) { if (!(e instanceof Error) || e.message !== "permission_denied") throw e; }
    if (impact && (impact.context.sub !== first.context.sub || impact.context.workspaceId !== first.context.workspaceId)) throw Error("permission_denied");
    let result, failure;
    try { result = await reader.preview(sourceIdentity(id), sourceProposal(raw), impact?.scope); } catch (e) { failure = e; }
    if (first.expiresAt <= now()) throw Error("access_expired");
    const current = await resolveMeasurementAccess(ports, "sources_preflight", "interactive");
    if (current.context.sub !== first.context.sub || current.context.workspaceId !== first.context.workspaceId || fingerprintOf(reportScope(current.scope)) !== fingerprintOf(reportScope(first.scope))) throw Error("permission_denied");
    if (current.expiresAt <= now()) throw Error("access_expired");
    if (impact) {
      const finalImpact = await resolveMeasurementAccess(ports, "source_intake_impact_view", "interactive");
      if (impact.expiresAt <= now() || finalImpact.expiresAt <= now()) throw Error("access_expired");
      if (finalImpact.context.sub !== first.context.sub || finalImpact.context.workspaceId !== first.context.workspaceId || fingerprintOf(reportScope(finalImpact.scope)) !== fingerprintOf(reportScope(impact.scope))) throw Error("permission_denied");
    }
    if (failure) throw failure;
    if (!result) throw Error("source_configuration_unavailable");
    return result;
  } };
}
