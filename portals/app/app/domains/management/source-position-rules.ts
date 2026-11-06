import type { SourceBinding, SourcePosition } from "../integration/contracts.ts";
import { sourceBinding, sourcePosition, PULL_LIMITS } from "../integration/rules.ts";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";

const dimensions = ["stationIds", "serviceIds", "deviceIds", "metricKeys"] as const;
export function bindingDifference(from: SourceBinding, to: SourceBinding) {
  return {
    fromRevision: from.revision, toRevision: to.revision,
    adapterChanged: from.adapterVersion !== to.adapterVersion,
    transformChanged: from.transformVersion !== to.transformVersion,
    coverageStart: { before: from.coverageStart, after: to.coverageStart },
    scopeChanges: dimensions.map(dimension => ({ dimension,
      added: to.scope[dimension].filter(id => !from.scope[dimension].includes(id)).length,
      removed: from.scope[dimension].filter(id => !to.scope[dimension].includes(id)).length })),
    siteParametersChanged: from.scope.allowSiteParameters !== to.scope.allowSiteParameters,
  };
}
export type SourcePositionPreview = { status: "not_authorized" | "unavailable" | "not_assessed" } | {
  status: "assessed";
  receipt: { id: string; sequence: string; bindingRevision: string; through: string; coverageStart: string; relation: "current_revision" | "earlier_revision" };
  receivedToCurrent: ReturnType<typeof bindingDifference>;
  receivedToProposed: ReturnType<typeof bindingDifference>;
  reviewWindow: { from: string; to: string; exceedsPullWindow: boolean } | null;
  disposition: "requires_reviewed_rebaseline";
  cursorReuse: "not_verified";
  sourceHead: "not_read";
};
// A historical receipt is evidence of received inputs only. Never manufacture
// a new SourcePosition, an upstream head, or a resumable pull plan from it.
export function positionPreview(receipt: { id: string; sequence: string; binding: SourceBinding; manifest: { position: SourcePosition } }, current: SourceBinding, proposed: SourceBinding): SourcePositionPreview {
  const old = sourceBinding(receipt.binding), before = sourceBinding(current), next = sourceBinding(proposed), p = sourcePosition(receipt.manifest.position);
  positiveRevision(receipt.sequence);
  if (!/^[a-f0-9]{64}$/.test(receipt.id) || p.bindingSha256 !== fingerprintOf(old) ||
      old.id !== before.id || next.id !== before.id || old.sourceId !== before.sourceId || next.sourceId !== before.sourceId ||
      old.scope.workspaceId !== before.scope.workspaceId || next.scope.workspaceId !== before.scope.workspaceId ||
      BigInt(old.revision) > BigInt(before.revision) || BigInt(next.revision) !== BigInt(before.revision) + 1n ||
      old.revision === before.revision && fingerprintOf(old) !== fingerprintOf(before) ||
      p.through <= old.coverageStart) throw Error("invalid_source_position_evidence");
  return { status: "assessed", receipt: { id: receipt.id, sequence: receipt.sequence, bindingRevision: old.revision,
    through: p.through, coverageStart: old.coverageStart, relation: old.revision === before.revision ? "current_revision" : "earlier_revision" },
    receivedToCurrent: bindingDifference(old, before), receivedToProposed: bindingDifference(old, next),
    reviewWindow: next.coverageStart < p.through ? { from: next.coverageStart, to: p.through,
      exceedsPullWindow: Date.parse(p.through) - Date.parse(next.coverageStart) > PULL_LIMITS.advanceDays * 86400000 } : null,
    disposition: "requires_reviewed_rebaseline", cursorReuse: "not_verified", sourceHead: "not_read" };
}
