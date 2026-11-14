import type { MappingImpacts } from "./mapping-impact-contracts.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import type { MappingRecord } from "./mapping-rules.ts";
import { sourceIdentity, sourceRevision } from "./source-rules.ts";

export interface MappingProposal {
  expected: { version: string; validFrom: string; validTo: string };
  proposed: { version: string; validFrom: string; validTo: string };
  basis: { reference: string; sha256: string };
}
export interface MappingPreflight {
  kind: "mapping_validity_preflight_v1";
  before: MappingRecord;
  proposed: MappingProposal["proposed"];
  basis: MappingProposal["basis"] & { verification: "not_verified" };
  draftDigest: string;
  changedFields: ("version" | "validFrom" | "validTo")[];
  changedWindows: { from: string; to: string; change: "added" | "removed" }[];
  checks: { version: "next"; authorizedOverlap: boolean; overlapCoverage: "authorized_scope_only"; serviceCoverage: "covered" | "uncovered" | "not_applicable" };
  assessment: "blocked" | "needs_review";
  dependencyEvidence: MappingImpacts;
  downstream: { aggregates: "not_assessed" | "authorized_current_heads"; reports: "not_assessed" | "authorized_current_heads"; intakeTasks: "not_assessed" };
  checkedAt: string;
}
function exact(v: any, keys: string[]) {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).sort().join() !== keys.sort().join()) throw Error();
}
function instant(v: unknown): asserts v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v.replace(/(\.\d{3})\d{3}Z$/, "$1Z")) throw Error();
}
export function mappingProposal(raw: unknown): MappingProposal {
  try {
    const v = structuredClone(raw) as MappingProposal;
    exact(v, ["expected", "proposed", "basis"]);
    for (const p of [v.expected, v.proposed]) {
      exact(p, ["version", "validFrom", "validTo"]); sourceRevision(p.version); instant(p.validFrom); instant(p.validTo);
      if (p.validFrom >= p.validTo) throw Error();
    }
    exact(v.basis, ["reference", "sha256"]); sourceIdentity(v.basis.reference);
    if (typeof v.basis.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(v.basis.sha256)) throw Error();
    return v;
  } catch { throw Error("invalid_mapping_proposal"); }
}
export function assertMappingBaseline(r: MappingRecord, p: MappingProposal) {
  if (["version", "validFrom", "validTo"].some(k => r[k as keyof MappingRecord] !== p.expected[k as keyof MappingProposal["expected"]])) throw Error("mapping_context_changed");
  if (BigInt(p.proposed.version) !== BigInt(r.version) + 1n) throw Error("invalid_mapping_proposal");
  if (p.proposed.validFrom === r.validFrom && p.proposed.validTo === r.validTo) throw Error("mapping_proposal_unchanged");
}
export function mappingPreflightResult(r: MappingRecord, p: MappingProposal, overlap: boolean, checkedAt: string): MappingPreflight {
  assertMappingBaseline(r, p);
  const next = p.proposed, changedWindows: MappingPreflight["changedWindows"] = [];
  // Only the symmetric difference changes temporal applicability. Version changes
  // can still invalidate dependencies throughout the full prior/new interval.
  const subtract = (a: { validFrom: string; validTo: string }, b: { validFrom: string; validTo: string }, change: "added" | "removed") => {
    if (a.validFrom < b.validFrom) { const to = a.validTo < b.validFrom ? a.validTo : b.validFrom; if (a.validFrom < to) changedWindows.push({ from: a.validFrom, to, change }); }
    if (a.validTo > b.validTo) { const from = a.validFrom > b.validTo ? a.validFrom : b.validTo; if (from < a.validTo) changedWindows.push({ from, to: a.validTo, change }); }
  };
  subtract(r, next, "removed"); subtract(next, r, "added");
  const serviceCoverage = !r.serviceId ? "not_applicable" : r.serviceFrom! <= next.validFrom && r.serviceTo! >= next.validTo ? "covered" : "uncovered";
  return { kind: "mapping_validity_preflight_v1", before: r, proposed: next, basis: { ...p.basis, verification: "not_verified" },
    draftDigest: fingerprintOf({ workspaceIndependentDefinition: r, proposal: p }),
    changedFields: (["version", "validFrom", "validTo"] as const).filter(k => r[k] !== next[k]), changedWindows,
    checks: { version: "next", authorizedOverlap: overlap, overlapCoverage: "authorized_scope_only", serviceCoverage },
    assessment: overlap || serviceCoverage === "uncovered" ? "blocked" : "needs_review",
    dependencyEvidence: { aggregates: { status: "not_authorized" }, reports: { status: "not_authorized" } },
    downstream: { aggregates: "not_assessed", reports: "not_assessed", intakeTasks: "not_assessed" }, checkedAt };
}
