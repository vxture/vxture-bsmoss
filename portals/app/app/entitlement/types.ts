// Adapted from the yucer engineering reference for product bsmoss.
import type { Tier } from "@vxture/shared";

export { TIERS, SUBSCRIPTION_STATUSES } from "@vxture/shared";
export type { Tier, SubscriptionStatus } from "@vxture/shared";

export interface QuotaPool {
  metric: string;
  limit: number;
  remaining: number;
  priority: number;
}

export interface Entitlement {
  workspace_id: string;
  product: string;

  status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  data_retention_until: string | null;
  tier: Tier | null;
  bundled: boolean;
  limits: Record<string, number>;
  quota_pools: QuotaPool[];
}

export const EMPTY_ENTITLEMENT: Omit<Entitlement, "workspace_id" | "product"> = {
  status: null,
  trial_ends_at: null,
  current_period_end: null,
  cancel_at_period_end: false,
  data_retention_until: null,
  tier: null,
  bundled: false,
  limits: {},
  quota_pools: [],
};

export function hasProductAccess(e: Entitlement): boolean {
  return e.tier != null;
}

export function hasDataAccess(e: Entitlement): boolean {
  return e.tier != null || e.bundled;
}

export type Cta = "subscribe" | "pay" | "renew" | "none";

export function ctaFor(e: Entitlement): Cta {
  if (e.tier != null && (e.status === "active" || e.status === "trialing")) return "none";
  if (e.status == null) return "subscribe";
  if (e.status === "overdue") return "pay";
  if (e.status === "expired" || e.status === "cancelled" || e.status === "suspended") {
    return "renew";
  }

  return e.tier != null ? "none" : "subscribe";
}
