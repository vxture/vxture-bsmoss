import type {PublishedSnapshot} from './foundation';
import {serviceDescriptor,serviceSummaryReader,type ServiceCapture} from './quantification';
import {snapshotComparison,compareQuantity,type SnapshotContext} from './query';

// Partition once, then reuse the existing quantity rules for each site. Zero is
// produced only by a complete capture, never by a missing source or bad basis.
function quantities(c:ServiceCapture|undefined,ids:ReadonlySet<string>,metric:string,operator:string){
 const read=serviceSummaryReader(c),empty=read(metric,new Set<string>(),operator).quantity;
 const configs=new Map<string,ServiceCapture['configurations']>(),usage=new Map<string,ServiceCapture['usage']>();
 for(const row of c?.configurations??[])if(ids.has(row.siteId)){const group=configs.get(row.siteId)??[];group.push(row);configs.set(row.siteId,group);}
 for(const row of c?.usage??[])if(ids.has(row.siteId)){const group=usage.get(row.siteId)??[];group.push(row);usage.set(row.siteId,group);}
 const values=new Map<string,string|null>();
 for(const id of ids){const a=configs.get(id)??[],b=usage.get(id)??[];values.set(id,c&&(a.length||b.length)?serviceSummaryReader({...c,configurations:a,usage:b})(metric,new Set([id]),operator).quantity:empty);}
 return {read,values,empty};
}
const sum=(values:(string|null)[])=>values.some(v=>v===null)?null:String(values.reduce<bigint>((n,v)=>n+BigInt(v!),0n));
export function contributionAnalysis(current:PublishedSnapshot,before:PublishedSnapshot|undefined,context:SnapshotContext,metricId:string,allowed:readonly string[]){
 const a=current.inventory.services,b=before?.inventory.services,metric=a?.metrics.find(m=>m.id===metricId)??null,prior=b?.metrics.find(m=>m.id===metricId);
 const basis=before?snapshotComparison(serviceDescriptor(current.inventory.descriptor,a),serviceDescriptor(before.inventory.descriptor,b)):null;
 const comparable=!!basis?.comparable&&!!metric&&!!prior&&JSON.stringify(metric)===JSON.stringify(prior);
 const inRegion=(r:PublishedSnapshot['inventory']['rows'][number])=>(context.city==='all'||r.city===context.city)&&(context.county==='all'||r.county===context.county);
 const rows=current.inventory.rows.filter(inRegion),old=before?.inventory.rows.filter(inRegion)??[];
 const aIds=new Set(rows.map(r=>r.id)),bIds=new Set(old.map(r=>r.id)),allIds=new Set([...aIds,...bIds]);
 const av=quantities(a,aIds,metricId,context.operator),bv=quantities(b,bIds,metricId,context.operator);
 const value=(bucket:ReturnType<typeof quantities>,id:string)=>bucket.values.has(id)?bucket.values.get(id)!:bucket.empty;
 const currentTotal=av.read(metricId,aIds,context.operator).quantity,previousTotal=bv.read(metricId,bIds,context.operator).quantity;
 const base=previousTotal===null?null:BigInt(previousTotal);
 const pair=(id:string,name:string,now:string|null,previous:string|null,siteIds:string[])=>{
  const comparison=compareQuantity(now,previous,comparable),delta=comparison.delta;
  return {id,name,current:now,previous,...comparison,contribution:delta===null||base===null||base===0n?null:String(BigInt(delta)*10000n/base),siteIds};
 };
 const metadata=new Map([...old,...rows].map(row=>[row.id,row]));
 const sites=[...allIds].map(id=>{const site=metadata.get(id)!;return {...pair(id,site.name,value(av,id),value(bv,id),[id]),city:site.city,county:site.county,region:site.cityName+' / '+site.countyName,snapshotId:aIds.has(id)?current.id:before!.id};});
 const regionKey=context.city==='all'?'city':'county',groups=new Map<string,{name:string;ids:string[]}>();
 for(const row of metadata.values()){const id=row[regionKey],g=groups.get(id)??{name:regionKey==='city'?row.cityName:row.countyName,ids:[]};g.ids.push(row.id);groups.set(id,g);}
 const regions=[...groups].map(([id,g])=>pair(id,g.name,sum(g.ids.map(id=>value(av,id))),sum(g.ids.map(id=>value(bv,id))),g.ids));
 const operatorSites=new Map<string,Set<string>>();
 for(const capture of [a,b]){const customers=new Map(capture?.customers.map(c=>[c.id,c.operator]));for(const row of [...(capture?.configurations??[]),...(capture?.usage??[])]){const operator=row.customerId===null?undefined:customers.get(row.customerId);if(!operator||row.metricId!==metricId||!allIds.has(row.siteId))continue;const ids=operatorSites.get(operator)??new Set<string>();ids.add(row.siteId);operatorSites.set(operator,ids);}}
 const operators=allowed.filter(o=>context.operator==='all'||o===context.operator).map(operator=>pair(operator,operator,av.read(metricId,aIds,operator).quantity,bv.read(metricId,bIds,operator).quantity,[...(operatorSites.get(operator)??[])]));
 const total=pair('total','total',currentTotal,previousTotal,[...allIds]);
 const exact=total.delta!==null&&sites.every(r=>r.delta!==null);
 const positive=exact?String(sites.reduce((n,r)=>n+(BigInt(r.delta!)>0n?BigInt(r.delta!):0n),0n)):null;
 const negative=exact?String(sites.reduce((n,r)=>n+(BigInt(r.delta!)<0n?BigInt(r.delta!):0n),0n)):null;
 const movement=(rows:{delta:string|null}[])=>rows.some(r=>r.delta===null)?{positive:null,negative:null}:{positive:String(rows.reduce((n,r)=>n+(BigInt(r.delta!)>0n?BigInt(r.delta!):0n),0n)),negative:String(rows.reduce((n,r)=>n+(BigInt(r.delta!)<0n?BigInt(r.delta!):0n),0n))};
 const sort=<T extends {id:string;delta:string|null}>(items:T[])=>items.sort((a,b)=>{const x=a.delta===null?0n:BigInt(a.delta),y=b.delta===null?0n:BigInt(b.delta),ax=x<0n?-x:x,ay=y<0n?-y:y;return ax===ay?a.id.localeCompare(b.id):ax>ay?-1:1;});
 return {metric,comparable,reason:!a?'source':!before?'baseline':!metric||!prior?'metric':!comparable?'basis':total.delta===null?'quantity':null,revision:basis?.kind==='revision',baseline:before?serviceDescriptor(before.inventory.descriptor,b):null,total,positive,negative,movements:{operators:movement(operators),regions:movement(regions),sites:movement(sites)},changedSites:sites.filter(r=>r.delta!==null&&r.delta!=='0').length,unavailableSites:sites.filter(r=>r.delta===null).length,operators:sort(operators),regions:sort(regions),sites:sort(sites)};
}
export type ContributionAnalysis=ReturnType<typeof contributionAnalysis>;
