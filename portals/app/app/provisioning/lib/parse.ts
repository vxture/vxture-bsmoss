import type { ProvisioningEvent } from "./handler";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseProvisioning(raw: string, deliveryId: string | null): ProvisioningEvent {
  const event = JSON.parse(raw) as Record<string, unknown>;
  if (!event || typeof event !== "object" || Array.isArray(event) ||
      typeof event.id !== "string" || !event.id || event.id.length > 128 || event.id !== deliveryId ||
      typeof event.type !== "string" || !event.type || event.type.length > 64 ||
      typeof event.workspace_id !== "string" || !UUID.test(event.workspace_id) ||
      typeof event.application !== "string" || !event.application || event.application.length > 32 ||
      event.tenant_id !== undefined && (typeof event.tenant_id !== "string" || !UUID.test(event.tenant_id))) throw new Error("invalid_provisioning_event");
  const sequenced = ["tenant.provisioned", "tenant.deprovisioned"].includes(event.type);
  if ((sequenced || event.seq !== undefined) && (!Number.isSafeInteger(event.seq) || Number(event.seq) < 0)) throw new Error("invalid_provision_seq");
  return { ...event, seq: event.seq ?? 0 } as unknown as ProvisioningEvent;
}
