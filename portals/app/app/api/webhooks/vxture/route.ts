import { boundedText } from "../../../lib/http";
import { errorResponse } from "../../../platform/envelope";
import { getEntitlementResolver } from "../../../entitlement/resolver";
import { handleProvisioning } from "../../../provisioning/lib/handler";
import { parseProvisioning } from "../../../provisioning/lib/parse";
import { getProvisioningStore } from "../../../provisioning/lib/runtime";
import { verifySignature, webhookSecrets } from "../../../provisioning/lib/verify";
import { sendProvisioningAck } from "../../../provisioning/lib/ack";

export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  const secrets = webhookSecrets();
  if (!secrets.length) return errorResponse(503, "PROVISION_UNCONFIGURED", "Provisioning is not configured");
  let raw: string;
  try { raw = await boundedText(request); }
  catch { return errorResponse(413, "PROVISION_BODY_TOO_LARGE", "Request body exceeds limit"); }
  if (!verifySignature(raw, request.headers.get("x-vxture-signature"), secrets)) return errorResponse(401, "PROVISION_INVALID_SIGNATURE", "Invalid signature");
  let event;
  try { event = parseProvisioning(raw, request.headers.get("x-vxture-delivery")); }
  catch { return errorResponse(400, "PROVISION_INVALID_EVENT", "Invalid event"); }
  try {
    const result = await handleProvisioning(event, {
      store: getProvisioningStore(), product: "bsmoss",
      onSubscriptionChanged: workspace => getEntitlementResolver().invalidate(workspace),
      onProvisioned: async workspace => { await sendProvisioningAck({ workspaceId: workspace, status: "ready", deliveryId: event.id }); },
    });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch { return errorResponse(503, "PROVISION_UNAVAILABLE", "Provisioning temporarily unavailable", { retryable: true }); }
}
