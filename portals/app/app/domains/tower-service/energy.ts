import {evaluateEvidence} from './evidence';
import {OPERATORS,type PublishedSnapshot} from './foundation';
import {hourlyShares,type DemoHistory,type HistoryScope} from './history';
import {DAY,historyDay,parseHistoryId,beijing} from './history-calendar';

export const ENERGY_MODEL_VERSION='site-energy-ledger-v1';
// A separate, versioned reference-only meter model. Existing customer readings,
// captures and reports are never rewritten. Contract shares are fixed; absent
// customers' shares stay unallocated, never redistributed by tenant count.
const contractBps:Record<string,number>={mobile:3600,telecom:2700,unicom:1800,broadcast:600,other:300};
const hash=(s:string)=>{let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return n>>>0;};
export interface EnergyEntry {id:string;siteId:string;customerId:string;operator:string;customerName:string;method:string;quantity:string|null;observed:string|null;state:string;meterId:string;from:string;to:string;sourceRef:string;ruleRef:string|null;shareBps:number|null;poolQuantity:string|null;reason:string}
const sum=(values:(string|null)[])=>values.every(v=>v!==null)?values.reduce((n,v)=>n+BigInt(v!),0n).toString():null;
const add=(a:string|null,b:string|null)=>a===null||b===null?null:(BigInt(a)+BigInt(b)).toString();
export function energyAnalysis(snapshot:PublishedSnapshot,region:{city:string;county:string},allowed:readonly string[],reference?:{history:DemoHistory;scope:HistoryScope}){
 const sites=snapshot.inventory.rows.filter(s=>(region.city==='all'||s.city===region.city)&&(region.county==='all'||s.county===region.county)),siteIds=new Set(sites.map(s=>s.id)),cities=new Map(sites.map(s=>[s.id,s.city]));
 const capture=snapshot.inventory.evidence,evaluation=capture?evaluateEvidence(capture,snapshot.inventory.tenancy,cities):null;
 const rows=evaluation?.rows.filter(r=>siteIds.has(r.siteId)&&r.meter.unit==='Wh'&&r.meter.scale===0)??[];
 const entries:EnergyEntry[]=rows.filter(r=>r.customer&&allowed.includes(r.customer.operator)).map(r=>({id:r.id,siteId:r.siteId,customerId:r.customer!.id,operator:r.customer!.operator,customerName:r.customer!.name.replace(/\s*\(DEMO\)$/,''),method:r.method,quantity:r.quantity,observed:r.rawQuantity,state:r.state,meterId:r.meterId,from:r.from,to:r.to,sourceRef:r.sourceRef,ruleRef:r.rule?.reference??null,shareBps:r.rule?.metering?.allocationBps??null,poolQuantity:r.method==='allocated'?r.rawQuantity:null,reason:r.reason}));
 const whole=OPERATORS.every(o=>allowed.includes(o)),period=capture?.period??snapshot.inventory.descriptor.businessPeriod;
 const originalPhysical=rows.filter(r=>r.meter.role==='total'&&r.meter.boundary==='physical_site'&&r.customer===null);
 let physical=whole&&originalPhysical.length?sum(originalPhysical.map(r=>r.rawQuantity)):null,common:string|null=null,retained:string|null=null,unallocated:string|null=null;
 let trend:{label:string;physical:string;dedicated:string;common:string}[]=[],referenceVersion:string|null=null;
 const p=parseHistoryId(snapshot.id);
 if(reference&&p&&snapshot.origin==='reference'&&snapshot.inventory.descriptor.mode==='demo'){
  referenceVersion=ENERGY_MODEL_VERSION;
  const h=reference.history,start=Date.parse(p.from),end=Date.parse(p.to),first=historyDay(p.from),last=Math.ceil((end-Date.parse(h.start))/DAY);
  const members=new Map<number,{pair:number;operator:string;from:number;to:number}[]>();
  h.relations.forEach((r,pair)=>{if(!siteIds.has(h.sites[r.site].id))return;const a=members.get(r.site)??[];a.push({...r,pair});members.set(r.site,a);});
  const trendMap=new Map<string,{physical:bigint;dedicated:bigint;common:bigint}>(),allocations=new Map<string,{siteId:string;operator:string;quantity:bigint;pool:bigint}>();
  let totalCommon=0n,totalPhysical=0n,totalRetained=0n,totalUnallocated=0n;
  const accumulate=(siteId:string,active:{operator:string}[],pool:bigint,dedicated:bigint,key:string)=>{
   const observed=dedicated+pool,bucket=trendMap.get(key)??{physical:0n,dedicated:0n,common:0n};bucket.physical+=observed;bucket.dedicated+=dedicated;bucket.common+=pool;trendMap.set(key,bucket);
   let used=pool/10n;
   for(const r of active){const q=pool*BigInt(contractBps[r.operator])/10000n;used+=q;if(!allowed.includes(r.operator))continue;const key=siteId+'|'+r.operator,a=allocations.get(key)??{siteId,operator:r.operator,quantity:0n,pool:0n};a.quantity+=q;a.pool+=pool;allocations.set(key,a);}
   totalCommon+=pool;totalPhysical+=observed;totalRetained+=pool/10n;totalUnallocated+=pool-used;
  };
  const origin=Date.parse(h.start),windows=Array.from({length:last-first},(_,offset)=>{
   const day=first+offset,dayStart=origin+day*DAY,date=beijing(dayStart);
   return {day,dayStart,month:Number(date.slice(5,7))-1,lo:Math.max(0,(start-dayStart)/3600000),hi:Math.min(24,(end-dayStart)/3600000),key:p.grain==='year'?date.slice(0,7):date.slice(5,10)};
  });
  h.sites.forEach((site,index)=>{
   if(!siteIds.has(site.id))return;
   const relations=members.get(index)??[],commonBase=100+hash(h.seed+site.id+':common')%170;
   for(const {day,dayStart,month,lo,hi,key} of windows){
    if(day<h.activated[index])continue;
    const active=relations.filter(r=>r.from<=day&&day<r.to),units=Math.floor(commonBase*[100,96,88,82,90,110,130,128,106,88,92,104][month]/100);
    // Complete days use the existing daily facts directly. Common-meter units
    // and fixed whole-percent shares conserve integers across hourly splits.
    // Only hour/day charts need to project the hourly shape.
    if(p.grain!=='day'&&p.grain!=='hour'&&lo===0&&hi===24){
     accumulate(site.id,active,BigInt(units)*100n,active.reduce((n,r)=>n+BigInt(h.daily[r.pair*h.days+day]),0n),key);
     continue;
    }
    const sharedHours=hourlyShares(units,index,day),hourly=active.map(r=>({r,values:hourlyShares(h.daily[r.pair*h.days+day],r.pair,day)}));
    for(let hour=lo;hour<hi;hour++){
     const pool=BigInt(sharedHours[hour])*100n,dedicated=hourly.reduce((n,v)=>n+BigInt(v.values[hour]),0n);
     const key=p.grain==='year'?beijing(dayStart).slice(0,7):p.grain==='day'||p.grain==='hour'?beijing(dayStart+hour*3600000).slice(11,16):beijing(dayStart).slice(5,10);
     accumulate(site.id,active,pool,dedicated,key);
    }
   }
  });
  for(const [key,a] of allocations){const confirmed=!['broadcast','other'].includes(a.operator);entries.push({id:ENERGY_MODEL_VERSION+':'+key,siteId:a.siteId,customerId:'demo-customer-'+a.operator,operator:a.operator,customerName:entries.find(r=>r.operator===a.operator)?.customerName??a.operator,method:'allocated',quantity:confirmed?a.quantity.toString():null,observed:a.quantity.toString(),state:confirmed?'complete':'pending',meterId:ENERGY_MODEL_VERSION+':common:'+a.siteId,from:p.from,to:p.to,sourceRef:ENERGY_MODEL_VERSION+'/common/'+a.siteId+'/'+p.from+'/'+p.to,ruleRef:confirmed?ENERGY_MODEL_VERSION+'/agreement/'+a.operator:null,shareBps:whole?contractBps[a.operator]:null,poolQuantity:whole?a.pool.toString():null,reason:confirmed?'complete':'agreement_pending'});}
  if(whole){physical=totalPhysical.toString();common=totalCommon.toString();retained=totalRetained.toString();unallocated=totalUnallocated.toString();trend=[...trendMap].map(([label,v])=>({label,physical:v.physical.toString(),dedicated:v.dedicated.toString(),common:v.common.toString()}));}
 }
 const totals=(list:EnergyEntry[])=>{
  const measured=sum(list.filter(r=>r.state==='complete'&&r.method==='measured').map(r=>r.quantity)),allocated=sum(list.filter(r=>r.state==='complete'&&r.method==='allocated').map(r=>r.quantity)),estimated=sum(list.filter(r=>r.state==='estimated').map(r=>r.quantity));
  const pendingRows=list.filter(r=>r.state!=='complete'&&r.state!=='estimated'),pending=sum(pendingRows.map(r=>r.method==='allocated'&&r.poolQuantity!==null&&r.observed===r.poolQuantity?null:r.observed));
  return {measured,allocated,estimated,confirmed:add(measured,allocated),pending,pendingRecords:pendingRows.length,missing:pendingRows.filter(r=>r.observed===null).length,sites:new Set(list.map(r=>r.siteId)).size};
 };
 const customerTotals=totals(entries),operators=allowed.map(operator=>({id:operator,operator,...totals(entries.filter(r=>r.operator===operator))})).filter(r=>r.sites>0);
 const accounted=retained===null?null:add(customerTotals.confirmed,retained),remaining=physical===null||accounted===null?null:(BigInt(physical)-BigInt(accounted)).toString();
 return {period,complete:capture?.complete??false,whole,physical,common,retained,unallocated,remaining,referenceVersion,customerTotals,operators,entries,trend,sourceVersion:capture?.sourceVersion??null};
}
export type EnergyAnalysis=ReturnType<typeof energyAnalysis>;
