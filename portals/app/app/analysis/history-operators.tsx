"use client";
import OperatorIdentity from "../portal/operator-identity";
import {useOperatorNames} from "../portal/operator-identities";
import {Button,DataTable,EmptyState,PanelCard,Progress} from "@vxture/design-system";
import UsageTrend from "../portal/usage-trend";
import MetricRowsCard from "../portal/metric-rows-card";
import {n,pct} from "../sites/labels";
import {compareMetric,contribution} from "../domains/map-demo/cohort-rules";
import {historyChange} from "../domains/map-demo/history-rules";
import type {HistoryModel} from "./history-model";
import {signedPercent} from "./history-labels";
export default function HistoryOperators({data,unit,scale,navigate}:{data:HistoryModel;unit:string;scale:number;navigate:(patch:Record<string,string|undefined>)=>void}) {
 const operatorNames=useOperatorNames();
  const metric=data.scope.metric,days=data.scope.window.days,previousDays=data.previousWindow?.days??days;
  const rows=data.operators.map(row=>({...row,change:historyChange(row,row.previous,metric,days,previousDays),effect:contribution(row,row.previous,data.totals,data.previous,metric)}));
  const sorted=[...rows].sort((a,b)=>compareMetric(b,a,metric));
  const positive=rows.reduce((v,r)=>v+(r.effect.delta!==null&&BigInt(r.effect.delta)>0n?BigInt(r.effect.delta):0n),0n);
  const negative=rows.reduce((v,r)=>v+(r.effect.delta!==null&&BigInt(r.effect.delta)<0n?BigInt(r.effect.delta):0n),0n);
  const pp=(value:number|null)=>value===null?"\u2014":(value>0?"+":"")+n(value,2)+" pp";
  const comparable=data.previous&&BigInt(data.previous[metric])>0n;
  return <div data-history-operators className="flex min-w-0 flex-col gap-lg">
    <PanelCard title={"\u8fd0\u8425\u5546\u7ed3\u6784\u4e0e\u53d8\u5316\u8d21\u732e"} icon="users" className="min-w-0"
      description={"\u4efd\u989d\u6309\u5f53\u524d\u6307\u6807\u8ba1\u7b97\uff1b\u5171\u4eab\u7ad9\u5740\u4e0d\u8de8\u8fd0\u8425\u5546\u7d2f\u52a0"}
      action={data.scope.query.operator!=="all"?<Button size="xl" variant="outline" onClick={()=>navigate({operator:"all"})}>{"\u5168\u90e8\u8fd0\u8425\u5546"}</Button>:undefined}>
      <DataTable rows={sorted} rowKey={r=>r.code} columns={[
        {id:"name",header:"\u8fd0\u8425\u5546",cell:r=><Button size="xl" variant="ghost" onClick={()=>navigate({operator:r.code})}><OperatorIdentity code={r.code}/></Button>},
        {id:"sites",header:"\u670d\u52a1\u7ad9\u5740 / \u5ea7",cell:r=>n(r.sites)},
        {id:"total",header:"\u7528\u91cf / "+unit,cell:r=><span className="tabular-nums">{n(Number(r[metric])/scale,2)}</span>},
        {id:"share",header:"\u7528\u91cf\u4efd\u989d",cell:r=><div className="flex min-w-control-xl flex-col gap-xs"><span className="text-body-small text-muted-foreground">{pct(r.effect.share)}</span>{r.effect.share!==null&&<Progress value={r.effect.share*100} aria-label={operatorNames[r.code]+"\u7528\u91cf\u4efd\u989d"}/>}</div>},
        {id:"shift",header:"\u4efd\u989d\u53d8\u5316 / pp",cell:r=>pp(r.effect.shareShift)},
        {id:"delta",header:"\u540c\u6bd4\u589e\u51cf / "+unit,cell:r=>r.effect.delta===null?"\u2014":(BigInt(r.effect.delta)>0n?"+":"")+n(Number(r.effect.delta)/scale,2)},
        {id:"growth",header:"\u589e\u957f\u8d21\u732e / pp",cell:r=>pp(r.effect.growthPoints)},
        {id:"daily",header:"\u65e5\u5747\u540c\u6bd4",cell:r=>signedPercent(r.change.dailyRate)},
        {id:"action",header:"\u5206\u6790",cell:r=><Button size="xl" variant="ghost" onClick={()=>navigate({view:"region",operator:r.code})}>{"\u533a\u57df\u8ffd\u8e2a"}</Button>},
      ]} empty={<EmptyState title={"\u5f53\u524d\u8303\u56f4\u6682\u65e0\u9002\u7528\u670d\u52a1\u5173\u7cfb"}/>}/>
      <p className="pt-md text-body-small text-muted-foreground">{"\u589e\u957f\u8d21\u732e = \u8be5\u8fd0\u8425\u5546\u540c\u6bd4\u589e\u51cf\u91cf \u00f7 \u5f53\u524d\u8303\u56f4\u4e0a\u5e74\u540c\u671f\u603b\u91cf\uff0c\u4ee5\u767e\u5206\u70b9\uff08pp\uff09\u8868\u793a\uff1b\u5404\u9879\u53ef\u6b63\u53ef\u8d1f\uff0c\u5408\u8ba1\u7b49\u4e8e\u8303\u56f4\u603b\u91cf\u540c\u6bd4\u3002\u5176\u4ed6\u4e3a\u6765\u6e90\u5206\u7c7b\uff0c\u4e0d\u4ee3\u8868\u4e00\u4e2a\u5177\u4f53\u8fd0\u8425\u4e3b\u4f53\u3002"}</p>
    </PanelCard>
    <div className="grid min-w-0 gap-md lg:grid-cols-3">
      <PanelCard title={"\u589e\u957f\u8d21\u732e\u5206\u89e3"} icon="chart-bar" className="min-w-0 lg:col-span-2" description={"\u6b63\u503c\u63a8\u52a8\u589e\u957f\uff0c\u8d1f\u503c\u62b5\u6d88\u589e\u957f \u00b7 \u70b9\u51fb\u67f1\u5f62\u7b5b\u9009\u8fd0\u8425\u5546"}>
        {comparable&&rows.length?<div className="site-analysis-trend flex min-w-0 flex-col"><UsageTrend data={rows.map(r=>({key:r.code,label:operatorNames[r.code],value:r.effect.growthPoints!}))}
          name={"\u589e\u957f\u8d21\u732e"} unit="pp" labelSuffix="" ariaLabel={"\u8fd0\u8425\u5546\u589e\u957f\u8d21\u732e"} labelEvery={1} formatValue={v=>n(v,2)} onSelect={code=>navigate({operator:code})}/></div>:<EmptyState title={"\u5f53\u524d\u8303\u56f4\u65e0\u53ef\u7528\u540c\u6bd4\u8d21\u732e"} description={"\u9700\u8981\u5b8c\u6574\u4e0a\u5e74\u540c\u671f\u4e14\u57fa\u671f\u603b\u91cf\u5927\u4e8e\u96f6\u3002"}/>}
      </PanelCard>
      <MetricRowsCard title={"\u589e\u51cf\u91cf\u6838\u5bf9"} icon="chart-line-up" description={"\u540c\u6307\u6807\u540c\u8303\u56f4\uff0c\u4fdd\u7559\u6b63\u8d1f\u65b9\u5411"} metrics={[
        {key:"positive",label:"\u6b63\u5411\u589e\u91cf / "+unit,value:data.previous?"+"+n(Number(positive)/scale,2):"\u2014"},
        {key:"negative",label:"\u8d1f\u5411\u51cf\u91cf / "+unit,value:data.previous?n(Number(negative)/scale,2):"\u2014"},
        {key:"net",label:"\u51c0\u53d8\u5316 / "+unit,value:data.previous?n(Number(positive+negative)/scale,2):"\u2014"},
      ]}/>
    </div>
  </div>;
}
