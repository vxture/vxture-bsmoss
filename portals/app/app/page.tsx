import { demoDataEnabled } from "./lib/demo-mode";
import { readHomeSummary } from "./portal/home-read-model";
import ProductFrame from "./portal/header";
import LandingHome from "./portal/landing-home";
import OverviewDisplayRedirect from "./portal/overview-display-redirect";
import { rememberedRegionInput } from "./portal/region-preference";
export const dynamic = "force-dynamic";
export default async function Home({searchParams}: {searchParams: Promise<Record<string,string|string[]|undefined>>}) {
 const preview = demoDataEnabled();
 let demo = null, growth = null;
 if (preview) {
  const input = await searchParams;
  const scope = Object.fromEntries(Object.entries(input).filter(([key]) => ["city","county"].includes(key)));
  try { ({demo,growth} = readHomeSummary(await rememberedRegionInput(scope))); }
  catch(error) { if (!(error instanceof Error && error.message.startsWith("invalid_"))) throw error; }
 }
 return <ProductFrame active="home" preview={preview}><OverviewDisplayRedirect/><LandingHome demo={demo} growth={growth}/></ProductFrame>;
}
