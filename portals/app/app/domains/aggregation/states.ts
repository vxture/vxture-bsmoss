import { bounds, instant, type Period } from "./periods.ts";
import { integer } from "../measurements/rules.ts";
import { AGGREGATION_VERSION, fingerprintOf, positiveRevision, type Quality } from "./intervals.ts";

export const DEVICE_STATES = ["running", "standby", "fault", "offline", "maintenance", "unknown"] as const;
export type DeviceState = typeof DEVICE_STATES[number];
export interface StateEvent {
  eventId: string; revision: string; qualityRevision: string; quality: Quality;
  at: string; validUntil: string; state: DeviceState; sequence?: string;
}

// One already-authorized device/source series. TTL is supplied by its capability.
export function aggregateStateTimeline(period: Period, input: readonly StateEvent[]) {
  const [start, end] = bounds(period);
  if (input.length > 100000) throw new Error("input_bound_exceeded");
  const observations = new Map<string, StateEvent>();
  const seen = new Map<string, string>();
  const rawRevisions = new Map<string, string>();
  for (const raw of input) {
    const row = { ...raw, at: new Date(instant(raw.at)).toISOString(), validUntil: new Date(instant(raw.validUntil)).toISOString() };
    if (typeof row.eventId !== "string" || !row.eventId.trim() || row.eventId.trim() !== row.eventId || row.eventId.includes("\0") || row.eventId === "*" || !DEVICE_STATES.includes(row.state) || !["verified", "pending", "rejected"].includes(row.quality) || row.validUntil <= row.at) throw new Error("invalid_state_event");
    positiveRevision(row.revision); positiveRevision(row.qualityRevision);
    if (row.sequence !== undefined) integer(row.sequence);
    const logicalRevision = JSON.stringify([row.eventId, row.revision]);
    const payload = JSON.stringify([row.at, row.validUntil, row.state, row.sequence ?? null]);
    if (rawRevisions.has(logicalRevision) && rawRevisions.get(logicalRevision) !== payload) throw new Error("conflicting_replay");
    rawRevisions.set(logicalRevision, payload);
    const qkey = JSON.stringify([logicalRevision, row.qualityRevision]);
    if (seen.has(qkey) && seen.get(qkey) !== row.quality) throw new Error("conflicting_replay");
    seen.set(qkey, row.quality);
    const old = observations.get(row.eventId);
    if (!old || BigInt(row.revision) > BigInt(old.revision) || row.revision === old.revision && BigInt(row.qualityRevision) > BigInt(old.qualityRevision)) observations.set(row.eventId, row);
  }
  const groups = new Map<number, StateEvent[]>();
  for (const row of observations.values()) {
    const at = Date.parse(row.at);
    if (at >= end) continue;
    const group = groups.get(at) ?? []; group.push(row); groups.set(at, group);
  }
  const allEvents = [...groups].sort(([a], [b]) => a - b).map(([at, rows]) => {
    let row: StateEvent | undefined;
    if (rows.length === 1) row = rows[0];
    else if (rows.every(r => r.state === rows[0].state && r.validUntil === rows[0].validUntil && r.quality === rows[0].quality)) {
      row = [...rows].sort((a, b) => a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0)[0];
    }
    else if (rows.every(r => r.sequence !== undefined)) {
      const ordered = [...rows].sort((a, b) => BigInt(a.sequence!) > BigInt(b.sequence!) ? -1 : BigInt(a.sequence!) < BigInt(b.sequence!) ? 1 : 0);
      if (ordered[0].sequence !== ordered[1].sequence) row = ordered[0];
    }
    return { at, row };
  });
  const firstInside = allEvents.findIndex(event => event.at >= start);
  const events = allEvents.slice(firstInside < 0 ? Math.max(0, allEvents.length - 1) : Math.max(0, firstInside - 1));
  const usedAt = new Set(events.map(event => event.at));
  const evidence = [...observations.values()].filter(row => usedAt.has(Date.parse(row.at))).sort((a, b) => a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0);
  const stateAt = (at: number): DeviceState => {
    let lo = 0, hi = events.length - 1, found = -1;
    while (lo <= hi) { const mid = (lo + hi) >>> 1; if (events[mid].at <= at) { found = mid; lo = mid + 1; } else hi = mid - 1; }
    const current = events[found]?.row;
    return current && current.quality === "verified" && Date.parse(current.validUntil) > at ? current.state : "unknown";
  };
  const boundaries = new Set([start, end]);
  const realBoundaries = new Set<number>();
  for (const event of events) {
    for (const at of [event.at, ...(event.row ? [Date.parse(event.row.validUntil)] : [])]) {
      if (at >= start && at < end) { boundaries.add(at); realBoundaries.add(at); }
    }
  }
  const ordered = [...boundaries].sort((a, b) => a - b);
  const durations = Object.fromEntries(DEVICE_STATES.map(state => [state, 0n])) as Record<DeviceState, bigint>;
  const segments: Array<{ start: string; end: string; state: DeviceState }> = [];
  let knownTransitions = 0, gapTransitions = 0;
  for (let i = 0; i < ordered.length - 1; i++) {
    const from = ordered[i], to = ordered[i + 1], state = stateAt(from), previous = stateAt(from - 1);
    durations[state] += BigInt(to - from);
    if (realBoundaries.has(from) && state !== previous) {
      if (state !== "unknown" && previous !== "unknown") knownTransitions++;
      else gapTransitions++;
    }
    const last = segments.at(-1);
    if (last?.state === state) last.end = new Date(to).toISOString();
    else segments.push({ start: new Date(from).toISOString(), end: new Date(to).toISOString(), state });
  }
  return {
    aggregationVersion: AGGREGATION_VERSION,
    period: { start: new Date(start).toISOString(), end: new Date(end).toISOString() },
    inputFingerprint: fingerprintOf({ version: AGGREGATION_VERSION, period: { start, end }, events: events.map(event => ({ ...event, row: event.row ?? null })),
      evidence }),
    durationMilliseconds: Object.fromEntries(DEVICE_STATES.map(state => [state, durations[state].toString()])) as Record<DeviceState, string>,
    knownTransitions, gapTransitions, endState: stateAt(end - 1), segments,
    conflictCount: events.filter(event => !event.row).length,
    evidence: evidence.map(row => ({ eventId: row.eventId, revision: row.revision, qualityRevision: row.qualityRevision })),
    quality: durations.unknown > 0n ? "partial" : "complete",
  };
}
