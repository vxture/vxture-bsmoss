import { timestamp } from "../measurements/rules.ts";
import { GRAINS, type Grain } from "../catalog/registry.ts";

export type NativeGrain = Grain | "5m";
export interface Period { start: string; end: string }
const OFFSET = 8 * 60 * 60 * 1000;
const DAY = 86400000;

// Current business-calendar rules: Asia/Shanghai since 1992 (UTC+08:00).
export function instant(value: string): number {
  const ms = Date.parse(timestamp(value));
  if (ms < Date.parse("1992-01-01T00:00:00+08:00")) throw new Error("unsupported_calendar_date");
  return ms;
}
export function bounds(period: Period): [number, number] {
  const start = instant(period.start), end = instant(period.end);
  if (end <= start) throw new Error("invalid_period");
  return [start, end];
}
export function bucketFor(at: string, grain: NativeGrain): Period {
  if (grain !== "5m" && !GRAINS.includes(grain)) throw new Error("unsupported_grain");
  const ms = instant(at), local = new Date(ms + OFFSET);
  let start: number, end: number;
  if (grain === "5m" || grain === "15m" || grain === "hour") {
    const duration = grain === "5m" ? 300000 : grain === "15m" ? 900000 : 3600000;
    start = Math.floor((ms + OFFSET) / duration) * duration - OFFSET;
    end = start + duration;
  } else {
    local.setUTCHours(0, 0, 0, 0);
    if (grain === "week") local.setUTCDate(local.getUTCDate() - (local.getUTCDay() + 6) % 7);
    if (grain === "month") local.setUTCDate(1);
    start = local.getTime() - OFFSET;
    if (grain === "month") { local.setUTCMonth(local.getUTCMonth() + 1); end = local.getTime() - OFFSET; }
    else end = start + (grain === "week" ? 7 : 1) * DAY;
  }
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

// Enumerates whole native windows only; never apportions an interval counter.
export function nativeWindows(period: Period, grain: NativeGrain): readonly Period[] {
  const [start, end] = bounds(period);
  const windows: Period[] = [];
  let cursor = start;
  while (cursor < end) {
    if (windows.length >= 10000) throw new Error("window_bound_exceeded");
    const next = bucketFor(new Date(cursor).toISOString(), grain);
    if (Date.parse(next.start) !== cursor || Date.parse(next.end) > end) throw new Error("unaligned_native_window");
    windows.push(next);
    cursor = Date.parse(next.end);
  }
  return windows;
}
