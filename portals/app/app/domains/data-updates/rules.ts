// Source watermarks are end-exclusive coverage boundaries, never host time or
// the selected analysis hour. Revisions can change without advancing coverage.
export const AVAILABILITY_SCHEMA = "bsmoss-data-availability-v1";
export const UPDATE_FAMILIES = ["overview", "station", "calendar", "history", "verification"] as const;
export type UpdateFamily = typeof UPDATE_FAMILIES[number];
export interface SourceWatermark {
  id: string; label: string; version: string;
  through: string | null; confirmed: boolean; syncedAt: string | null;
}
export interface DataAvailability {
  schema: typeof AVAILABILITY_SCHEMA; family: UpdateFamily;
  mode: "fixed_synthetic"; sources: SourceWatermark[];
}
function instant(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)) throw Error("invalid_data_instant");
  const time = Date.parse(value);
  const day = new Date(value.slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(time) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value.slice(0, 10)) throw Error("invalid_data_instant");
  return time;
}
function fields(value: unknown, names: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== names.length || Object.keys(value).some(k => !names.includes(k))) throw Error("invalid_availability");
}
export function readAvailability(raw: unknown): DataAvailability {
  fields(raw, ["schema", "family", "mode", "sources"]);
  if (raw.schema !== AVAILABILITY_SCHEMA || !UPDATE_FAMILIES.includes(raw.family as UpdateFamily) || raw.mode !== "fixed_synthetic" || !Array.isArray(raw.sources) || !raw.sources.length || raw.sources.length > 16) throw Error("invalid_availability");
  const ids = new Set<string>();
  for (const source of raw.sources) {
    fields(source, ["id", "label", "version", "through", "confirmed", "syncedAt"]);
    for (const key of ["id", "label", "version"]) if (typeof source[key] !== "string" || !(source[key] as string).trim() || (source[key] as string).length > 160) throw Error("invalid_availability");
    if (ids.has(source.id as string) || typeof source.confirmed !== "boolean") throw Error("invalid_availability");
    ids.add(source.id as string);
    if (source.through !== null) instant(source.through);
    if (source.syncedAt !== null) instant(source.syncedAt);
  }
  const result = structuredClone(raw) as unknown as DataAvailability;
  for (const source of result.sources) {
    if (source.through !== null) source.through = new Date(instant(source.through)).toISOString();
    if (source.syncedAt !== null) source.syncedAt = new Date(instant(source.syncedAt)).toISOString();
  }
  return result;
}
export function commonThrough(raw: DataAvailability): string | null {
  const data = readAvailability(raw);
  if (data.sources.some(s => !s.confirmed || s.through === null)) return null;
  // Only a fully covered hour is eligible. A partial next hour is not a promise.
  return new Date(Math.floor(Math.min(...data.sources.map(s => instant(s.through))) / 3600000) * 3600000).toISOString();
}
export function formatDataTime(value: string | null): string {
  return value === null ? "\u5f85\u786e\u8ba4" : new Date(instant(value) + 8 * 3600000).toISOString().slice(0, 16).replace("T", " ");
}
export type UpdatePlan = { state: "current" | "available" | "unknown" | "incompatible" | "regressed"; current: string | null; latest: string | null; changedSources: string[] };
export function planDataUpdate(head: DataAvailability, available: DataAvailability): UpdatePlan {
  const a = readAvailability(head), b = readAvailability(available), current = commonThrough(a), latest = commonThrough(b);
  const result = { current, latest, changedSources: [] as string[] };
  if (a.family !== b.family || a.mode !== b.mode || a.sources.length !== b.sources.length || a.sources.some(s => !b.sources.some(t => t.id === s.id))) return { ...result, state: "incompatible" };
  if (latest === null) return { ...result, state: "unknown" };
  if (b.sources.some(s => { const old = a.sources.find(t => t.id === s.id)!; return s.through !== null && old.through !== null && instant(s.through) < instant(old.through); })) return { ...result, state: "regressed" };
  const changedSources = b.sources.filter(s => { const old = a.sources.find(t => t.id === s.id)!; return s.version !== old.version || s.through !== old.through || s.confirmed !== old.confirmed; }).map(s => s.id);
  // Sync execution timestamps alone never create a new data version.
  return { ...result, changedSources, state: changedSources.length || current === null ? "available" : "current" };
}
