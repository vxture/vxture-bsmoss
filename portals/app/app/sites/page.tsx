import ProductFrame from "../portal/header";
import { Button, PanelCard, ViewHeader } from "@vxture/design-system";
import { registryDemo } from "../domains/site-registry/demo-store";
import SiteRegistry from "./registry";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const preview = process.env.BSMOSS_PRODUCT_PREVIEW === "on";
  if (!preview) return <ProductFrame active="sites" preview={false}><div className="flex h-full w-full flex-col gap-lg p-xl">
    <ViewHeader title={"\u7ad9\u5740\u7ba1\u7406"} /><PanelCard title={"\u6b63\u5f0f\u7ad9\u5740\u53f0\u8d26\u5c1a\u672a\u5f00\u653e"} icon="building">
      <p className="text-body text-muted-foreground">{"\u5b8c\u6210\u7ad9\u5740\u6765\u6e90\u6388\u6743\u4e0e\u8d44\u6e90\u8bfb\u6a21\u578b\u63a5\u5165\u540e\uff0c\u5c55\u793a\u6743\u9650\u8303\u56f4\u5185\u7684\u53f0\u8d26\u53ca\u6863\u6848\u3002"}</p>
    </PanelCard></div></ProductFrame>;
  let demo;
  try { demo = registryDemo(await searchParams); }
  catch { return <ProductFrame active="sites"><div className="p-xl" role="alert"><ViewHeader title={"\u7ad9\u5740\u7b5b\u9009\u65e0\u6548"} />
    <Button asChild><a href="/sites">{"\u8fd4\u56de\u7ad9\u5740\u53f0\u8d26"}</a></Button></div></ProductFrame>; }
  return <ProductFrame active="sites" preview><SiteRegistry key={JSON.stringify(demo.query)} demo={demo} /></ProductFrame>;
}
