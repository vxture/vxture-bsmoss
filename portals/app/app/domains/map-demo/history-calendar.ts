// Versioned synthetic coverage, independent of the host clock.
export const HISTORY_START = '2024-11-01';
export const HISTORY_END = '2026-11-01';
export const HISTORY_VERSION = 'bsmoss-history-v2';
export const DAY_MS = 86400000;
export function dateNumber(value: string): number {
  const n = Date.parse(value + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== value) throw Error('invalid_history_date');
  return n;
}
export const isoDay = (n: number) => new Date(n).toISOString().slice(0, 10);
export function historicalDate(value: string) {
  const n = dateNumber(value);
  if (value < HISTORY_START || value >= HISTORY_END) throw Error('outside_history_coverage');
  return new Date(n);
}
export function yearBefore(value: string): string {
  const d = new Date(dateNumber(value)), year = d.getUTCFullYear() - 1, month = d.getUTCMonth();
  const day = Math.min(d.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return isoDay(Date.UTC(year, month, day));
}
export function monthEnd(month: string): string {
  dateNumber(month + '-01');
  return isoDay(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1));
}
