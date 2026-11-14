"use client";
import {DataTable,PanelCard,StatusBadge,TableTitleCell} from "@vxture/design-system";
import {formatDataTime} from "../../domains/data-updates/rules";
type SourceSnapshot={name:string;version:string;through:string;syncedAt:string|null};
export default function AssetSyncStatus({source}:{source:SourceSnapshot|null}){
 const rows=[{id:"sites",name:"\u7ad9\u5740\u8d44\u6599"},{id:"devices",name:"\u8bbe\u5907\u8d44\u6599"}];
 return <PanelCard title={"\u4e3b\u6570\u636e\u540c\u6b65"} icon="database">
  <div className="flex min-w-0 flex-col gap-md" data-asset-sync-status>
   <div className="min-w-0 overflow-x-auto"><DataTable rows={rows} rowKey={r=>r.id} columns={[
    {id:"object",header:"\u6570\u636e\u7c7b\u578b",cell:r=><span className="whitespace-nowrap">{r.name}</span>},
    {id:"source",header:"\u5f53\u524d\u6765\u6e90",cell:()=>source?<TableTitleCell title={source.name} description={source.version}/>:<span className="text-muted-foreground">{"\u2014"}</span>},
    {id:"through",header:"\u8d44\u6599\u66f4\u65b0\u81f3",cell:()=><span className="whitespace-nowrap tabular-nums">{source?formatDataTime(source.through):"\u2014"}</span>},
    {id:"sync",header:"\u6700\u8fd1\u540c\u6b65",cell:()=><span className="whitespace-nowrap text-muted-foreground">{"\u65e0\u6267\u884c\u8bb0\u5f55"}</span>},
    {id:"state",header:"\u63a5\u5165\u72b6\u6001",align:"center",cell:()=><StatusBadge tone="neutral">{"\u5f85\u63a5\u5165"}</StatusBadge>}
   ]}/></div>
   <p className="text-body-small text-muted-foreground">{"\u540c\u6b65\u63a5\u53e3\u4e0e\u5b57\u6bb5\u6620\u5c04\u5f85\u63a5\u5165"+(source?"\uff1b\u5f53\u524d\u4e3a\u6f14\u793a\u5feb\u7167\u3002":"\u3002")}</p>
  </div>
 </PanelCard>;
}
