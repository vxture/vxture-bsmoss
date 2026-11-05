import PageHeading from "../../portal/page-heading";
import { notFound } from "next/navigation";
import ProductFrame from "../../portal/header";
import { Button, PanelCard } from "@vxture/design-system";
import { dossierDemo } from "../../domains/site-registry/demo-store";
import SiteDossier from "../dossier";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.BSMOSS_PRODUCT_PREVIEW !== "on") return <ProductFrame active="sites" preview={false}><div className="flex h-full w-full flex-col gap-lg product-page-inset">
    <PageHeading title={"\u7ad9\u5740\u6863\u6848"} /><PanelCard title={"\u6b63\u5f0f\u7ad9\u5740\u6863\u6848\u5c1a\u672a\u5f00\u653e"} icon="building"><p className="text-body text-muted-foreground">{"\u7b49\u5f85\u5b8c\u6210\u6765\u6e90\u6388\u6743\u4e0e\u6863\u6848\u63a5\u5165\u3002"}</p></PanelCard>
  </div></ProductFrame>;
  let demo;
  try { demo = dossierDemo((await params).id, await searchParams); }
  catch { return <ProductFrame active="sites"><div className="product-page-inset" role="alert"><PageHeading title={"\u6863\u6848\u53c2\u6570\u65e0\u6548"} />
    <Button asChild><a href="/sites">{"\u8fd4\u56de\u7ad9\u5740\u53f0\u8d26"}</a></Button></div></ProductFrame>; }
  if (!demo) notFound();
  return <ProductFrame active="sites" preview><SiteDossier key={JSON.stringify(demo.query)} demo={demo} /></ProductFrame>;
}
