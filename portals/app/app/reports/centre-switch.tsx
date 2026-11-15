"use client";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {Button,Icon,SegmentedControl} from "@vxture/design-system";
import {centreSectionHref,towerReportCentreHref} from "./centre-links";
export default function CentreSwitch({value="library",scope={}}:{value?:"library"|"tasks";scope?:Record<string,string|undefined>}){
 const router=useRouter();return <div className="flex min-w-0 flex-wrap items-center gap-sm"><Button asChild variant="ghost"><Link href={towerReportCentreHref(scope)}>{"\u65b0\u7248\u7814\u5224\u62a5\u544a"}</Link></Button><div className="site-analysis-occupancy-scroll"><SegmentedControl className="h-control-xl site-analysis-occupancy site-analysis-occupancy-auto [--analysis-facet-columns:2]" size="md" ariaLabel={"\u62a5\u544a\u4e2d\u5fc3\u5de5\u4f5c\u533a"} value={value} onChange={section=>router.push(centreSectionHref(section,scope),{scroll:false})} items={[
  {value:"library",label:<span className="site-analysis-occupancy-label"><Icon name="file-text" size="sm"/>{"\u62a5\u544a\u5e93"}</span>},
  {value:"tasks",label:<span className="site-analysis-occupancy-label"><Icon name="list-checks" size="sm"/>{"\u4efb\u52a1\u8bb0\u5f55"}</span>}
 ]}/></div></div>;
}
