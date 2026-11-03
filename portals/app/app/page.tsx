import { getOidcConfig } from "./auth/lib/config";
import ProductHeader from "./portal/header";
import PortalHome from "./portal/home";
import "./portal/portal.css";

export const dynamic = "force-dynamic";
export default async function Home() {
  const preview = process.env.BSMOSS_PRODUCT_PREVIEW === "on";
  // Synthetic resources are loaded only for the explicitly enabled preview.
  const demo = preview ? (await import("./portal/demo")).portalDemoSummary() : null;
  return <main className="portal-shell">
    <ProductHeader active="home" preview={preview} />
    <PortalHome demo={demo} loginEnabled={getOidcConfig().enabled} />
  </main>;
}
