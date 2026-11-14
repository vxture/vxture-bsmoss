import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { bucketFor, instant } from "../aggregation/periods.ts";
import { fields, unionReportScopes, type ReportGrain } from "./rules.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import type { StoredReport } from "./store.ts";
import { reportSchedule, type ReportSchedule } from "./schedule.ts";

export const REPORT_HISTORY_VERSION = "bsmoss-report-history-v1";
export type HistoryOutcome = "unchanged" | "inserted" | "duplicate" | "blocked";
// These are reviewed binding availability failures, never SQL, permission,
// manifest corruption or an arbitrary exception from a connector.
export function historyBindingUnavailable(error: unknown): boolean {
  return error instanceof Error && ["aggregate_mapping_unavailable", "report_rollup_unavailable", "rollup_paused", "rollup_atom_unavailable",
    "rollup_mapping_coverage_mismatch", "rollup_ratio_basis_mismatch"].includes(error.message);
}
export interface HistoryRef { revision: string; manifestSha256: string }
export interface ReportHistoryManifest {
  version: typeof REPORT_HISTORY_VERSION; workspaceId: string; scheduleId: string; scheduleRevision: string;
  scheduleSha256: string; configSha256: string; scanAt: string; scanHour: string; requestedBy: string;
  reportId: string; grain: ReportGrain; period: { start: string; end: string }; original: HistoryRef;
  before: { freshness: "current" | "stale" | "unavailable"; reasons: readonly string[] };
  outcome: HistoryOutcome; failureCode: "report_binding_unavailable" | null;
  result: HistoryRef & { currentRevision: string }; requiredScope: MeasurementScope;
}
export function reportHistoryManifest(p: ReportSchedule, configSha256: string, scanAt: string, original: StoredReport,
  before: ReportHistoryManifest["before"], outcome: HistoryOutcome, result: StoredReport): ReportHistoryManifest {
  const binding = reportSchedule(p), start = new Date(instant(scanAt)).toISOString(), m = original.manifest;
  if (!/^[a-f0-9]{64}$/.test(configSha256) || original.reportId !== result.reportId || original.revision !== original.currentRevision ||
    m.workspaceId !== p.workspaceId || m.template.code !== p.templateCode || m.template.version !== p.templateVersion || m.grain !== p.grain ||
    fingerprintOf(m.period) !== fingerprintOf(result.manifest.period) || result.manifest.template.code !== p.templateCode || result.manifest.template.version !== p.templateVersion ||
    result.manifest.grain !== p.grain || result.manifest.workspaceId !== p.workspaceId || m.period.start < p.notBefore ||
    Date.parse(m.period.end) + p.delayMinutes * 60000 > Date.parse(start)) throw Error("invalid_report_history_binding");
  fields(before, ["freshness", "reasons"]);
  if (!["current", "stale", "unavailable"].includes(before.freshness) || !Array.isArray(before.reasons) ||
    before.reasons.some(r => typeof r !== "string" || !r || r.length > 256) || before.reasons.length > 128 ||
    (before.freshness === "current") !== (before.reasons.length === 0) || !["unchanged", "inserted", "duplicate", "blocked"].includes(outcome) ||
    outcome === "unchanged" && before.freshness !== "current" || outcome !== "unchanged" && before.freshness === "current" ||
    outcome !== "blocked" && before.freshness === "unavailable" ||
    ["blocked", "unchanged"].includes(outcome) && (original.revision !== result.revision || original.manifestSha256 !== result.manifestSha256 || original.currentRevision !== result.currentRevision) ||
    outcome === "inserted" && (BigInt(result.revision) !== BigInt(original.revision) + 1n || result.currentRevision !== result.revision) ||
    outcome === "duplicate" && (result.currentRevision !== original.revision || BigInt(result.revision) > BigInt(original.revision))) throw Error("invalid_report_history_outcome");
  for (const r of [original, result]) { positiveRevision(r.revision); positiveRevision(r.currentRevision); if (!/^[a-f0-9]{64}$/.test(r.manifestSha256)) throw Error("invalid_report_history_binding"); }
  return { version: REPORT_HISTORY_VERSION, workspaceId: p.workspaceId, scheduleId: p.id, scheduleRevision: p.revision,
    scheduleSha256: binding.sha256, configSha256, scanAt: start, scanHour: bucketFor(start, "hour").start, requestedBy: p.subject,
    reportId: original.reportId, grain: p.grain, period: m.period, original: { revision: original.revision, manifestSha256: original.manifestSha256 },
    before: { freshness: before.freshness, reasons: [...new Set(before.reasons)].sort() }, outcome,
    failureCode: outcome === "blocked" ? "report_binding_unavailable" : null,
    result: { revision: result.revision, currentRevision: result.currentRevision, manifestSha256: result.manifestSha256 },
    requiredScope: unionReportScopes(p.workspaceId, [m.requiredScope, result.manifest.requiredScope]) };
}
