import PageHeading from "../portal/page-heading";
import ProductFrame from "../portal/header";
import { Button, PanelCard, ShellPageContainer } from "@vxture/design-system";
import { reviewDemo } from "../domains/usage-verification/demo";
import ReviewWorkspace from "./workspace";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.BSMOSS_PRODUCT_PREVIEW !== "on") return <ProductFrame active="usage-review" preview={false}><ShellPageContainer className="product-page-inset max-w-none"><PageHeading title={"\u7528\u91cf\u6838\u9a8c"} /><PanelCard title={"\u6b63\u5f0f\u7528\u91cf\u6838\u9a8c\u5c1a\u672a\u5f00\u653e"} icon="shield-check"><p className="text-body text-muted-foreground">{"\u5b8c\u6210\u6388\u6743\u6765\u6e90\u4e0e\u6838\u9a8c\u8bfb\u6a21\u578b\u63a5\u5165\u540e\u5f00\u653e\u3002"}</p></PanelCard></ShellPageContainer></ProductFrame>;
  let model;
  try { model = reviewDemo(await searchParams); }
  catch (error) { if (!(error instanceof Error && /^(invalid_|query_too_large)/.test(error.message))) throw error; return <ProductFrame active="usage-review"><ShellPageContainer className="product-page-inset max-w-none"><PageHeading title={"\u7528\u91cf\u6838\u9a8c"} /><div role="alert"><PanelCard title={"\u6838\u9a8c\u7b5b\u9009\u65e0\u6548"} icon="search"><Button asChild><a href="/usage-review">{"\u91cd\u7f6e\u6838\u9a8c\u8303\u56f4"}</a></Button></PanelCard></div></ShellPageContainer></ProductFrame>; }
  return <ProductFrame active="usage-review" preview><ReviewWorkspace key={JSON.stringify(model.query)} model={model} /></ProductFrame>;
}
