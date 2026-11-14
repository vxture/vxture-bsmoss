"use client";
import {DataTable,TableTitleCell} from "@vxture/design-system";
import type {AssetDevice} from "../domains/site-registry/asset-model";
import OperatorIdentity from "../portal/operator-identity";
export default function ResourceRelationships({devices,onSelect}:{devices:AssetDevice[];onSelect:(device:AssetDevice)=>void}){
 return <div className="site-analysis-table min-w-0 overflow-x-auto"><DataTable rows={devices} rowKey={r=>r.id} columns={[
 {id:"name",header:"\u8bbe\u5907",cell:r=><TableTitleCell icon="stack" title={r.name} description={r.id} onTitleClick={()=>onSelect(r)}/>},
 {id:"category",header:"\u7c7b\u522b",cell:r=>r.categoryName},
 {id:"owner",header:"\u5f52\u5c5e",cell:r=><OperatorIdentity code={r.owner}/>},
 {id:"spec",header:"\u89c4\u683c",cell:r=><span className="whitespace-nowrap">{r.spec}</span>},
 ]} empty={<p className="py-md text-body-small text-muted-foreground">{"\u6682\u65e0\u5173\u8054\u8bbe\u5907"}</p>}/></div>;
}
