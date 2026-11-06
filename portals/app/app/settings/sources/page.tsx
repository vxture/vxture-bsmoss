import PreviewConfigurationWorkspace from "../preview-configuration";
import { previewConfigurationCatalog } from "../preview-catalog";
import WorkspaceAvailability from "../../portal/availability";
import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import SourceWorkspace from "../source-workspace";
export const dynamic="force-dynamic";
export default async function Page(){const preview=process.env.BSMOSS_PRODUCT_PREVIEW === "on"; if(preview)return <><PreviewConfigurationWorkspace view="sources" {...previewConfigurationCatalog()}/></>; const cfg=getOidcConfig(),sid=(await cookies()).get(cfg.cookieName)?.value;
 return <>{!cfg.enabled||!sid?<WorkspaceAvailability inset="shell" title={"\u6765\u6e90\u914d\u7f6e"} description={"\u67e5\u770b\u5df2\u767b\u8bb0\u7684\u6765\u6e90\u914d\u7f6e\u3001\u6620\u5c04\u7248\u672c\u4e0e\u6570\u636e\u8303\u56f4"} stateTitle={cfg.enabled?"\u767b\u5f55\u540e\u67e5\u770b":"\u8eab\u4efd\u63a5\u5165\u5f85\u5b8c\u6210"} message={"\u9700\u8981\u5e73\u53f0\u6709\u6548\u8ba2\u9605\u53ca\u72ec\u7acb\u7684\u4ea7\u54c1\u7ba1\u7406\u67e5\u770b\u6743\u9650\u3002"} loginHref={cfg.enabled?"/auth/login?returnTo=%2Fsettings%2Fsources":undefined}/>:<SourceWorkspace audit={false}/>}</>;
}
