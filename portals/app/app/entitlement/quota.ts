// Adapted from the yucer engineering reference for product bsmoss.
import type { Entitlement, QuotaPool } from "./types";

export const UNLIMITED = -1;

export function isUnlimited(limit: number): boolean {
  return limit === UNLIMITED;
}

export function limitOf(e: Entitlement, metricKey: string): number | undefined {
  return Object.prototype.hasOwnProperty.call(e.limits, metricKey)
    ? e.limits[metricKey]
    : undefined;
}

export function withinCap(
  e: Entitlement,
  metricKey: string,
  currentCount: number,
  opts: { defaultWhenAbsent?: number } = {},
): boolean {
  const limit = limitOf(e, metricKey) ?? opts.defaultWhenAbsent;
  if (limit === undefined) return false;
  if (isUnlimited(limit)) return true;
  return currentCount < limit;
}

export function poolFor(e: Entitlement, metric: string): QuotaPool | undefined {
  return e.quota_pools.find((p) => p.metric === metric);
}

export function poolRemaining(e: Entitlement, metric: string): number {
  const pool = poolFor(e, metric);
  return pool ? pool.remaining : 0;
}
