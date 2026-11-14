import { homeGrowth } from "./portal/home-growth";
import ProductFrame from "./portal/header";
import LandingHome from "./portal/landing-home";
import OverviewDisplayRedirect from "./portal/overview-display-redirect";
import { rememberedRegionInput } from "./portal/region-preference";
export const dynamic = "force-dynamic";
export default async function Home({searchParams}: {searchParams: Promise<Record<string,string|string[]|undefined>>}) {
 const preview = process.env.BSMOSS_PRODUCT_PREVIEW === "on";
 let demo = null;
 if (preview) {
  const input = await searchParams;
  const scope = Object.fromEntries(Object.entries(input).filter(([key]) => ["city","county"].includes(key)));
  try { demo = (await import("./portal/demo")).portalDemoSummary(await rememberedRegionInput({...scope, reportPeriod: "month"})); }
  catch(error) { if (!(error instanceof Error && error.message.startsWith("invalid_"))) throw error; }
 }
 const growth = demo ? await homeGrowth(demo).catch(error => {
  if (error instanceof Error && /^demo_history(?:_rollups)?_not_installed$/.test(error.message)) return null;
  throw error;
 }) : null;
 return <ProductFrame active="home" preview={preview}><OverviewDisplayRedirect/><LandingHome demo={demo} growth={growth}/></ProductFrame>;
}
