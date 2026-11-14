import {Button,Icon,PanelCard} from "@vxture/design-system";
import {cookies} from "next/headers";
import {getOidcConfig} from "../../auth/lib/config";
import PageHeading from "../../portal/page-heading";
import CentreSwitch from "../centre-switch";
import {taskQuery,taskHref} from "../centre-links";
import ReportJobsWorkspace from "./workspace";
import "../../site-analysis/site-analysis.css";
export default async function ReportTaskCentre({params}:{params:Record<string,string|string[]|undefined>}){
 const cfg=getOidcConfig(),sid=(await cookies()).get(cfg.cookieName)?.value;
 let query=taskQuery({}),invalid=params.invalid!==undefined;try{query=taskQuery(params);}catch{invalid=true;}
 const scope=Object.fromEntries(["city","county","operator"].flatMap(k=>typeof params[k]==="string"?[[k,params[k]]]:[]));
 const returnTo=taskHref(query,scope),newHref="/reports/new"+(Object.keys(scope).length?"?"+new URLSearchParams(scope):"");
 return <div className="site-analysis-page product-page-inset flex min-w-0 flex-col gap-lg" data-report-task-centre>
  <PageHeading icon="file-text" title={"\u62a5\u544a\u4e2d\u5fc3"} description={"\u67e5\u770b\u62a5\u544a\u751f\u6210\u4e0e\u5bfc\u51fa\u8bb0\u5f55"} context={<span>{"\u5e73\u53f0\u4efb\u52a1"}</span>} actions={<Button asChild className="h-control-xl text-body"><a href={newHref}><Icon name="newspaper" size="sm"/>{"\u751f\u6210\u62a5\u544a"}</a></Button>}/>
  <section className="site-analysis-toolbar"><div className="site-analysis-filters site-analysis-action-row"><CentreSwitch value="tasks" scope={scope}/><span className="text-body-small text-muted-foreground">{"\u5e73\u53f0\u751f\u6210\uff0f\u5bfc\u51fa\uff0c\u672c\u673a\u7559\u5b58\u89c1\u62a5\u544a\u5e93"}</span></div></section>
  {invalid&&!(cfg.enabled&&sid)&&<p role="alert" className="text-body-small text-destructive">{"\u4efb\u52a1\u94fe\u63a5\u65e0\u6548\uff0c\u8bf7\u4ece\u5217\u8868\u9009\u62e9\u3002"}</p>}
  {cfg.enabled&&sid?<ReportJobsWorkspace initialQuery={query} invalidLink={invalid}/>:<PanelCard title={"\u4efb\u52a1\u8bb0\u5f55"} icon="list-checks"><div className="flex flex-col items-start gap-md">
   <p className="text-body-small text-muted-foreground">{cfg.enabled?"\u767b\u5f55\u540e\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u4efb\u52a1\u3002":"\u5e73\u53f0\u4efb\u52a1\u5f85\u63a5\u5165\u3002\u672c\u673a\u62a5\u544a\u4ecd\u53ef\u5728\u62a5\u544a\u5e93\u67e5\u9605\u3002"}</p>
   {cfg.enabled&&<Button asChild className="h-control-xl text-body"><a href={"/auth/login?returnTo="+encodeURIComponent(returnTo)}>{"\u4f7f\u7528\u5e73\u53f0\u8d26\u53f7\u767b\u5f55"}</a></Button>}
  </div></PanelCard>}
 </div>;
}
