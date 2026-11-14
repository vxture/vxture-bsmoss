import type { createRegistry } from "../catalog/registry.ts";
import type { MeasurementDraft, MeasurementFilter } from "./store.ts";

export function integer(value: string, signed = false): void {
  const pattern = signed ? /^(0|-?[1-9][0-9]{0,29})$/ : /^(0|[1-9][0-9]{0,29})$/;
  if (typeof value !== "string" || !pattern.test(value)) throw new Error("invalid_integer");
}
export function timestamp(value: string): string {
  // Millisecond precision is deliberate: JS and PostgreSQL replay comparisons must agree.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error("invalid_timestamp");
  const day = value.slice(0,10), date = new Date(day+"T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== day || Number(value.slice(11,13))>23) throw new Error("invalid_timestamp");
  return new Date(value).toISOString();
}
export function normalizeDraft(input: MeasurementDraft, registry: ReturnType<typeof createRegistry>): MeasurementDraft {
  // Snapshot before any asynchronous work; caller mutation cannot change an in-flight write.
  const r = structuredClone(input);
  for (const value of [r.workspaceId,r.sourceId,r.eventId,r.componentKey,r.stationId,r.mappingId,r.transformVersion,r.payloadUri,r.quality.reason,r.quality.ruleVersion,r.quality.decidedBy]) {
    if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error("missing_identity");
  }
  integer(r.revision);
  if (r.revision === "0") throw new Error("invalid_revision");
  if (r.previousRevision !== null) {
    integer(r.previousRevision);
    if (r.previousRevision === "0" || BigInt(r.previousRevision) >= BigInt(r.revision)) throw new Error("invalid_revision");
  }
  if (!/^[0-9a-f]{64}$/.test(r.payloadSha256)) throw new Error("invalid_digest");
  if (!["verified","pending","rejected"].includes(r.quality.status)) throw new Error("invalid_quality");
  r.occurredAt=timestamp(r.occurredAt); r.periodStart=timestamp(r.periodStart); r.periodEnd=timestamp(r.periodEnd);
  if (r.periodEnd <= r.periodStart) throw new Error("invalid_period");
  const m = registry.get(r.metric);
  if (!Number.isSafeInteger(r.metric.version) || !m || m.lifecycle === "retired" || m.semantic === "derived") throw new Error("unavailable_metric");
  const v = r.value;
  const keys = {integer_delta:["kind","value"],ratio_parts:["kind","numerator","denominator"],state_event:["kind","state","validUntil"],fixed_point:["kind","unscaled","scale"]};
  if (!keys[v.kind] || Object.keys(v).some(k=>!keys[v.kind].includes(k))) throw new Error("invalid_value_fields");
  const kind = {interval_delta:"integer_delta",ratio:"ratio_parts",state:"state_event",gauge:"fixed_point"}[m.semantic];
  if (v.kind !== kind) throw new Error("metric_value_mismatch");
  if (v.kind === "integer_delta") integer(v.value);
  else if (v.kind === "ratio_parts") {
    integer(v.numerator); integer(v.denominator);
    if (BigInt(v.numerator)>BigInt(v.denominator)) throw new Error("invalid_ratio");
  } else if (v.kind === "state_event") {
    if (!["running","standby","fault","offline","maintenance","unknown"].includes(v.state)) throw new Error("invalid_state");
    v.validUntil=timestamp(v.validUntil);
    if (v.validUntil !== r.periodEnd) throw new Error("invalid_state_expiry");
  }
  else if (v.kind === "fixed_point") {
    integer(v.unscaled, true);
    if (!Number.isSafeInteger(v.scale) || v.scale < 0 || v.scale > 9) throw new Error("invalid_gauge_scale");
  }
  return r;
}
export function normalizeFilter(input: MeasurementFilter): MeasurementFilter {
  const f = structuredClone(input);
  f.from=timestamp(f.from); f.to=timestamp(f.to);
  if (f.to<=f.from || Date.parse(f.to)-Date.parse(f.from)>31*86400000 || !Number.isInteger(f.limit) || f.limit<1 || f.limit>200) throw new Error("invalid_query_window");
  if (f.afterId !== undefined && !/^[0-9a-f-]{36}$/.test(f.afterId)) throw new Error("invalid_cursor");
  return f;
}
