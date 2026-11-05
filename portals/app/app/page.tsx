import { rememberedRegionInput } from "./portal/region-preference";
import PageHeading from "./portal/page-heading";
import { getOidcConfig } from "./auth/lib/config";
import ProductFrame from "./portal/header";
import PortalHome from "./portal/home";
import { Button, PanelCard, ShellPageContainer } from "@vxture/design-system";

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const preview = process.env.BSMOSS_PRODUCT_PREVIEW === "on";
  // Synthetic resources are loaded only for the explicitly enabled preview.
  let demo = null;
  if (preview) {
    try { demo = (await import("./portal/demo")).portalDemoSummary(await rememberedRegionInput(await searchParams)); }
    catch (error) {
      if (!(error instanceof Error && error.message.startsWith("invalid_"))) throw error;
      return <ProductFrame active="home" preview><ShellPageContainer className="product-page-inset max-w-none"><PageHeading title={"\u8fd0\u884c\u603b\u89c8"} />
      <div role="alert"><PanelCard title={"\u603b\u89c8\u8303\u56f4\u65e0\u6548"} icon="search">
        <Button asChild><a href="/">{"\u91cd\u7f6e\u603b\u89c8\u8303\u56f4"}</a></Button>
      </PanelCard></div></ShellPageContainer></ProductFrame>; }
  }
  return <ProductFrame active="home" preview={preview}>
    <PortalHome demo={demo} loginEnabled={getOidcConfig().enabled} />
  </ProductFrame>;
}
