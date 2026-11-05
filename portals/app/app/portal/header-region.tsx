"use client";
import { useEffect, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { normalizeRegion, type RegionCatalog, type RegionSelection } from "./region-selection";
import { changedRegionHref, encodeRegionPreference, isRegionPage, type RegionPreference } from "./region-scope";

export function rememberBrowserRegion(cookieName: string, catalog: RegionCatalog, value: RegionSelection) {
  try {
    document.cookie = cookieName + "=" + encodeRegionPreference(catalog, value) + "; Path=/; Max-Age=31536000; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
  } catch { /* Explicit scoped links still work when browser storage is blocked. */ }
}
export function useHeaderRegion(preference: RegionPreference) {
  const path = usePathname(), params = useSearchParams(), router = useRouter(), [pending, start] = useTransition();
  const aggregate = isRegionPage(path), catalog = preference.catalog;
  const explicit = aggregate && (params.has("city") || params.has("county"));
  const requested = explicit ? { cityId: params.get("city") ?? "all", countyId: params.get("county") ?? "all" } : preference.selection;
  const value = catalog ? normalizeRegion(catalog, requested) : preference.selection;
  const valid = value.cityId === requested.cityId && value.countyId === requested.countyId && params.getAll("city").length <= 1 && params.getAll("county").length <= 1;
  const query = params.toString();
  useEffect(() => {
    if (!catalog || !aggregate || !valid) return;
    rememberBrowserRegion(preference.cookieName, catalog, value);
    // Canonical URLs make history, copied links and new tabs unambiguous.
    if (!params.has("city") || !params.has("county")) {
      const next = new URLSearchParams(query); next.set("city", value.cityId); next.set("county", value.countyId);
      router.replace(path + "?" + next, { scroll: false });
    }
  }, [catalog, aggregate, valid, preference.cookieName, path, query, value.cityId, value.countyId, router]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (next: RegionSelection) => {
    if (!catalog) return;
    rememberBrowserRegion(preference.cookieName, catalog, next);
    start(() => {
      if (path.startsWith("/settings")) router.refresh();
      else router.push(changedRegionHref(path, query, next), { scroll: false });
    });
  };
  return { value, change, pending };
}
