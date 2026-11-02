// Adapted from the yucer engineering reference for product bsmoss.
import { BRAND } from "@bsmoss/shared/brand";

export function pricingUrl(): string {
  const base = (process.env.NEXT_PUBLIC_WEBSITE_URL || "https://vxture.com").replace(/\/$/, "");
  const u = new URL(`${base}/pricing`);
  u.searchParams.set("product", BRAND.productCode);
  return u.toString();
}
