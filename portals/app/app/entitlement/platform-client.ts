// Adapted from the yucer engineering reference for product bsmoss.
import { getS2SConfig } from "../platform/s2s";
import { mintChannelToken } from "../platform/channel-token";
import { BRAND } from "@bsmoss/shared/brand";
import { assertInternalTarget } from "../lib/internal-target";
import { EMPTY_ENTITLEMENT, type Entitlement, type QuotaPool } from "./types";

export interface PlatformClientConfig {
  baseUrl: string;
  accessToken: (workspaceId: string | null) => Promise<string>;
  product: string;
}

export function getPlatformClientConfig(env: Record<string, string | undefined> = process.env): PlatformClientConfig | null {
  const baseUrl = env.PLATFORM_API_URL?.trim();
  const config = getS2SConfig(env);
  if (!baseUrl || !config.enabled) return null;
  return { baseUrl, accessToken: (workspaceId) => mintChannelToken(workspaceId, { config }), product: BRAND.productCode };
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export const DEFAULT_CACHE_TTL_MS = 45_000;

export function ttlMsFromCacheControl(header: string | null): number {
  if (header && /(?:^|,)\s*(?:no-store|no-cache)(?:\s|,|$)/i.test(header)) return 0;
  const match = header ? /(?:^|,)\s*max-age=(\d+)/i.exec(header) : null;
  if (!match) return DEFAULT_CACHE_TTL_MS;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, DEFAULT_CACHE_TTL_MS) : DEFAULT_CACHE_TTL_MS;
}

export interface EntitlementFetch {
  entitlement: Entitlement;

  ttlMs: number;
}

export function parseEntitlementEnvelope(
  workspaceId: string,
  product: string,
  raw: unknown,
): Entitlement {
  const o = (raw ?? {}) as Record<string, unknown>;
  if ((o.workspace_id !== undefined && o.workspace_id !== workspaceId) ||
      (o.product !== undefined && o.product !== product)) throw new Error("entitlement_scope_mismatch");
  const limits: Record<string, number> = {};
  if (o.limits && typeof o.limits === "object") {
    for (const [k, v] of Object.entries(o.limits as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) limits[k] = v;
    }
  }
  const pools: QuotaPool[] = Array.isArray(o.quota_pools)
    ? (o.quota_pools as unknown[]).flatMap((p) => {
        const pp = p as Record<string, unknown>;
        const metric = str(pp.metric);
        return metric
          ? [{ metric, limit: num(pp.limit), remaining: num(pp.remaining), priority: num(pp.priority) }]
          : [];
      })
    : [];
  return {
    ...EMPTY_ENTITLEMENT,
    workspace_id: workspaceId,
    product,

    status: str(o.status),
    trial_ends_at: str(o.trial_ends_at),
    current_period_end: str(o.current_period_end),
    cancel_at_period_end: o.cancel_at_period_end === true,
    data_retention_until: str(o.data_retention_until),
    tier: (str(o.tier) as Entitlement["tier"]) ?? null,
    bundled: o.bundled === true,
    limits,
    quota_pools: pools,
  };
}

export async function fetchEntitlement(
  cfg: PlatformClientConfig,
  workspaceId: string,
): Promise<EntitlementFetch> {
  const url = assertInternalTarget(
    `${cfg.baseUrl.replace(/\/$/, "")}/platform/entitlements` +
      `?workspace_id=${encodeURIComponent(workspaceId)}&product=${encodeURIComponent(cfg.product)}`,
  );
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${await cfg.accessToken(workspaceId)}`, accept: "application/json" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`entitlement endpoint ${res.status}`);
  const entitlement = parseEntitlementEnvelope(workspaceId, cfg.product, await res.json());
  // Respect response freshness directives within the product's maximum TTL.
  const ttlMs = ttlMsFromCacheControl(res.headers.get("cache-control"));
  return { entitlement, ttlMs };
}
