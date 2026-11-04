import ProductFrame from "../portal/header";
import { ShellPageContainer, ViewHeader } from "@vxture/design-system";
import { boardDemo } from "./model";
import DecisionBoard from "./view";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const preview = process.env.BSMOSS_PRODUCT_PREVIEW === "on";
  if (!preview) return <ProductFrame active="board" preview={false}><ShellPageContainer className="product-page-inset">
    <ViewHeader title={"\u51b3\u7b56\u5206\u6790\u5c1a\u672a\u5f00\u653e"} description={"\u5b8c\u6210\u5e73\u53f0\u63a5\u5165\u540e\uff0c\u53ef\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u5168\u7701\u6001\u52bf\u3002"} />
  </ShellPageContainer></ProductFrame>;
  let demo;
  try { demo = boardDemo(await searchParams); }
  catch { return <ProductFrame active="board"><ShellPageContainer className="product-page-inset"><div role="alert">
    <ViewHeader title={"\u51b3\u7b56\u5206\u6790\u7b5b\u9009\u65e0\u6548"} description={"\u8bf7\u9009\u62e9\u9655\u897f\u5730\u5e02\u53ca 0\u201423 \u65f6\u7684\u6709\u6548\u65f6\u6bb5\u3002"} />
    <a href="/board">{"\u8fd4\u56de\u5168\u7701\u6001\u52bf"}</a>
  </div></ShellPageContainer></ProductFrame>; }
  return <ProductFrame active="board" preview><DecisionBoard demo={demo} /></ProductFrame>;
}
