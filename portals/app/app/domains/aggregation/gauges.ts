import { integer } from "../measurements/rules.ts";
import { bounds, instant, type Period } from "./periods.ts";
import { AGGREGATION_VERSION, fingerprintOf } from "./intervals.ts";

export interface GaugeSample { at: string; unscaled: string; validUntil?: string }

// Generic future-parameter kernel; does not activate an unregistered metric.
export function aggregateGauge(period: Period, scale: number, mode: "sample_mean" | "time_weighted", input: readonly GaugeSample[]) {
  const [start, end] = bounds(period);
  if (!Number.isInteger(scale) || scale < 0 || scale > 9 || !["sample_mean", "time_weighted"].includes(mode)) throw new Error("invalid_gauge_policy");
  if (input.length > 100000) throw new Error("input_bound_exceeded");
  const samples = input.map(row => {
    integer(row.unscaled, true);
    const at = instant(row.at), until = row.validUntil === undefined ? undefined : instant(row.validUntil);
    if (until !== undefined && until <= at) throw new Error("invalid_gauge_validity");
    if (mode === "time_weighted" && until === undefined) throw new Error("gauge_duration_required");
    return { ...row, at, until, value: BigInt(row.unscaled) };
  }).filter(row => mode === "sample_mean" ? row.at >= start && row.at < end : row.at < end && row.until! > start)
    .sort((a, b) => a.at - b.at);
  let numerator = 0n, denominator = 0n, previousEnd = -Infinity;
  let minimum: typeof samples[number] | undefined, maximum: typeof minimum;
  for (const row of samples) {
    const from = Math.max(start, row.at), to = Math.min(end, row.until ?? row.at);
    if (mode === "time_weighted" && from < previousEnd || mode === "sample_mean" && row.at === previousEnd) throw new Error("overlapping_gauge_samples");
    previousEnd = mode === "time_weighted" ? to : row.at;
    const weight = mode === "time_weighted" ? BigInt(to - from) : 1n;
    numerator += row.value * weight; denominator += weight;
    if (!minimum || row.value < minimum.value) minimum = row;
    if (!maximum || row.value > maximum.value) maximum = row;
  }
  return {
    aggregationVersion: AGGREGATION_VERSION,
    period: { start: new Date(start).toISOString(), end: new Date(end).toISOString() },
    inputFingerprint: fingerprintOf({ version: AGGREGATION_VERSION, start, end, scale, mode,
      samples: samples.map(row => ({ at: row.at, until: row.until ?? null, unscaled: row.unscaled })) }),
    mode, scale, sampleCount: samples.length,
    mean: denominator ? { numerator: numerator.toString(), denominator: denominator.toString() } : null,
    minimum: minimum ? { unscaled: minimum.unscaled, observedAt: new Date(minimum.at).toISOString() } : null,
    maximum: maximum ? { unscaled: maximum.unscaled, observedAt: new Date(maximum.at).toISOString() } : null,
    coveredMilliseconds: mode === "time_weighted" ? denominator.toString() : null,
    expectedMilliseconds: String(end - start),
  };
}
