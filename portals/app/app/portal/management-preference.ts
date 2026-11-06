// Browser preferences, never product authorization.
export const MANAGEMENT_NAV_COOKIE = "bsmoss-management-nav";
export const MANAGEMENT_GROUPS_COOKIE = "bsmoss-management-groups";
export function readManagementGroups(raw: string | undefined): string[] {
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw ?? "[]"));
    return Array.isArray(value) && value.length <= 20 && value.every(v => typeof v === "string" && v.length <= 80) ? [...new Set(value)] : [];
  } catch { return []; }
}
export function saveManagementPreference(name: string, value: string) {
  try {
    document.cookie = name + "=" + value + "; Path=/; Max-Age=31536000; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
  } catch { /* The current navigation remains usable without persistence. */ }
}
