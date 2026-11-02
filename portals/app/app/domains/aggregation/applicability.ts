import { bounds, nativeWindows, type NativeGrain, type Period } from "./periods.ts";

export interface EffectiveMapping { mappingId: string; mappingVersion: string; period: Period }
export type MappingWindow = EffectiveMapping;
// Operates on ONE already-authorized stable physical/service subject.
export function planMappingWindows(period: Period, nativeGrain: NativeGrain, mappings: readonly EffectiveMapping[], servicePeriod?: Period) {
  const [start, end] = bounds(period);
  if (mappings.length > 10000) throw new Error("mapping_bound_exceeded");
  const service = servicePeriod === undefined ? [start, end] : bounds(servicePeriod);
  const activeStart = Math.max(start, service[0]!), activeEnd = Math.min(end, service[1]!);
  const ids = new Set<string>();
  const normalized = mappings.map(m => {
    if (!m.mappingId || m.mappingId === "*" || m.mappingId.trim() !== m.mappingId || ids.has(m.mappingId) || !/^[1-9][0-9]{0,29}$/.test(m.mappingVersion)) throw new Error("invalid_effective_mapping");
    ids.add(m.mappingId);
    const [a, b] = bounds(m.period);
    return { mappingId: m.mappingId, mappingVersion: m.mappingVersion, start: a, end: b };
  });
  const relevant = activeStart >= activeEnd ? [] : normalized.filter(m => m.start < activeEnd && m.end > activeStart).sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < relevant.length; i++) {
    if (relevant[i - 1]!.end > relevant[i]!.start) throw new Error("aggregate_subject_mapping_ambiguous");
  }
  const windows: MappingWindow[] = [];
  let cursor = 0;
  for (const window of nativeWindows(period, nativeGrain)) {
    const [a, b] = bounds(window);
    if (activeStart >= activeEnd || a >= activeEnd || b <= activeStart) continue;
    if (a < activeStart || b > activeEnd) throw new Error("unaligned_service_boundary");
    while (cursor < relevant.length && relevant[cursor]!.end <= a) cursor++;
    const owner = relevant[cursor];
    if (!owner || owner.start >= b) throw new Error("aggregate_mapping_gap");
    if (owner.start > a || owner.end < b) throw new Error("unaligned_mapping_boundary");
    windows.push({ mappingId: owner.mappingId, mappingVersion: owner.mappingVersion, period: window });
  }
  return { applicablePeriods: windows.map(w => ({ ...w.period })), mappingWindows: windows };
}
