"use client";
import {Button,DataTable,EmptyState,Input,PanelCard,Progress,SegmentedControl} from "@vxture/design-system";
import UsageTrend from "../portal/usage-trend";
import type {HistoryModel} from "./history-model";
import {useInvestigationLinks} from '../portal/investigation';
import {historyHref,historyEvidenceHref} from "./history-links";
import {n,operatorNames,pct,sceneNames,siteTypeNames} from "../sites/labels";
import {sharingNames,signedPercent} from "./history-labels";
import {metricNames,quantity} from "../usage-review/labels";
import {DAY_MS,dateNumber,isoDay} from "../domains/map-demo/history-calendar";
const peerItems=[{value:"scope",label:"\u5f53\u524d\u533a\u57df"},{value:"city",label:"\u6240\u5728\u5e02"},{value:"province",label:"\u5168\u7701"}];
const waveNames={within:"\u8303\u56f4\u5185",up:"\u7528\u91cf\u7a81\u589e",down:"\u7528\u91cf\u7a81\u964d",from_zero:"\u4ece\u96f6\u65b0\u589e",both_zero:"\u672c\u671f\u4e0e\u53c2\u8003\u5747\u96f6",insufficient:"\u57fa\u7ebf\u4e0d\u8db3"};
export default function HistoryStation({data,navigate}:{data:HistoryModel;navigate:(patch:Record<string,string|undefined>)=>void}) {
  const s=data.station,q=data.scope;const {carry}=useInvestigationLinks(historyHref(q));if(!s||!s.evidence)return null;
  const p=s.portrait,e=s.evidence,metric=q.metric;
  const scale=metric==="bytes"?1073741824:metric==="voiceSeconds"?60:1,unit=metric==="bytes"?"GiB":metric==="voiceSeconds"?"\u5206\u949f":"\u6761";
  const units={bytes:{scale:1073741824,unit:"GiB"},voiceSeconds:{scale:60,unit:"\u5206\u949f"},sms:{scale:1,unit:"\u6761"}};
  return <div data-station-history className="flex min-w-0 flex-col gap-lg">
    <PanelCard title={"\u540c\u7c7b\u7ad9\u5740\u753b\u50cf"} icon="building" className="min-w-0" description={sceneNames[s.peerScope.scene]+" \u00b7 "+siteTypeNames[s.peerScope.siteType]+" \u00b7 "+sharingNames[s.peerScope.sharing]+" \u00b7 "+n(p.count)+"\u5ea7\u53c2\u7167\u7ad9\uff0c\u5df2\u6392\u9664\u672c\u7ad9"}>
      <div className="flex flex-wrap items-center justify-end gap-sm pb-md"><SegmentedControl ariaLabel={"\u540c\u7c7b\u7ad9\u5740\u6bd4\u8f83\u533a\u57df"} value={q.peerLevel} items={peerItems} onChange={value=>navigate({peerLevel:value})}/></div>
      {p.count<p.minimum&&<p role="status" className="pb-md text-body-small text-muted-foreground">{"\u53c2\u7167\u6837\u672c\u4e0d\u8db33\u5ea7\uff0c\u6682\u4e0d\u63d0\u4f9b\u5206\u4f4d\u3001\u6392\u540d\u4e0e\u76f8\u5bf9\u4e2d\u4f4d\u6570\u504f\u5dee\uff1b\u53ef\u4e3b\u52a8\u9009\u62e9\u66f4\u5927\u7684\u6bd4\u8f83\u533a\u57df\u3002"}</p>}
      <DataTable rows={p.metrics} rowKey={r=>r.metric} columns={[
        {id:"metric",header:"\u4e1a\u52a1\u6307\u6807",cell:r=>metricNames[r.metric]+" / "+units[r.metric].unit},
        {id:"daily",header:"\u672c\u7ad9\u65e5\u5747",cell:r=>n(r.daily/units[r.metric].scale,2)},
        {id:"mean",header:"\u540c\u7c7b\u5747\u503c",cell:r=>r.mean===null?"\u2014":n(r.mean/units[r.metric].scale,2)},
        {id:"median",header:"\u540c\u7c7b\u4e2d\u4f4d\u6570",cell:r=>r.median===null?"\u2014":n(r.median/units[r.metric].scale,2)},
        {id:"range",header:"\u540c\u7c7b P25\u2014P75",cell:r=>r.p25===null?"\u2014":n(r.p25/units[r.metric].scale,2)+" \u2014 "+n(r.p75!/units[r.metric].scale,2)},
        {id:"gap",header:"\u8f83\u540c\u7c7b\u4e2d\u4f4d\u6570",cell:r=>signedPercent(r.gap)},
        {id:"position",header:"\u540c\u7c7b\u5206\u4f4d",cell:r=>r.percentile===null?"\u2014":<div className="flex min-w-control-xl flex-col gap-xs"><span className="text-body-small text-muted-foreground">{pct(r.percentile)}</span><Progress aria-label={metricNames[r.metric]+"\u540c\u7c7b\u5206\u4f4d"} value={r.percentile*100}/></div>},
      ]}/>
      <p className="pt-md text-body-small text-muted-foreground">{"\u540c\u5468\u671f\u3001\u540c\u8fd0\u8425\u5546\u53e3\u5f84\uff1b\u5206\u4f4d\u8d8a\u9ad8\u4ec5\u8868\u793a\u7528\u91cf\u8d8a\u9ad8\uff0c\u4e0d\u4ee3\u8868\u7ecf\u8425\u4ef7\u503c\u8d8a\u9ad8\u3002\u5e76\u5217\u4f7f\u7528\u4e2d\u95f4\u4f4d\u7f6e\uff1b\u4e0d\u4f1a\u81ea\u52a8\u6269\u5927\u53c2\u7167\u533a\u57df\u3002"}</p>
    </PanelCard>
    <PanelCard title={"\u65e5\u5185\u53d8\u5316\u8bc1\u636e"} icon="chart-line-up" className="min-w-0" description={"\u9010\u5c0f\u65f6\u6837\u672c\u4e0e\u5386\u53f2\u6c47\u603b\u5171\u7528\u6765\u6e90\uff1b\u6ce2\u52a8\u6309\u6bcf\u6761\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb\u72ec\u7acb\u5224\u5b9a"}>
      <div className="flex flex-wrap items-center justify-between gap-md pb-md">
        <Input type="date" className="history-date-input" aria-label={"\u65e5\u5185\u8bc1\u636e\u65e5\u671f"} min={q.window.start} max={isoDay(dateNumber(q.window.end)-DAY_MS)} value={e.date} onChange={event=>{if(event.target.value&&event.target.validity.valid)navigate({evidence:event.target.value,slot:undefined});}}/>
        <Button asChild variant="outline"><a href={carry(historyEvidenceHref(q,{evidence:e.date,slot:String(e.slot)}))}>{"\u6838\u9a8c\u4f9d\u636e"}</a></Button>
      </div>
      <div className="history-trend flex min-w-0 flex-col"><UsageTrend data={e.hours.map(h=>({key:String(h.hour),label:String(h.hour).padStart(2,"0"),value:Number(h.values[metric])/scale}))}
        name={metricNames[metric]} unit={unit} selectedKey={String(e.slot)} ariaLabel={"\u5355\u7ad9\u9010\u5c0f\u65f6\u7528\u91cf"} formatValue={value=>n(value,2)} onSelect={hour=>navigate({evidence:e.date,slot:hour})}/></div>
      <p className="py-md text-body-small text-muted-foreground">{e.date+" \u00b7 \u5168\u65e5"+metricNames[metric]+" "+quantity(String(e.totals[metric]),metric)+" \u00b7 \u9009\u62e9\u5c0f\u65f6\u67e5\u770b\u540c\u671f\u53c2\u8003"}</p>
      <DataTable rows={e.selected} rowKey={r=>r.code} columns={[
        {id:"op",header:"\u8fd0\u8425\u5546",cell:r=>operatorNames[r.code]},
        {id:"hour",header:"\u9009\u5b9a\u65f6\u6bb5",cell:()=>String(e.slot).padStart(2,"0")+":00"},
        {id:"value",header:"\u5b9e\u9645\u7528\u91cf",cell:r=>quantity(String(r.values[metric]),metric)},
        {id:"base",header:"\u56db\u5468\u53c2\u8003\u4e2d\u4f4d\u6570",cell:r=>quantity(r.wave.referenceNumerator,metric,2)},
        {id:"status",header:"\u7b5b\u67e5\u7ed3\u679c",cell:r=>waveNames[r.wave.status]},
        {id:"samples",header:"\u53ef\u7528\u53c2\u8003",cell:r=>r.references.filter(v=>v.complete).length+" / 4"},
        {id:"action",header:"\u4f9d\u636e",cell:r=><Button asChild variant="link"><a href={carry(historyEvidenceHref(q,{operator:r.code,evidence:e.date,slot:String(e.slot)}))}>{"\u67e5\u770b\u53c2\u8003\u539f\u503c"}</a></Button>},
      ]} empty={<EmptyState title={"\u5f53\u524d\u8303\u56f4\u6682\u65e0\u53ef\u7528\u670d\u52a1\u5173\u7cfb"}/>}/>
      <p className="pt-md text-body-small text-muted-foreground">{"\u65e5\u5185\u56fe\u6309\u6240\u9009\u8fd0\u8425\u5546\u6c47\u603b\uff1b\u7b5b\u67e5\u7ed3\u679c\u6309\u670d\u52a1\u5173\u7cfb\u663e\u793a\uff0c\u4e0d\u5408\u5e76\u6210\u672c\u7ad9\u6545\u969c\u7ed3\u8bba\u3002\u6765\u6e90\u8986\u76d6\u8d77\u70b9\u4ee5\u524d\u7684\u53c2\u8003\u4fdd\u6301\u7f3a\u5931\uff0c\u6838\u9a8c\u539f\u56e0\u5c1a\u672a\u786e\u8ba4\u3002"}</p>
    </PanelCard>
  </div>;
}
