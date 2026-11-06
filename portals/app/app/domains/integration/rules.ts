import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { timestamp } from "../measurements/rules.ts";
import { reportScope } from "../reports/rules.ts";
import type { PullPlan, SourceBinding, SourceHead, SourcePage, SourcePosition } from "./contracts.ts";

export const PULL_LIMITS = Object.freeze({ pageSize: 200, pages: 64, records: 4096, pageBytes: 1048576, totalBytes: 8388608, callMs: 10000, replayHours: 72, advanceDays: 31 });
export function exactFields(raw: unknown, keys: readonly string[]): asserts raw is Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).length !== keys.length || Object.keys(raw).some(k => !keys.includes(k))) throw Error("invalid_source_contract");
}
function token(raw: unknown): asserts raw is string {
  if (typeof raw !== "string") throw Error("invalid_source_token"); jobIdentity(raw);
}
function digest(raw: unknown): asserts raw is string {
  if (typeof raw !== "string" || !/^[a-f0-9]{64}$/.test(raw)) throw Error("invalid_source_digest");
}
function hour(raw: string) {
  const value = timestamp(raw);
  if (Date.parse(value) % 3600000) throw Error("unaligned_source_position");
  return value;
}
export function sourceBinding(raw: SourceBinding): SourceBinding {
  exactFields(raw, ["id", "revision", "sourceId", "adapterVersion", "transformVersion", "coverageStart", "scope"]);
  const b = structuredClone(raw);
  [b.id, b.sourceId, b.adapterVersion, b.transformVersion].forEach(token); positiveRevision(b.revision);
  b.scope = reportScope(b.scope); b.coverageStart = hour(b.coverageStart);
  if (b.scope.sourceIds.length !== 1 || b.scope.sourceIds[0] !== b.sourceId || !b.scope.stationIds.length || !b.scope.metricKeys.length) throw Error("invalid_source_scope");
  return b;
}
export function sourceHead(raw: unknown): SourceHead {
  exactFields(raw, ["sourceId", "snapshotId", "dataRevision", "availableThrough", "changeCursor", "completionClaim"]);
  [raw.sourceId, raw.snapshotId, raw.dataRevision, raw.changeCursor].forEach(token);
  if (raw.availableThrough !== null) raw = { ...raw, availableThrough: timestamp(raw.availableThrough as string) };
  const h = structuredClone(raw) as unknown as SourceHead;
  if (h.completionClaim !== null) {
    exactFields(h.completionClaim, ["status", "through", "evidenceRef", "evidenceSha256"]);
    const claim = h.completionClaim;
    if (!["confirmed", "revoked"].includes(claim.status)) throw Error("invalid_source_claim");
    token(claim.evidenceRef); digest(claim.evidenceSha256); claim.through = timestamp(claim.through);
    if (h.availableThrough === null || claim.through > h.availableThrough) throw Error("invalid_source_claim");
  }
  return h;
}
export function sourcePosition(raw: SourcePosition): SourcePosition {
  exactFields(raw, ["bindingSha256", "through", "dataRevision", "changeCursor"]);
  digest(raw.bindingSha256); token(raw.dataRevision); token(raw.changeCursor);
  return { ...raw, through: hour(raw.through) };
}
export function planSourcePull(rawBinding: SourceBinding, rawHead: SourceHead, rawPosition: SourcePosition | null, now: number): PullPlan {
  const b = sourceBinding(rawBinding), h = sourceHead(rawHead), p = rawPosition === null ? null : sourcePosition(rawPosition);
  const bindingSha256 = fingerprintOf(b);
  if (h.sourceId !== b.sourceId || p && p.bindingSha256 !== bindingSha256) throw Error("source_configuration_changed");
  if (!Number.isSafeInteger(now) || h.availableThrough === null) throw Error("source_watermark_unknown");
  if (Date.parse(h.availableThrough) > now) throw Error("source_future_watermark");
  const to = Math.floor(Date.parse(h.availableThrough) / 3600000) * 3600000, start = Date.parse(b.coverageStart);
  if (to <= start || p && (Date.parse(p.through) < start || to < Date.parse(p.through))) throw Error("source_watermark_regressed");
  const base = p ? Date.parse(p.through) : start;
  // Oversized bootstrap/backlogs require an explicit reviewed window. Never
  // silently truncate a pull and then acknowledge the head's change cursor.
  if (to - base > PULL_LIMITS.advanceDays * 86400000) throw Error("source_bootstrap_window_required");
  const body = { version: "source-pull-v1" as const, bindingSha256, sourceId: b.sourceId, snapshotId: h.snapshotId, dataRevision: h.dataRevision,
    from: new Date(Math.max(start, base - PULL_LIMITS.replayHours * 3600000)).toISOString(), to: new Date(to).toISOString(),
    changesAfter: p?.changeCursor ?? null, changesThrough: h.changeCursor,
    state: p && p.through === new Date(to).toISOString() && p.dataRevision === h.dataRevision && p.changeCursor === h.changeCursor ? "current" as const : "pull" as const };
  return { ...body, id: fingerprintOf(body) };
}
export function sourcePage(raw: unknown, plan: PullPlan, after: string | null): SourcePage {
  exactFields(raw, ["planId", "snapshotId", "after", "items", "next"]);
  if (Buffer.byteLength(JSON.stringify(raw), "utf8") > PULL_LIMITS.pageBytes) throw Error("source_page_bytes_exceeded");
  if (raw.planId !== plan.id || raw.snapshotId !== plan.snapshotId || raw.after !== after) throw Error("source_snapshot_changed");
  if (raw.next !== null) token(raw.next);
  if (!Array.isArray(raw.items) || raw.items.length > PULL_LIMITS.pageSize || !raw.items.length && raw.next !== null) throw Error("invalid_source_page");
  for (const item of raw.items) {
    exactFields(item, ["kind", "measurement"]);
    if (item.kind !== "window" && item.kind !== "change" || item.kind === "change" && plan.changesAfter === null) throw Error("invalid_source_item");
  }
  return structuredClone(raw) as unknown as SourcePage;
}
