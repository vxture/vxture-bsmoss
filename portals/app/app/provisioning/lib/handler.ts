// Adapted from the yucer engineering reference for product bsmoss.
import type { ProvisioningStore } from "./store";

export interface ProvisioningEvent {
  id: string;
  type: string;
  occurred_at?: number;
  seq: number;
  workspace_id: string;
  tenant_id?: string;
  application: string;
  plan?: string | null;
  data?: unknown;
}

export interface HandleResult {
  ok: true;
  handled: boolean;
  reason?: "wrong-product" | "duplicate" | "stale" | "processed";
}

export interface HandlerDeps {
  store: ProvisioningStore;
  product: string;
  onSubscriptionChanged?: (workspaceId: string) => void;
  onProvisioned?: (workspaceId: string) => Promise<void> | void;
}

const SEQ_BEARING_TYPES = new Set(["tenant.provisioned", "tenant.deprovisioned"]);

export async function handleProvisioning(
  event: ProvisioningEvent,
  deps: HandlerDeps,
): Promise<HandleResult> {
  if (event.application !== deps.product) return { ok: true, handled: false, reason: "wrong-product" };
  const result = await deps.store.withWorkspaceLock(event.workspace_id, deps.product, (store) =>
    handleLocked(event, { product: deps.product, store }));
  // Invalidation also runs for retries after a commit; ACKs never precede commit.
  if (["tenant.provisioned", "tenant.deprovisioned", "subscription_changed", "grant.invalidated"].includes(event.type)) {
    deps.onSubscriptionChanged?.(event.workspace_id);
  }
  if (event.type === "tenant.provisioned" && (result.handled || result.reason === "duplicate")) {
    await deps.onProvisioned?.(event.workspace_id);
  }
  return result;
}

async function handleLocked(event: ProvisioningEvent, deps: Pick<HandlerDeps, "store" | "product">): Promise<HandleResult> {

  if (event.application !== deps.product) {
    return { ok: true, handled: false, reason: "wrong-product" };
  }

  if (await deps.store.isDelivered(event.id)) {
    return { ok: true, handled: false, reason: "duplicate" };
  }

  const seqBearing = SEQ_BEARING_TYPES.has(event.type);

  if (seqBearing) {
    const lastSeq = await deps.store.getLastSeq(event.workspace_id, deps.product);
    if (event.seq <= lastSeq) {
      return { ok: true, handled: false, reason: "stale" };
    }
  }

  switch (event.type) {
    case "tenant.provisioned":
      await deps.store.upsertInstance(event.workspace_id, deps.product, "provisioned");
      break;
    case "tenant.deprovisioned":

      await deps.store.upsertInstance(event.workspace_id, deps.product, "deprovisioned");
      break;
    case "subscription_changed":
      break;
    case "grant.invalidated":

      break;
    default:

      break;
  }

  await deps.store.markDelivered(event.id, { type: event.type, result: "processed" });
  if (seqBearing) {
    await deps.store.setSeq(event.workspace_id, deps.product, event.seq);
  }
  return { ok: true, handled: true, reason: "processed" };
}
