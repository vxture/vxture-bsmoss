import { getOidcConfig } from "./auth/lib/config";
import ProductFrame from "./portal/header";
import PortalHome from "./portal/home";

export const dynamic = "force-dynamic";
export default async function Home() {
  const preview = process.env.BSMOSS_PRODUCT_PREVIEW === "on";
  // Synthetic resources are loaded only for the explicitly enabled preview.
  const demo = preview ? (await import("./portal/demo")).portalDemoSummary() : null;
  return <ProductFrame active="home" preview={preview}>
    <PortalHome demo={demo} loginEnabled={getOidcConfig().enabled} />
  </ProductFrame>;
}
