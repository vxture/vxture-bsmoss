import type { Operator, UsageRecord, UsageType } from "../../shared/model.ts";
export interface Tariff {
  id: string; version: number; workspaceId: string; operator: Operator; usageType: UsageType;
  unit: "second" | "byte"; quantityPerBlock: bigint; priceFenPerBlock: bigint;
  effectiveFrom: string; effectiveTo: string;
}
// One record must fit one tariff version. Split intervals upstream at a tariff boundary.
// Round once per record to nearest fen, ties upward; no floating point currency.
export function rateUsage(record: UsageRecord, tariff: Tariff): bigint {
  if (record.quality !== "verified" || record.operator === null) throw new Error("unverified_usage");
  if (record.workspaceId !== tariff.workspaceId || record.operator !== tariff.operator || record.usageType !== tariff.usageType || record.unit !== tariff.unit) throw new Error("tariff_mismatch");
  if (record.quantity < 0n || tariff.quantityPerBlock <= 0n || tariff.priceFenPerBlock < 0n) throw new Error("invalid_amount");
  const start = Date.parse(record.periodStart), end = Date.parse(record.periodEnd);
  const from = Date.parse(tariff.effectiveFrom), to = Date.parse(tariff.effectiveTo);
  if (![start, end, from, to].every(Number.isFinite) || end <= start || to <= from || start < from || end > to) throw new Error("tariff_period_mismatch");
  const numerator = record.quantity * tariff.priceFenPerBlock;
  return (2n * numerator + tariff.quantityPerBlock) / (2n * tariff.quantityPerBlock);
}
