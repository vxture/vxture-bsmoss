// Adapted from the yucer engineering reference for product bsmoss.
import { type EntitlementResolver, makeEntitlement } from "./resolver";
import { fetchEntitlement, type PlatformClientConfig } from "./platform-client";
import type { Entitlement } from "./types";

interface Entry {
  value: Entitlement;
  expiresAt: number;
}

export interface PlatformResolverDeps {
  fetchImpl?: typeof fetchEntitlement;
  now?: () => number;
}

export class PlatformEntitlementResolver implements EntitlementResolver {
  private cache = new Map<string, Entry>();
  private generation = new Map<string, object>();
  private pending = new Map<string, Promise<Entitlement>>();
  private readonly fetchImpl: typeof fetchEntitlement;
  private readonly now: () => number;

  constructor(
    private readonly cfg: PlatformClientConfig,
    deps: PlatformResolverDeps = {},
  ) {
    this.fetchImpl = deps.fetchImpl ?? fetchEntitlement;
    this.now = deps.now ?? Date.now;
  }

  async resolve(workspaceId: string): Promise<Entitlement> {
    const now = this.now();
    const hit = this.cache.get(workspaceId);
    if (hit && hit.expiresAt > now) return structuredClone(hit.value);
    const pending = this.pending.get(workspaceId);
    if (pending) return structuredClone(await pending);
    const generation = {};
    this.generation.set(workspaceId, generation);
    const promise = this.load(workspaceId, now, generation);
    this.pending.set(workspaceId, promise);
    return structuredClone(await promise);
  }

  private async load(workspaceId: string, now: number, generation: object): Promise<Entitlement> {
    try {
      const { entitlement, ttlMs } = await this.fetchImpl(this.cfg, workspaceId);
      if (this.generation.get(workspaceId) !== generation) return makeEntitlement(workspaceId, this.cfg.product);
      if (entitlement.workspace_id !== workspaceId || entitlement.product !== this.cfg.product) throw new Error("entitlement_scope_mismatch");
      if (this.cache.size >= 1000) this.cache.delete(this.cache.keys().next().value!);
      if (ttlMs > 0) this.cache.set(workspaceId, { value: structuredClone(entitlement), expiresAt: now + ttlMs });
      return structuredClone(entitlement);
    } catch {

      if (this.generation.get(workspaceId) === generation) this.cache.delete(workspaceId);
      return makeEntitlement(workspaceId, this.cfg.product);
    } finally {
      if (this.generation.get(workspaceId) === generation) {
        this.generation.delete(workspaceId);
        this.pending.delete(workspaceId);
      }
    }
  }

  invalidate(workspaceId: string): void {
    this.generation.delete(workspaceId);
    this.pending.delete(workspaceId);
    this.cache.delete(workspaceId);
  }
}
