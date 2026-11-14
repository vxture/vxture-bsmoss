export interface PhysicalServiceObservation {
 id:string;siteId:string;start:string;end:string;energyWh:string|null;power:'mains'|'battery'|null;
}
export interface PerformanceWindow {start:string;end:string}
const instant=(value:string)=>{if(!/(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('invalid_performance_time');return Date.parse(value);};
const range=(window:PerformanceWindow)=>{const start=instant(window.start),end=instant(window.end);if(end<=start)throw Error('invalid_performance_window');return {start,end};};
export function summarizePhysicalObservations(records:readonly PhysicalServiceObservation[],window:PerformanceWindow){
 const bounds=range(window),unique=new Map<string,PhysicalServiceObservation>();
 for(const record of records){
  if(!record.id||!record.siteId||record.energyWh!==null&&!/^\d+$/.test(record.energyWh)||!['mains','battery',null].includes(record.power))throw Error('invalid_physical_observation');
  const start=instant(record.start),end=instant(record.end);if(end<=start)throw Error('invalid_observation_interval');
  const previous=unique.get(record.id);if(previous&&JSON.stringify(previous)!==JSON.stringify(record))throw Error('conflicting_observation');
  if(start<bounds.end&&end>bounds.start){if(start<bounds.start||end>bounds.end)throw Error('unclipped_energy_interval');unique.set(record.id,record);}
 }
 const ordered=[...unique.values()].sort((a,b)=>a.siteId.localeCompare(b.siteId)||instant(a.start)-instant(b.start));
 let last:PhysicalServiceObservation|undefined,energy=0n,energyRecords=0,powerRecords=0;
 const sites=new Set<string>(),energySites=new Set<string>(),powerSites=new Set<string>(),batterySites=new Set<string>();
 for(const record of ordered){
  if(last?.siteId===record.siteId&&instant(record.start)<instant(last.end))throw Error('overlapping_physical_observation');
  last=record;sites.add(record.siteId);
  if(record.energyWh!==null){energy+=BigInt(record.energyWh);energyRecords++;energySites.add(record.siteId);}
  if(record.power!==null){powerRecords++;powerSites.add(record.siteId);if(record.power==='battery')batterySites.add(record.siteId);}
 }
 return {sites:sites.size,observedEnergyWh:energyRecords?String(energy):null,energyRecords,powerRecords,energySites:energySites.size,powerSites:powerSites.size,batterySites:batterySites.size,missingEnergyRecords:ordered.length-energyRecords};
}
export interface ConfirmedImpactEvent {id:string;start:string;end:string|null;confirmation:'confirmed'|'reported';targets:{siteId:string;serviceItemId:string}[]}
export interface ImpactServiceValidity {siteId:string;serviceItemId:string;from:string;to:string|null}
function unionLength(intervals:{start:number;end:number}[]){let total=0n,current:{start:number;end:number}|null=null;for(const interval of intervals.sort((a,b)=>a.start-b.start)){if(!current)current={...interval};else if(interval.start>current.end){total+=BigInt(current.end-current.start);current={...interval};}else current.end=Math.max(current.end,interval.end);}return total+(current?BigInt(current.end-current.start):0n);}
// Pure read model for future confirmed sources. Power samples are never input events.
export function confirmedServiceImpact(events:readonly ConfirmedImpactEvent[]|null,validity:readonly ImpactServiceValidity[]|null,window:PerformanceWindow,through:string){
 const bounds=range(window),cutoff=Math.min(bounds.end,instant(through));
 if(events===null||validity===null)return {events:null,sites:null,services:null,siteMilliseconds:null,serviceMilliseconds:null};
 const unique=new Map<string,ConfirmedImpactEvent>(),siteIntervals=new Map<string,{start:number;end:number}[]>(),serviceIntervals=new Map<string,{start:number;end:number}[]>(),accepted=new Set<string>();
 for(const service of validity){if(!service.siteId||!service.serviceItemId||service.to!==null&&instant(service.to)<=instant(service.from))throw Error('invalid_service_validity');instant(service.from);}
 for(const event of events){
  if(!event.id||!['confirmed','reported'].includes(event.confirmation)||event.end!==null&&instant(event.end)<=instant(event.start))throw Error('invalid_impact_event');
  instant(event.start);const previous=unique.get(event.id);if(previous&&JSON.stringify(previous)!==JSON.stringify(event))throw Error('conflicting_impact_event');unique.set(event.id,event);
 }
 for(const event of unique.values())if(event.confirmation==='confirmed')for(const target of event.targets){
  for(const service of validity.filter(row=>row.siteId===target.siteId&&row.serviceItemId===target.serviceItemId)){
   const start=Math.max(bounds.start,instant(event.start),instant(service.from)),end=Math.min(cutoff,event.end===null?cutoff:instant(event.end),service.to===null?cutoff:instant(service.to));
   if(end<=start)continue;accepted.add(event.id);
   const key=JSON.stringify([target.siteId,target.serviceItemId]),site=siteIntervals.get(target.siteId)??[],item=serviceIntervals.get(key)??[];site.push({start,end});item.push({start,end});siteIntervals.set(target.siteId,site);serviceIntervals.set(key,item);
  }
 }
 const sum=(rows:Map<string,{start:number;end:number}[]>)=>String([...rows.values()].reduce((total,value)=>total+unionLength(value),0n));
 return {events:accepted.size,sites:siteIntervals.size,services:serviceIntervals.size,siteMilliseconds:sum(siteIntervals),serviceMilliseconds:sum(serviceIntervals)};
}
