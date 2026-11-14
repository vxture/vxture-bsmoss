import type { SourcePositionPreview } from "./source-position-rules.ts";
import type { SourceIntakeImpact } from "./source-intake-impact.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { sourceBinding } from "../integration/rules.ts";
import type { SourceBinding } from "../integration/contracts.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { assertReportScope } from "../reports/rules.ts";
import { sourceIdentity, sourceRevision, type SourceRecord } from "./source-rules.ts";

export const sourceDimensions = ["stationIds", "serviceIds", "deviceIds", "metricKeys"] as const;
type SourceScopeInput = Pick<MeasurementScope, typeof sourceDimensions[number] | "allowSiteParameters">;
export interface SourceProposal {
  expected: { revision: string; digest: string };
  proposed: { revision: string; status: "active" | "paused"; adapterVersion: string; transformVersion: string; coverageStart: string; scope: SourceScopeInput };
  basis: { reference: string; sha256: string };
}
export interface SourceResourceIssue { dimension: typeof sourceDimensions[number]; id: string }
export interface SourcePreflight {
  kind: "source_configuration_preflight_v1";
  before: SourceRecord;
  proposed: { status: "active" | "paused"; binding: SourceBinding; digest: string };
  basis: SourceProposal["basis"] & { verification: "not_verified" };
  changedFields: string[];
  scopeChanges: { dimension: typeof sourceDimensions[number]; added: string[]; removed: string[] }[];
  resourceIssues: SourceResourceIssue[];
  checks: { fullScope: "authorized"; resourceReferences: "resolved" | "unresolved"; adapterCompatibility: "not_verified"; sourceCapabilities: "not_assessed" };
  intake: { oldPositionReuse: "requires_reviewed_rebaseline"; existingReceipts: "not_assessed" | "current_revision_assessed"; existingTasks: "not_assessed" | "current_revision_assessed"; evidence: SourceIntakeImpact; position: SourcePositionPreview; proposedState: "paused" | "requires_verification" };
  downstream: { aggregates: "not_assessed"; reports: "not_assessed" };
  assessment: "blocked" | "needs_review";
  draftDigest: string;
  checkedAt: string;
}
function exact(v: any, fields: string[]) {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).sort().join() !== fields.sort().join()) throw Error();
}
export function sourceProposal(raw: unknown): SourceProposal {
  try {
    const p = structuredClone(raw) as SourceProposal;
    exact(p, ["expected", "proposed", "basis"]); exact(p.expected, ["revision", "digest"]);
    sourceRevision(p.expected.revision);
    if (typeof p.expected.digest !== "string" || !/^[a-f0-9]{64}$/.test(p.expected.digest)) throw Error();
    const v = p.proposed;
    exact(v, ["revision", "status", "adapterVersion", "transformVersion", "coverageStart", "scope"]);
    sourceRevision(v.revision); sourceIdentity(v.adapterVersion); sourceIdentity(v.transformVersion);
    if (!["active", "paused"].includes(v.status) || typeof v.coverageStart !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:00:00\.000Z$/.test(v.coverageStart) || v.coverageStart.startsWith("0000-") || !Number.isFinite(Date.parse(v.coverageStart)) || new Date(v.coverageStart).toISOString() !== v.coverageStart) throw Error();
    exact(v.scope, [...sourceDimensions, "allowSiteParameters"]);
    for (const key of sourceDimensions) {
      const ids = v.scope[key];
      if (!Array.isArray(ids) || ids.length > 10000) throw Error();
      ids.forEach(sourceIdentity);
      if (new Set(ids).size !== ids.length) throw Error();
      v.scope[key] = [...ids].sort();
    }
    if (!v.scope.stationIds.length || !v.scope.metricKeys.length || typeof v.scope.allowSiteParameters !== "boolean") throw Error();
    exact(p.basis, ["reference", "sha256"]); sourceIdentity(p.basis.reference);
    if (typeof p.basis.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(p.basis.sha256)) throw Error();
    return p;
  } catch { throw Error("invalid_source_proposal"); }
}
export function proposedSourceBinding(r: SourceRecord, p: SourceProposal, scope: MeasurementScope): SourceBinding {
  // Never accept tenant, binding ID or source identity from a proposed payload.
  // A source replacement requires a separate reviewed binding identity.
  const v = p.proposed;
  const b = sourceBinding({ id: r.id, sourceId: r.sourceId, revision: v.revision, adapterVersion: v.adapterVersion,
    transformVersion: v.transformVersion, coverageStart: v.coverageStart,
    scope: { ...v.scope, workspaceId: r.binding.scope.workspaceId, sourceIds: [r.sourceId] } });
  try { assertReportScope(scope, r.binding.scope); assertReportScope(scope, b.scope); } catch { throw Error("permission_denied"); }
  if (r.revision !== p.expected.revision || r.digest !== p.expected.digest) throw Error("source_context_changed");
  if (BigInt(v.revision) !== BigInt(r.revision) + 1n) throw Error("invalid_source_proposal");
  const same = r.status === v.status && r.adapterVersion === b.adapterVersion && r.transformVersion === b.transformVersion && r.binding.coverageStart === b.coverageStart && fingerprintOf(r.binding.scope) === fingerprintOf(b.scope);
  if (same) throw Error("source_proposal_unchanged");
  return b;
}
export function sourcePreflightResult(r: SourceRecord, p: SourceProposal, scope: MeasurementScope, issues: SourceResourceIssue[], checkedAt: string): SourcePreflight {
  const b = proposedSourceBinding(r, p, scope);
  const changedFields = ["status", "adapterVersion", "transformVersion", "coverageStart"].filter(key =>
    (key === "coverageStart" ? r.binding.coverageStart : r[key as "status" | "adapterVersion" | "transformVersion"]) !== p.proposed[key as "status" | "adapterVersion" | "transformVersion" | "coverageStart"]);
  const scopeChanges = sourceDimensions.map(dimension => ({ dimension, added: b.scope[dimension].filter(id => !r.binding.scope[dimension].includes(id)), removed: r.binding.scope[dimension].filter(id => !b.scope[dimension].includes(id)) }));
  for (const change of scopeChanges) if (change.added.length || change.removed.length) changedFields.push("scope." + change.dimension);
  if (b.scope.allowSiteParameters !== r.binding.scope.allowSiteParameters) changedFields.push("scope.allowSiteParameters");
  return { kind: "source_configuration_preflight_v1", before: r, proposed: { status: p.proposed.status, binding: b, digest: fingerprintOf(b) },
    basis: { ...p.basis, verification: "not_verified" }, changedFields, scopeChanges, resourceIssues: issues,
    checks: { fullScope: "authorized", resourceReferences: issues.length ? "unresolved" : "resolved", adapterCompatibility: "not_verified", sourceCapabilities: "not_assessed" },
    intake: { oldPositionReuse: "requires_reviewed_rebaseline", existingReceipts: "not_assessed", existingTasks: "not_assessed", evidence: { status: "not_authorized" }, position: { status: "not_assessed" }, proposedState: p.proposed.status === "paused" ? "paused" : "requires_verification" },
    downstream: { aggregates: "not_assessed", reports: "not_assessed" }, assessment: issues.length ? "blocked" : "needs_review",
    draftDigest: fingerprintOf({ workspaceId: scope.workspaceId, before: { revision: r.revision, digest: r.digest, status: r.status }, proposal: p, binding: b }), checkedAt };
}
