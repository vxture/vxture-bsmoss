export const OPERATORS = ["telecom", "unicom", "mobile", "broadcast", "other"] as const;
export type Operator = typeof OPERATORS[number];
export type UsageType = "voice" | "data";
export interface Station { id: string; workspaceId: string; owner: "tower"; provinceCode: "610000"; cityCode: string; name: string }
export interface UsageRecord {
  workspaceId: string; sourceId: string; sourceEventId: string; stationId: string;
  operator: Operator | null; usageType: UsageType; quantity: bigint;
  unit: "second" | "byte"; periodStart: string; periodEnd: string;
  quality: "verified" | "pending" | "rejected";
}
export interface AccessContext { workspaceId: string; sub: string; features: ReadonlySet<string>; permissions: ReadonlySet<string> }
export function authorize(ctx: AccessContext, feature: string, permission: string) {
  if (!ctx.workspaceId || !ctx.sub) throw new Error("identity_required");
  if (!ctx.features.has(feature)) throw new Error("feature_denied");
  if (!ctx.permissions.has(permission)) throw new Error("permission_denied");
}
