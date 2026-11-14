"use client";
import {Button,DataTable,EmptyState,Icon,NativeSelect,Pagination,PanelCard,SegmentedControl} from "@vxture/design-system";
import UsageTrend from "../portal/usage-trend";
import {n,pct,sceneNames,siteTypeNames} from "../sites/labels";
import type {HistoryModel} from "./history-model";
import type {HistoryBand} from "../domains/map-demo/history-rules";
import {bandNames,groupItems,sharingNames,signedPercent} from "./history-labels";
export default function HistoryCohorts({data,unit,scale,navigate}:{data:HistoryModel;unit:string;scale:number;navigate:(patch:Record<string,string|undefined>)=>void}) {
  const q=data.scope,c=data.cohorts;
  const groupName=(id:string)=>q.groupBy==="scene"?sceneNames[id]:q.groupBy==="siteType"?siteTypeNames[id as keyof typeof siteTypeNames]:sharingNames[id as keyof typeof sharingNames];
  const select=(id:string)=>navigate({band:q.band===id?"all":id});
  return <div data-history-cohorts className="flex min-w-0 flex-col gap-lg">
    <PanelCard title={"\u540c\u7c7b\u7ad9\u7fa4\u5bf9\u6807"} icon="building" className="min-w-0"
      description={"\u76f8\u540c\u533a\u57df\u3001\u5468\u671f\u4e0e\u8fd0\u8425\u5546\u53e3\u5f84 \u00b7 \u603b\u91cf\u770b\u89c4\u6a21\uff0c\u5355\u7ad9\u65e5\u5747\u770b\u5f3a\u5ea6"}>
      <div className="site-analysis-table-tools site-analysis-action-row"><div className="site-analysis-occupancy-scroll"><SegmentedControl size="md" className="site-analysis-occupancy site-analysis-occupancy-auto [--analysis-facet-columns:3]" ariaLabel={"\u7ad9\u7fa4\u5206\u7ec4\u65b9\u5f0f"} value={q.groupBy} onChange={value=>navigate({groupBy:value,band:"all"})} items={groupItems}/></div></div>
      <DataTable rows={c.groups} rowKey={r=>r.id} columns={[
        {id:"name",header:"\u7ad9\u7fa4",cell:r=><Button size="xl" variant="ghost" onClick={()=>navigate({[q.groupBy]:r.id,band:"all",site:undefined})}>{groupName(r.id)}</Button>},
        {id:"sites",header:"\u7ad9\u5740 / \u5ea7",align:"center",cell:r=>n(r.sites)},
        {id:"total",header:"\u603b\u91cf / "+unit,cell:r=>n(Number(r.totals[q.metric])/scale,2)},
        {id:"mean",header:"\u5355\u7ad9\u65e5\u5747 / "+unit,cell:r=>n(r.mean/scale,2)},
        {id:"median",header:"\u4e2d\u4f4d\u6570 / "+unit,cell:r=>r.median===null?"\u2014":n(r.median/scale,2)},
        {id:"spread",header:"P25\u2014P75 / "+unit,cell:r=>r.p25===null?"\u2014":n(r.p25/scale,2)+" \u2014 "+n(r.p75!/scale,2)},
        {id:"growth",header:"\u65e5\u5747\u540c\u6bd4",cell:r=>signedPercent(r.change.dailyRate)},
      ]} empty={<EmptyState title={"\u5f53\u524d\u7b5b\u9009\u6682\u65e0\u9002\u7528\u7ad9\u7fa4"}/>}/>
      <p className="pt-md text-body-small text-muted-foreground">{"\u5355\u7ad9\u65e5\u5747 = \u7528\u91cf \u00f7 \u6709\u6548\u7ad9\u65e5\uff1b\u4e2d\u4f4d\u6570\u4e0eP25\u2014P75\u57fa\u4e8e\u7ad9\u5740\u65e5\u5747\u5206\u5e03\u3002\u5404\u5206\u7ec4\u4e92\u65a5\uff0c\u5408\u8ba1\u53ef\u6838\u5bf9\u5f53\u524d\u8303\u56f4\uff1b\u7ad9\u578b\u4e0e\u5171\u4eab\u5c5e\u6027\u4e0e\u7ad9\u5740\u53f0\u8d26\u4e00\u81f4\u3002"}</p>
    </PanelCard>
    <div className="grid min-w-0 gap-md lg:grid-cols-2">
      <PanelCard title={"\u7ad9\u5740\u7528\u91cf\u5206\u5e03"} icon="chart-bar" className="min-w-0" description={"\u70b9\u51fb\u5206\u5c42\u7b5b\u9009\u4e0b\u65b9\u6e05\u5355\uff1b\u6458\u8981\u3001\u8d8b\u52bf\u4e0e\u5206\u5e03\u4ecd\u663e\u793a\u5b8c\u6574\u7b5b\u9009\u8303\u56f4"}>
        <div className="site-analysis-trend flex min-w-0 flex-col"><UsageTrend data={c.distribution.map(row=>({key:row.id,label:bandNames[row.id as HistoryBand],value:row.count}))}
          name={"\u7ad9\u5740\u6570\u91cf"} unit={"\u5ea7"} labelSuffix="" ariaLabel={"\u7ad9\u5740\u7528\u91cf\u5206\u5e03"} labelEvery={1} formatValue={v=>n(v)} onSelect={select}/></div>
        <p className="pt-sm text-body-small text-muted-foreground">{c.stats.p50===null?"\u65e0\u975e\u96f6\u7528\u91cf\u7ad9\u5740\uff0c\u5206\u4f4d\u70b9\u6682\u4e0d\u53ef\u7528\u3002":"\u975e\u96f6\u7ad9\u5740\u65e5\u5747\u5206\u4f4d\u70b9\uff1aP25 "+n(c.stats.p25!/scale,2)+" \u00b7 P50 "+n(c.stats.p50/scale,2)+" \u00b7 P75 "+n(c.stats.p75!/scale,2)+" "+unit+"\uff1b\u8fb9\u754c\u76f8\u540c\u5f52\u5165\u8f83\u4f4e\u5c42\u3002"}</p>
      </PanelCard>
      <PanelCard title={"\u7ad9\u5740\u589e\u957f\u5206\u5e03"} icon="chart-line-up" className="min-w-0" description={"\u6309\u5355\u7ad9\u65e5\u5747\u540c\u6bd4\u5212\u5206\uff0c\u00b110%\u4e3a\u589e\u957f/\u4e0b\u964d\u754c\u7ebf\uff1b\u4e0d\u53ef\u6bd4\u5355\u5217"}>
        <div className="site-analysis-trend flex min-w-0 flex-col"><UsageTrend data={c.growth.map(row=>({key:row.id,label:bandNames[row.id as HistoryBand],value:row.count}))}
          name={"\u7ad9\u5740\u6570\u91cf"} unit={"\u5ea7"} labelSuffix="" ariaLabel={"\u7ad9\u5740\u589e\u957f\u5206\u5e03"} labelEvery={1} formatValue={v=>n(v)} onSelect={select}/></div>
        <p className="pt-sm text-body-small text-muted-foreground">{"\u524d"+c.stats.topCount+"\u5ea7\u7ad9\u5740\u627f\u8f7d "+pct(c.stats.topShare)+" \u5f53\u524d\u6307\u6807\u7528\u91cf\uff1b\u5f53\u524d\u6837\u672c\u5171 "+n(c.stats.sites)+" \u5ea7\u3002\u96f6\u57fa\u671f\u6216\u7f3a\u5b8c\u6574\u57fa\u671f\u5f52\u5165\u4e0d\u53ef\u6bd4\u3002"}</p>
      </PanelCard>
    </div>
    <PanelCard title={"\u7ad9\u7fa4\u6210\u5458"} icon="list-checks" className="min-w-0" description={bandNames[q.band]+" \u00b7 "+n(c.count)+"\u5ea7 \u00b7 \u5206\u5c42\u53ea\u4f5c\u7528\u4e8e\u672c\u6e05\u5355"}>
      <div className="site-analysis-table-tools site-analysis-action-row">
        <div className="site-analysis-control-group flex-wrap"><NativeSelect wrapperClassName="w-auto" aria-label={"\u7ad9\u7fa4\u6210\u5458\u5206\u5c42"} value={q.band} onChange={e=>navigate({band:e.target.value})}>{Object.entries(bandNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</NativeSelect>
        <NativeSelect wrapperClassName="w-auto" aria-label={"\u7ad9\u7fa4\u6210\u5458\u6392\u5e8f"} value={q.sort} onChange={e=>navigate({sort:e.target.value})}><option value="total">{"\u7528\u91cf\u4ece\u9ad8\u5230\u4f4e"}</option><option value="intensity">{"\u5355\u7ad9\u65e5\u5747\u4ece\u9ad8\u5230\u4f4e"}</option><option value="growth">{"\u589e\u957f\u4f18\u5148"}</option><option value="decline">{"\u4e0b\u964d\u4f18\u5148"}</option></NativeSelect>
        </div>{q.band!=="all"&&<Button size="xl" variant="ghost" aria-label={"\u6e05\u9664\u6e05\u5355\u5206\u5c42"} onClick={()=>navigate({band:"all"})}><Icon name="x" size="sm"/></Button>}
      </div>
      <div data-cohort-members><DataTable rows={c.members} rowKey={r=>r.id} columns={[
        {id:"name",header:"\u7ad9\u5740",cell:r=><Button size="xl" variant="ghost" onClick={()=>navigate({site:r.id,view:"region",city:r.cityId,county:r.countyId,band:"all"})}>{r.name}</Button>},
        {id:"type",header:"\u573a\u666f / \u8d44\u6e90",cell:r=><div className="flex flex-col gap-xs"><span>{sceneNames[r.scene]}</span><span className="text-body-small text-muted-foreground">{siteTypeNames[r.siteType]+" \u00b7 "+sharingNames[r.sharing]}</span></div>},
        {id:"total",header:"\u7528\u91cf / "+unit,cell:r=>n(Number(r.values[q.metric])/scale,2)},
        {id:"daily",header:"\u5355\u7ad9\u65e5\u5747 / "+unit,cell:r=>n(r.intensity/scale,2)},
        {id:"change",header:"\u65e5\u5747\u540c\u6bd4",cell:r=>signedPercent(r.change.dailyRate)},
        {id:"band",header:"\u5206\u5c42 / \u53d8\u5316",cell:r=><span className="text-body-small text-muted-foreground">{bandNames[r.level as HistoryBand]+" \u00b7 "+bandNames[r.growth]}</span>},
      ]} empty={<EmptyState title={"\u8be5\u5206\u5c42\u6682\u65e0\u7ad9\u5740"} description={"\u53ef\u6e05\u9664\u5206\u5c42\u6216\u8c03\u6574\u7ad9\u7fa4\u7b5b\u9009\u3002"}/>}/></div>
      {c.pageCount>1&&<Pagination className="product-pagination site-analysis-pagination site-analysis-action-row" page={c.page} pageCount={c.pageCount} countLabel={n(c.count)+"\u5ea7"} onPageChange={value=>navigate({page:String(value)})} firstLabel={"\u9996\u9875"} previousLabel={"\u4e0a\u4e00\u9875"} nextLabel={"\u4e0b\u4e00\u9875"} lastLabel={"\u672b\u9875"}/>}
    </PanelCard>
  </div>;
}
