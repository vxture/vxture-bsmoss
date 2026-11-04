import ProductFrame from "../portal/header";
import { Button, PanelCard, ShellPageContainer } from "@vxture/design-system";
import { businessDemo } from "./model";
import { BUSINESS_ROUTES, type BusinessKind } from "./links";
import BusinessWorkspace from "./workspace";
export default async function BusinessPage({ kind, searchParams }: { kind: BusinessKind; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
 if (process.env.BSMOSS_PRODUCT_PREVIEW !== "on") return <ProductFrame active={kind} preview={false}><ShellPageContainer className="product-page-inset max-w-none"><PanelCard title={"\u6b63\u5f0f\u5206\u6790\u5c1a\u672a\u5f00\u653e"} icon="shield-check"><p className="text-body text-muted-foreground">{"\u5b8c\u6210\u6765\u6e90\u6388\u6743\u53ca\u4e1a\u52a1\u8bfb\u6a21\u578b\u63a5\u5165\u540e\u5f00\u653e\u3002"}</p></PanelCard></ShellPageContainer></ProductFrame>;
 let demo;
 try { demo = businessDemo(kind, await searchParams); }
 catch { return <ProductFrame active={kind}><ShellPageContainer className="product-page-inset max-w-none"><div role="alert"><PanelCard title={"\u5206\u6790\u7b5b\u9009\u65e0\u6548"} icon="search"><Button asChild><a href={BUSINESS_ROUTES[kind]}>{"\u91cd\u7f6e\u5206\u6790\u8303\u56f4"}</a></Button></PanelCard></div></ShellPageContainer></ProductFrame>; }
 return <ProductFrame active={kind} preview><BusinessWorkspace key={JSON.stringify(demo.scope)} demo={demo} /></ProductFrame>;
}
