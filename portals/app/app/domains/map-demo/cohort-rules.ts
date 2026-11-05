import {historyChange,type HistoryAnalysis,type HistoryBand,type HistoryMetric,type HistoryValues} from './history-rules.ts';
import {syntheticSharing,syntheticSiteType} from './site-attributes.ts';
import type {DemoSite} from './types.ts';

export function sumHistory(values:readonly HistoryValues[]):HistoryValues {
  const total={bytes:0n,voiceSeconds:0,sms:0};
  for(const row of values){total.bytes+=BigInt(row.bytes);total.voiceSeconds+=row.voiceSeconds;total.sms+=row.sms;}
  if(!Number.isSafeInteger(total.voiceSeconds)||!Number.isSafeInteger(total.sms))throw Error('history_counter_overflow');
  return {...total,bytes:String(total.bytes)};
}
export const compareMetric=(a:HistoryValues,b:HistoryValues,metric:HistoryMetric)=>BigInt(a[metric])<BigInt(b[metric])?-1:BigInt(a[metric])>BigInt(b[metric])?1:0;
export function quantile(sorted:readonly number[],p:number):number|null {
  if(!sorted.length)return null;
  const index=(sorted.length-1)*p,low=Math.floor(index),fraction=index-low;
  return sorted[low]+(sorted[Math.ceil(index)]-sorted[low])*fraction;
}
export function growthBand(current:HistoryValues,previous:HistoryValues|null,metric:HistoryMetric,days:number,previousDays:number):HistoryBand {
  if(!previous||BigInt(previous[metric])===0n)return 'unknown';
  const denominator=BigInt(previous[metric])*BigInt(days),delta=BigInt(current[metric])*BigInt(previousDays)-denominator;
  return delta*10n<=-denominator?'decline':delta*10n>=denominator?'growth':'stable';
}
// Contribution is percentage points of the scope's baseline, not a fraction of
// a net delta that may cancel to zero. Negative effects keep their sign.
export function contribution(current:HistoryValues,previous:HistoryValues|null,total:HistoryValues,totalPrevious:HistoryValues|null,metric:HistoryMetric) {
  const change=historyChange(current,previous,metric,1,1);
  const share=BigInt(total[metric])===0n?null:Number(current[metric])/Number(total[metric]);
  const previousShare=previous&&totalPrevious&&BigInt(totalPrevious[metric])>0n?Number(previous[metric])/Number(totalPrevious[metric]):null;
  return {...change,share,previousShare,shareShift:share===null||previousShare===null?null:(share-previousShare)*100,
    growthPoints:change.delta===null||!totalPrevious||BigInt(totalPrevious[metric])===0n?null:Number(change.delta)/Number(totalPrevious[metric])*100};
}
export function analyzeCohorts(analysis:HistoryAnalysis,catalog:readonly DemoSite[]) {
  const {scope}=analysis,metric=scope.metric,days=scope.window.days,previousDays=analysis.previousWindow?.days??days;
  const byId=new Map(catalog.map(s=>[s.id,s]));
  const members=analysis.siteRows.map(row=>{
    const site=byId.get(row.id);if(!site)throw Error('unknown_history_site');
    return {...row,id:site.id,name:site.name,cityId:site.cityId,countyId:site.countyId,scene:site.profile,siteType:syntheticSiteType(site),sharing:syntheticSharing(site),
      intensity:Number(row.values[metric])/days,growth:growthBand(row.values,row.previous,metric,days,previousDays),
      change:historyChange(row.values,row.previous,metric,days,previousDays)};
  });
  const positive=members.filter(r=>BigInt(r.values[metric])>0n).map(r=>r.intensity).sort((a,b)=>a-b);
  const p25=quantile(positive,.25),p50=quantile(positive,.5),p75=quantile(positive,.75);
  const classified=members.map(row=>({...row,level:BigInt(row.values[metric])===0n?'zero':row.intensity<=p25!?'lower':row.intensity<=p50!?'middleLow':row.intensity<=p75!?'middleHigh':'upper'}));
  const distributions=(bands:readonly string[],field:'level'|'growth')=>bands.map(id=>{
    const rows=classified.filter(r=>r[field]===id);
    return {id,count:rows.length,totals:sumHistory(rows.map(r=>r.values))};
  });
  const groups=new Map<string,typeof members>();
  for(const row of members){const key=row[scope.groupBy];if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(row);}
  const groupRows=[...groups].map(([id,rows])=>{
    const total=sumHistory(rows.map(r=>r.values)),previous=analysis.previous?sumHistory(rows.map(r=>r.previous!)):null;
    const intensities=rows.map(r=>r.intensity).sort((a,b)=>a-b);
    return {id,sites:rows.length,siteDays:rows.length*days,totals:total,previous,
      mean:Number(total[metric])/(days*rows.length),p25:quantile(intensities,.25),median:quantile(intensities,.5),p75:quantile(intensities,.75),
      change:historyChange(total,previous,metric,days,previousDays),contribution:contribution(total,previous,analysis.totals,analysis.previous,metric)};
  });
  const ranked=[...members].sort((a,b)=>compareMetric(b.values,a.values,metric)||a.id.localeCompare(b.id));
  const topCount=Math.min(10,members.length),top=sumHistory(ranked.slice(0,topCount).map(r=>r.values));
  const selected=classified.filter(r=>scope.band==='all'||r.level===scope.band||r.growth===scope.band);
  selected.sort((a,b)=>{
    const ar=a.change.dailyRate,br=b.change.dailyRate;
    if(scope.sort==='growth'||scope.sort==='decline'){
      if(ar===null&&br!==null)return 1;if(ar!==null&&br===null)return -1;
      if(ar!==null&&br!==null&&ar!==br)return scope.sort==='growth'?br-ar:ar-br;
    }
    return compareMetric(b.values,a.values,metric)||a.id.localeCompare(b.id);
  });
  const count=selected.length,pageCount=Math.max(1,Math.ceil(count/20)),page=Math.min(scope.page,pageCount);
  return {groups:groupRows,distribution:distributions(['zero','lower','middleLow','middleHigh','upper'],'level'),
    growth:distributions(['decline','stable','growth','unknown'],'growth'),
    stats:{sites:members.length,nonzeroSites:positive.length,p25,p50,p75,mean:members.length?Number(analysis.totals[metric])/(days*members.length):null,
      topCount,topShare:BigInt(analysis.totals[metric])===0n?null:Number(top[metric])/Number(analysis.totals[metric])},
    count,page,pageCount,members:selected.slice((page-1)*20,page*20)};
}
