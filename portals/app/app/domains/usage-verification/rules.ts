import {DEFAULT_VERIFICATION_PARAMETERS,verificationMinimum,verificationParameters,type VerificationParameters} from "./parameters";
import { VERIFICATION_POLICY_VERSION, ZERO_RUN_MIN_HOURS } from "../business-parameters/policies";
export { VERIFICATION_POLICY_VERSION, ZERO_RUN_MIN_HOURS } from "../business-parameters/policies";
import { evaluateWave, WAVE_POLICY, type WaveEvidence } from "../map-demo/station-period-rules";
import type { BusinessMetric } from "../map-demo/period-contribution-rules";
export type FindingKind = "up" | "down" | "from_zero" | "zero_run" | "missing" | "insufficient";
export type FindingCategory = "business" | "quality" | "insufficient";
export type SampleQuality = "verified" | "missing" | "pending" | "rejected";
export interface ReferenceSlot {
  start: string; end: string; value: string | null; quality: SampleQuality; complete: boolean; reason: string;
}
export interface ReviewWindow extends ReferenceSlot {
  expected: boolean; due: boolean; eventId: string; references: ReferenceSlot[];
}
export interface AssessedWindow extends ReviewWindow { usable: boolean; wave: WaveEvidence | null }
export interface UsageFinding {
  kind: FindingKind; category: FindingCategory; start: string; end: string; windows: AssessedWindow[];
  current: string | null; referenceNumerator: string | null; deltaNumerator: string | null;
}
const HOUR = 3600000, counter = /^(0|[1-9]\d{0,99})$/;
function validateSlot(slot: ReferenceSlot) {
  const at = Date.parse(slot.start), end = Date.parse(slot.end);
  if (!Number.isFinite(at) || end - at !== HOUR || at % HOUR !== 0 ||
    !["verified", "missing", "pending", "rejected"].includes(slot.quality) ||
    (slot.value !== null && !counter.test(slot.value)) || (slot.quality === "verified" && slot.value === null)) throw Error("invalid_review_sample");
}
export function deriveUsageFindings(input: readonly ReviewWindow[], metric: BusinessMetric, parameters:VerificationParameters=DEFAULT_VERIFICATION_PARAMETERS): UsageFinding[] {
  const policy=verificationParameters(parameters);
  if (!(metric in WAVE_POLICY.minimum) || !Object.hasOwn(WAVE_POLICY.minimum, metric)) throw Error("invalid_review_metric");
  const sorted = [...input].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const seen = new Set<number>();
  const assessed: AssessedWindow[] = sorted.map(w => {
    validateSlot(w);
    if (seen.has(Date.parse(w.start)) || w.references.length !== 4) throw Error("invalid_review_windows");
    seen.add(Date.parse(w.start));
    const starts = new Set<number>();
    for (const r of w.references) {
      validateSlot(r);
      const weeks = (Date.parse(w.start) - Date.parse(r.start)) / (7 * 86400000);
      if (!WAVE_POLICY.baselineWeeks.some(week => week === weeks) || starts.has(Date.parse(r.start))) throw Error("invalid_review_reference");
      starts.add(Date.parse(r.start));
    }
    const usable = w.expected && w.due && w.complete && w.quality === "verified" && w.value !== null;
    const values = w.references.filter(r => r.quality === "verified" && r.complete && r.value !== null).map(r => r.value!);
    return { ...w, usable, wave: usable ? evaluateWave(w.value!, values, verificationMinimum(policy,metric),policy.relativeBps) : null };
  });
  const result: UsageFinding[] = [], consumed = new Set<string>();
  const add = (kind: FindingKind, windows: AssessedWindow[]) => {
    const known = windows.every(w => w.usable), baseline = windows.every(w => w.wave?.referenceNumerator !== null && w.wave !== null);
    const current = known ? String(windows.reduce((sum, w) => sum + BigInt(w.value!), 0n)) : null;
    const referenceNumerator = baseline ? String(windows.reduce((sum, w) => sum + BigInt(w.wave!.referenceNumerator!), 0n)) : null;
    result.push({ kind, category: kind === "missing" ? "quality" : kind === "insufficient" ? "insufficient" : "business",
      start: windows[0].start, end: windows[windows.length - 1].end, windows, current, referenceNumerator,
      deltaNumerator: current !== null && referenceNumerator !== null ? String(2n * BigInt(current) - BigInt(referenceNumerator)) : null });
  };
  // An invalid or absent window breaks continuity. Never join across gaps or inactive service.
  let run: AssessedWindow[] = [];
  const flush = () => { if (run.length >= ZERO_RUN_MIN_HOURS) { add("zero_run", run); run.forEach(w => consumed.add(w.start)); } run = []; };
  for (const w of assessed) {
    const zero = w.usable && w.value === "0" && w.wave?.referenceNumerator !== null && w.wave !== null && BigInt(w.wave.referenceNumerator!) > 0n;
    if (!zero) { flush(); continue; }
    if (run.length && Date.parse(run[run.length - 1].end) !== Date.parse(w.start)) flush();
    run.push(w);
  }
  flush();
  for (const w of assessed) {
    if (!w.expected || !w.due || consumed.has(w.start)) continue;
    if (!w.usable) add("missing", [w]);
    else if (w.wave!.status === "insufficient") add("insufficient", [w]);
    else if (w.wave!.flagged && ["up", "down", "from_zero"].includes(w.wave!.status)) add(w.wave!.status as FindingKind, [w]);
  }
  return result.sort((a, b) => b.start.localeCompare(a.start) || a.kind.localeCompare(b.kind));
}
