"use client";
import {useState,type MouseEvent} from "react";
import {DataTable,Dialog,DialogContent,DialogTitle,DialogDescription,TableTitleCell,StatusBadge} from "@vxture/design-system";
import {ANALYSIS_RULES,type ParameterDefinition} from "../../domains/business-parameters/catalog";
import SectionHeading from '../../portal/section-heading';
const definitions=ANALYSIS_RULES.filter(row=>!["runtime","capacity","verification"].includes(row.group));
export default function OtherRules(){
 const [selection,setSelection]=useState<string|null>(null),selected=definitions.find(row=>row.id===selection);
 const open=(row:ParameterDefinition)=>setSelection(previous=>previous===row.id?null:row.id);
 const rowClick=(event:MouseEvent)=>{const target=event.target as HTMLElement;if(target.closest("button,a"))return;const row=target.closest("tbody > tr");if(row){const entry=definitions[Array.from(row.parentElement!.children).indexOf(row)];if(entry)open(entry);}};
 return <section id="other-rules" aria-label={"\u5176\u4ed6\u89c4\u5219"} className="flex min-w-0 flex-col gap-md text-foreground">
  <div className="site-analysis-action-row"><SectionHeading title={"\u5176\u4ed6\u89c4\u5219"}/><span className="text-body-small text-muted-foreground">{"\u5185\u7f6e\u57fa\u7ebf \u00b7 \u53ea\u8bfb"}</span></div>
  <div className="site-analysis-table min-w-0 overflow-x-auto" onClick={rowClick}><DataTable rows={definitions} rowKey={row=>row.id} indexStart={1} columns={[
   {id:"name",header:"\u89c4\u5219",cell:row=><TableTitleCell icon="list-checks" className="site-analysis-site-title" title={row.name} description={row.code} onTitleClick={()=>open(row)}/>},
   {id:"summary",header:"\u5224\u5b9a\u8981\u70b9",cell:row=><span className="whitespace-normal">{row.summary}</span>},
   {id:"state",header:"\u72b6\u6001",align:"center",cell:()=><StatusBadge tone="neutral" size="sm">{"\u53ea\u8bfb"}</StatusBadge>},
  ]}/></div>
  <p className="border-t border-dashed border-border pt-md text-body-small text-muted-foreground">{"\u5185\u7f6e\u53e3\u5f84\u4e0e\u5206\u6790\u4ee3\u7801\u540c\u6e90\uff1b\u751f\u4ea7\u9608\u503c\u9700\u6837\u672c\u56de\u653e\u548c\u4e1a\u52a1\u7b7e\u8ba4\u3002"}</p>
  <Dialog modal={false} open={!!selected} onOpenChange={open=>{if(!open)setSelection(null);}}><DialogContent className="site-analysis-detail" width="sm" onOpenAutoFocus={event=>event.preventDefault()} onInteractOutside={event=>{if(event.target instanceof Element&&event.target.closest(".site-analysis-table tbody > tr"))event.preventDefault();}}>
   <div className="pr-xl"><DialogTitle>{selected?.name}</DialogTitle><DialogDescription>{selected?.code}</DialogDescription></div>{selected&&<DefinitionDetail definition={selected}/>}
  </DialogContent></Dialog>
 </section>;
}
function DefinitionDetail({ definition: d }: { definition: ParameterDefinition }) {
  return <div className="flex min-w-0 flex-col gap-lg">
    <p className="text-body">{d.summary}</p>
    <dl className="grid min-w-0 gap-lg md:grid-cols-2">{[["\u5b9a\u4e49\u7f16\u7801", d.code], ["\u5b9a\u4e49\u7248\u672c", d.version], ["\u6240\u5c5e\u5206\u7c7b", "\u7ecf\u8425\u5206\u6790"], ...d.facts.filter(([label]) => label !== "\u5206\u7c7b\u7ef4\u5ea6")].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="break-words text-body">{value}</dd></div>)}</dl>
    <div className="border-t border-dashed border-border pt-lg"><h3 className="text-label font-medium">{"\u9002\u7528\u529f\u80fd"}</h3><p className="mt-sm text-body-small">{d.applies.join("\u3001")}</p></div>
    <div className="border-t border-dashed border-border pt-lg"><h3 className="text-label font-medium">{"\u4f7f\u7528\u8fb9\u754c"}</h3><ul className="mt-sm flex list-disc flex-col gap-md pl-lg text-body-small">{d.boundaries.map(b => <li key={b}>{b}</li>)}</ul></div>
  </div>;
}
