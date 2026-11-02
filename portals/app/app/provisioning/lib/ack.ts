// Adapted from the yucer engineering reference for product bsmoss.
import { getPlatformClientConfig, type PlatformClientConfig } from "../../entitlement/platform-client";
import { assertInternalTarget } from "../../lib/internal-target";

export interface ProvisioningAckResult {
  status: number;
  body?: { workspace_id?: string; product?: string; acked_at?: string; replayed?: boolean } & Record<string, unknown>;
}

export type ProvisioningAckFn = (input: {
  workspaceId: string;
  status: "ready" | "failed";

  deliveryId?: string;
  detail?: Record<string, unknown>;
}) => Promise<ProvisioningAckResult>;

export function makeProvisioningAck(cfg: PlatformClientConfig): ProvisioningAckFn {
  return async (input) => {
    const url = assertInternalTarget(`${cfg.baseUrl.replace(/\/$/, "")}/provisioning/ack`);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await cfg.accessToken(input.workspaceId)}`,
      },
      body: JSON.stringify({
        workspace_id: input.workspaceId,
        product: cfg.product,
        status: input.status,
        ...(input.deliveryId ? { delivery_id: input.deliveryId } : {}),
        ...(input.detail ? { detail: input.detail } : {}),
      }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    let body: ProvisioningAckResult["body"];
    try {
      const parsed = (await res.json()) as ProvisioningAckResult["body"] | null;
      if (parsed && typeof parsed === "object") body = parsed;
    } catch {
      // A response with no JSON body is still a real response - status is what matters.
    }
    return { status: res.status, body };
  };
}

/**
 * Send the ack, or silently do nothing when the platform is not configured -
 * same offline posture as C2 and C3-up's own callers (getPlatformClientConfig
 * returning null already means every other platform call is a no-op here).
 * Errors are swallowed rather than thrown - see the file header: this call
 * must never turn into a reason to fail the webhook that triggered it.
 */
export async function sendProvisioningAck(input: {
  workspaceId: string;
  status: "ready" | "failed";
  deliveryId?: string;
  detail?: Record<string, unknown>;
}): Promise<ProvisioningAckResult | null> {
  const cfg = getPlatformClientConfig();
  if (!cfg) return null;
  try {
    return await makeProvisioningAck(cfg)(input);
  } catch {
    return null;
  }
}
