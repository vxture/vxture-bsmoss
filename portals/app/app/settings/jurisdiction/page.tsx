import ProductFrame from "../../portal/header";
import WorkspaceAvailability from "../../portal/availability";
import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import { JurisdictionWorkspace } from "../management-workspace";
export const dynamic="force-dynamic";
export default async function Page(){
 const cfg=getOidcConfig(),sid=(await cookies()).get(cfg.cookieName)?.value;
 return <ProductFrame active="jurisdiction">{!cfg.enabled||!sid?<WorkspaceAvailability inset="shell" title={"\u7ba1\u8f96\u8303\u56f4"} description={"\u67e5\u770b\u4ea7\u54c1\u767b\u8bb0\u7684\u6388\u6743\u8303\u56f4\u4e0e\u914d\u7f6e\u8bb0\u5f55"} stateTitle={cfg.enabled?"\u767b\u5f55\u540e\u67e5\u770b":"\u8eab\u4efd\u63a5\u5165\u5f85\u5b8c\u6210"} message={"\u9700\u8981\u5e73\u53f0\u6709\u6548\u8ba2\u9605\u53ca\u72ec\u7acb\u7684\u4ea7\u54c1\u7ba1\u7406\u67e5\u770b\u6743\u9650\u3002"} loginHref={cfg.enabled?"/auth/login?returnTo=%2Fsettings%2Fjurisdiction":undefined}/>:<JurisdictionWorkspace/>}</ProductFrame>;
}
