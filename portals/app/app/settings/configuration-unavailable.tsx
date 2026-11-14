"use client";
import { Button, EmptyState } from "@vxture/design-system";
import { ConfigurationFrame } from "./configuration-layout";
import type { ConfigurationArea } from "./configuration-sections";
export default function ConfigurationUnavailable({area,view,enabled}:{area:ConfigurationArea;view:string;enabled:boolean}) {
  const path=area==="data"?"/settings/data-access":"/settings/access";
  return <ConfigurationFrame area={area} view={view}><EmptyState title={enabled?"\u767b\u5f55\u540e\u67e5\u770b":"\u8eab\u4efd\u63a5\u5165\u5f85\u5b8c\u6210"} description={"\u9700\u8981\u6709\u6548\u5e73\u53f0\u8ba2\u9605\u4e0e\u5bf9\u5e94\u7684\u4ea7\u54c1\u67e5\u770b\u6743\u9650"}/>{enabled&&<div className="site-analysis-action-row justify-end"><Button asChild className="h-control-xl text-body"><a href={"/auth/login?returnTo="+encodeURIComponent(path+"?view="+view)}>{"\u4f7f\u7528\u5e73\u53f0\u8d26\u53f7\u767b\u5f55"}</a></Button></div>}</ConfigurationFrame>;
}
