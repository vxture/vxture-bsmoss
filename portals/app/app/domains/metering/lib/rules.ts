import { OPERATORS, type UsageRecord } from "../../shared/model.ts";
export function validateUsage(r: UsageRecord): void {
  if (![r.workspaceId, r.sourceId, r.sourceEventId, r.stationId].every(v => v.trim())) throw new Error("missing_identity");
  if (r.quantity < 0n) throw new Error("negative_quantity");
  if (r.operator !== null && !OPERATORS.includes(r.operator)) throw new Error("invalid_operator");
  if (!["verified", "pending", "rejected"].includes(r.quality)) throw new Error("invalid_quality");
  if (!((r.usageType === "voice" && r.unit === "second") || (r.usageType === "data" && r.unit === "byte"))) throw new Error("unit_mismatch");
  const start = Date.parse(r.periodStart), end = Date.parse(r.periodEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("invalid_period");
  if (r.quality === "verified" && r.operator === null) throw new Error("unattributed_usage");
}
