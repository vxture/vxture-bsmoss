import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { fields, normalizeReportTemplate, type ReportTemplate } from "../reports/rules.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { analysisTemplate, type AnalysisTemplate } from "./analysis.ts";

export type TemplateCandidate = { kind: "page"; definition: AnalysisTemplate } | { kind: "report"; definition: ReportTemplate };
export interface TemplatePreview { candidateSha256: string; validationSha256: string; requiredScope: MeasurementScope; references: readonly { kind: "mapping" | "rollup"; id: string; sha256: string }[] }
export interface TemplatePublicationCommand {
  commandId: string; templateCode: string; expectedVersion: number | null; candidate: TemplateCandidate;
  candidateSha256: string; validationSha256: string; reviewRef: string;
}
export interface TemplatePointer { revision: string | null; code: string; version: number; sha256: string }
export interface TemplateSelectionCommand {
  commandId: string; scopeKey: "analysis:default"; templateCode: string; templateVersion: number;
  templateSha256: string; validationSha256: string; expected: TemplatePointer | null; reviewRef: string;
}
export interface PublishedTemplate { code: string; version: number; sha256: string; candidate: TemplateCandidate; publishedBy: string; publishedAt: string }
export interface TemplateRead { template: PublishedTemplate | null; selection: TemplatePointer | null }
export function templateVersion(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw Error("invalid_template_version");
}
export function templateHash(value: unknown): asserts value is string { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw Error("invalid_template_hash"); }
export function templateCandidate(raw: TemplateCandidate): TemplateCandidate {
  fields(raw, ["kind", "definition"]);
  if (raw.kind === "report") return { kind: "report", definition: normalizeReportTemplate(raw.definition) };
  if (raw.kind !== "page") throw Error("invalid_template_kind");
  const t = analysisTemplate(raw.definition);
  t.panels = [...t.panels].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  t.bindings = t.panels.map(p => t.bindings.find(b => b.panelId === p.id)!);
  return { kind: "page", definition: t };
}
export function templatePreviewRequest(raw: { candidate: TemplateCandidate }) { fields(raw, ["candidate"]); return { candidate: templateCandidate(raw.candidate) }; }
export function templatePublication(raw: TemplatePublicationCommand): TemplatePublicationCommand {
  fields(raw, ["commandId", "templateCode", "expectedVersion", "candidate", "candidateSha256", "validationSha256", "reviewRef"]);
  jobIdentity(raw.commandId); jobIdentity(raw.templateCode); jobIdentity(raw.reviewRef);
  if (raw.expectedVersion !== null) { templateVersion(raw.expectedVersion); if (raw.expectedVersion === Number.MAX_SAFE_INTEGER) throw Error("invalid_template_version"); }
  templateHash(raw.candidateSha256); templateHash(raw.validationSha256); const candidate = templateCandidate(raw.candidate);
  if (fingerprintOf(candidate) !== raw.candidateSha256) throw Error("invalid_template_hash");
  return { ...raw, candidate };
}
export function templatePointer(raw: TemplatePointer): TemplatePointer {
  fields(raw, ["revision", "code", "version", "sha256"]); if (raw.revision !== null) positiveRevision(raw.revision);
  jobIdentity(raw.code); templateVersion(raw.version); templateHash(raw.sha256); return structuredClone(raw);
}
export function templateSelection(raw: TemplateSelectionCommand): TemplateSelectionCommand {
  fields(raw, ["commandId", "scopeKey", "templateCode", "templateVersion", "templateSha256", "validationSha256", "expected", "reviewRef"]);
  jobIdentity(raw.commandId); jobIdentity(raw.templateCode); jobIdentity(raw.reviewRef); templateVersion(raw.templateVersion);
  templateHash(raw.templateSha256); templateHash(raw.validationSha256);
  if (raw.scopeKey !== "analysis:default") throw Error("invalid_template_selection");
  return { ...raw, expected: raw.expected === null ? null : templatePointer(raw.expected) };
}
export function templateReadQuery(raw: { code: string; version?: number }) {
  fields(raw, ["code", "version"]); jobIdentity(raw.code); if (raw.version !== undefined) templateVersion(raw.version); return { ...raw };
}
