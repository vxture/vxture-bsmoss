import type {DemoSite,HourMetrics,RegionDefinition} from './types.ts';
import type {PeriodComparison} from './period-comparison-rules.ts';
export const CONTRIBUTION_VERSION='bsmoss-demo-period-contribution-v1';
export const BUSINESS_KEYS=['bytes','voiceSeconds','sms'] as const;
export type BusinessMetric=typeof BUSINESS_KEYS[number];
export type ContributionLevel='city'|'county'|'site';
export type BusinessCounters=Record<BusinessMetric,bigint>;
export interface ContributionRow {
  id:string;name:string;cityId:string;countyId:string;sites:number;
  current:string;previous:string;delta:string;points:number|null;share:number|null;
}
export interface ContributionMovement {
  // Values are exact numerators; divide by denominator to obtain the displayed unit.
  denominator:number;net:string;positive:string;negative:string;points:number|null;
  increased:number;decreased:number;unchanged:number;
  increase:ContributionRow[];decrease:ContributionRow[];
  increaseRemainder:string;decreaseRemainder:string;
}
export interface ContributionGroup {
  count:number;ranking:ContributionRow[];rankingRemainder:string;
  total:ContributionMovement;daily:ContributionMovement;
}
export interface PeriodContribution {
  version:string;status:'matched'|'unavailable'|'evidence_mismatch';limit:number;
  levels:Record<ContributionLevel,Record<BusinessMetric,ContributionGroup>>|null;
}
const empty=():BusinessCounters=>({bytes:0n,voiceSeconds:0n,sms:0n});
export function contributionCollector(sites:readonly DemoSite[]) {
  const counters=new Map(sites.map(s=>[s.id,empty()]));
  return {counters,observe:(site:DemoSite,m:HourMetrics)=>{
    const row=counters.get(site.id);if(!row)throw Error('unknown_contribution_site');
    for(const key of BUSINESS_KEYS){if(!Number.isSafeInteger(m[key])||m[key]<0)throw Error('invalid_contribution_counter');row[key]+=BigInt(m[key]);}
  }};
}
const sum=(rows:readonly ContributionRow[],key:'current'|'previous'|'delta')=>rows.reduce((n,r)=>n+BigInt(r[key]),0n);
const desc=(a:bigint,b:bigint)=>a===b?0:a>b?-1:1;
export function buildPeriodContribution(sites:readonly DemoSite[],current:ReadonlyMap<string,BusinessCounters>,previous:ReadonlyMap<string,BusinessCounters>,comparison:PeriodComparison,region?:RegionDefinition):PeriodContribution {
  const base={version:CONTRIBUTION_VERSION,limit:5};
  if(!comparison.comparable)return {...base,status:'unavailable',levels:null};
  if(new Set(sites.map(s=>s.id)).size!==sites.length||current.size!==sites.length||previous.size!==sites.length)return {...base,status:'evidence_mismatch',levels:null};
  for(const key of BUSINESS_KEYS){
    let c=0n,p=0n;
    for(const site of sites){const a=current.get(site.id),b=previous.get(site.id);if(!a||!b||a[key]<0n||b[key]<0n)return {...base,status:'evidence_mismatch',levels:null};c+=a[key];p+=b[key];}
    if(String(c)!==comparison.metrics[key].current||String(p)!==comparison.metrics[key].previous)return {...base,status:'evidence_mismatch',levels:null};
  }
  const levels={} as NonNullable<PeriodContribution['levels']>;
  for(const level of ['city','county','site'] as const){
    const groups=new Map<string,{site:DemoSite;count:number;current:BusinessCounters;previous:BusinessCounters}>();
    for(const site of sites){
      const id=level==='site'?site.id:level==='city'?site.cityId:site.countyId;
      let g=groups.get(id);if(!g){g={site,count:0,current:empty(),previous:empty()};groups.set(id,g);}g.count++;
      for(const key of BUSINESS_KEYS){g.current[key]+=current.get(site.id)![key];g.previous[key]+=previous.get(site.id)![key];}
    }
    const metrics={} as Record<BusinessMetric,ContributionGroup>;
    for(const key of BUSINESS_KEYS){
      const totalCurrent=BigInt(comparison.metrics[key].current),totalPrevious=BigInt(comparison.metrics[key].previous),cDays=comparison.current.days,pDays=comparison.previous.days;
      const rows=[...groups].map(([id,g]):ContributionRow=>({id,name:level==='site'?g.site.name:level==='city'?region?.cities.find(c=>c.id===id)?.name??id:region?.counties.find(c=>c.id===id)?.name??id,cityId:g.site.cityId,countyId:level==='city'?'':g.site.countyId,sites:g.count,current:String(g.current[key]),previous:String(g.previous[key]),delta:String(g.current[key]-g.previous[key]),points:totalPrevious===0n?null:Number(g.current[key]-g.previous[key])/Number(totalPrevious)*100,share:totalCurrent===0n?null:Number(g.current[key])/Number(totalCurrent)}));
      const movement=(daily:boolean):ContributionMovement=>{
        const all=rows.map(r=>{const delta=daily?BigInt(r.current)*BigInt(pDays)-BigInt(r.previous)*BigInt(cDays):BigInt(r.delta);return {...r,delta:String(delta),points:totalPrevious===0n?null:Number(delta)/Number(totalPrevious*BigInt(daily?cDays:1))*100};});
        const positive=all.filter(r=>BigInt(r.delta)>0n).sort((a,b)=>desc(BigInt(a.delta),BigInt(b.delta))||a.id.localeCompare(b.id));
        const negative=all.filter(r=>BigInt(r.delta)<0n).sort((a,b)=>desc(BigInt(b.delta),BigInt(a.delta))||a.id.localeCompare(b.id));
        const increase=positive.slice(0,base.limit),decrease=negative.slice(0,base.limit),up=sum(positive,'delta'),down=sum(negative,'delta'),net=up+down;
        return {denominator:daily?cDays*pDays:1,net:String(net),positive:String(up),negative:String(down),points:totalPrevious===0n?null:Number(net)/Number(totalPrevious*BigInt(daily?cDays:1))*100,increased:positive.length,decreased:negative.length,unchanged:all.length-positive.length-negative.length,increase,decrease,increaseRemainder:String(up-sum(increase,'delta')),decreaseRemainder:String(down-sum(decrease,'delta'))};
      };
      const ranking=rows.slice().sort((a,b)=>desc(BigInt(a.current),BigInt(b.current))||a.id.localeCompare(b.id)).slice(0,base.limit);
      metrics[key]={count:rows.length,ranking,rankingRemainder:String(totalCurrent-sum(ranking,'current')),total:movement(false),daily:movement(true)};
    }
    levels[level]=metrics;
  }
  return {...base,status:'matched',levels};
}
