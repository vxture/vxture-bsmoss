"use client";
import Link from "next/link";

import {useEffect,useState} from "react";
import {Icon,PanelCard,SegmentedControl,ShellPageContainer,type IconName} from "@vxture/design-system";
import {Button} from "@vxture/design-system";
import PageHeading from "../../portal/page-heading";
import MonitoringParametersEditor from "../parameters/monitoring";
import CapacityParametersEditor from "../parameters/capacity";
import VerificationParametersEditor from "../parameters/verification";
import OtherRules from "./definitions";
import {RULE_SECTIONS,ruleSectionFromHash,type RuleSection} from "./sections";
import "../../site-analysis/site-analysis.css";

export default function RulesWorkspace(){
 const [section,setSection]=useState<RuleSection>("monitoring");
 useEffect(()=>{const read=()=>setSection(ruleSectionFromHash(location.hash));read();window.addEventListener("hashchange",read);window.addEventListener("popstate",read);return()=>{window.removeEventListener("hashchange",read);window.removeEventListener("popstate",read);};},[]);
 const change=(value:string)=>{const next=RULE_SECTIONS.find(item=>item.value===value);if(!next)return;history.pushState(null,"",location.pathname+location.search+"#"+next.anchor);setSection(next.value);};
 return <ShellPageContainer className="site-analysis-page gap-lg">
  <PageHeading actions={<Button asChild variant="outline"><Link href="/tower-service/rules">{"\u670d\u52a1\u89c4\u5219\u5e95\u5ea7"}</Link></Button>} icon="faders" title={"\u5206\u6790\u89c4\u5219"} description={"\u914d\u7f6e\u76d1\u6d4b\u3001\u627f\u8f7d\u4e0e\u6838\u9a8c\u53c2\u6570"}/>
  <PanelCard className="site-analysis-table-panel" title={"\u89c4\u5219\u914d\u7f6e"} icon="faders">
   <div className="site-analysis-table-tools site-analysis-table-tools-single-line site-analysis-action-row"><div className="site-analysis-table-filters"><div className="site-analysis-occupancy-scroll"><SegmentedControl size="md" className="h-control-xl site-analysis-occupancy site-analysis-occupancy-auto [--analysis-facet-columns:4]" ariaLabel={"\u89c4\u5219\u5206\u7c7b"} value={section} onChange={change} items={RULE_SECTIONS.map(item=>({value:item.value,label:<span className="site-analysis-occupancy-label"><Icon name={item.icon as IconName} size="sm"/>{item.label}</span>}))}/></div></div></div>
   <div hidden={section!=="monitoring"}><MonitoringParametersEditor/></div>
   <div hidden={section!=="capacity"}><CapacityParametersEditor/></div>
   <div hidden={section!=="verification"}><VerificationParametersEditor/></div>
   {section==="other"&&<OtherRules/>}
  </PanelCard>
 </ShellPageContainer>;
}
