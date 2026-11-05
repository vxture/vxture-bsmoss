import { cache } from "react";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { getOidcConfig } from "../auth/lib/config";
import { getAuthUser } from "../auth/lib/session";
import { decodeRegionPreference, inheritRegionInput, PROVINCE_SCOPE, type RegionInput, type RegionPreference } from "./region-scope";

// Preferences are display/filter input only; destination services retain all
// entitlement and workspace checks. No identity or credentials enter the cookie.
export const getRegionPreference = cache(async () => {
  const jar = await cookies(), cfg = getOidcConfig(), sid = cfg.enabled ? jar.get(cfg.cookieName)?.value : undefined;
  const user = sid ? await getAuthUser(cfg, sid).catch(() => null) : null;
  const active = user?.accountStatus === "active" ? user : null;
  const namespace = active ? createHash("sha256").update(JSON.stringify([active.sub, active.activeOrg, active.activeWorkspace])).digest("hex").slice(0, 24) : "preview";
  // Formal catalogues must come from the authorized read model, never fixtures.
  const source = process.env.BSMOSS_PRODUCT_PREVIEW === "on" ? (await import("../domains/map-demo/resources")).DEMO_REGION : null;
  const catalog = source ? { id: source.id, name: source.name, cities: source.cities.map(({ id, name }) => ({ id, name })), counties: source.counties.map(({ id, cityId, name }) => ({ id, cityId, name })) } : null;
  const cookieName = "bsmoss-region-v1-" + namespace;
  const preference: RegionPreference = { catalog, cookieName, selection: catalog ? decodeRegionPreference(catalog, jar.get(cookieName)?.value) ?? PROVINCE_SCOPE : PROVINCE_SCOPE };
  return { preference, user: active };
});
export async function rememberedRegionInput(input: RegionInput): Promise<RegionInput> {
  const { preference } = await getRegionPreference();
  return preference.catalog ? inheritRegionInput(input, preference.selection) : input;
}
