import {siteAnalysisModel} from '../site-analysis/model';
import {businessWindow,usageBuckets} from '../domains/business-usage/rules';
import {calendarSource,CALENDAR_RULE_VERSION,SAMPLE_CUTOFF} from '../domains/map-demo/period-rules';
import {DEMO_DATE,DEMO_VERSION} from '../domains/map-demo/rules';
import {DEMO_REGION,DEMO_SITES} from '../domains/map-demo/resources';
import {analysisPeriod} from '../domains/analysis/period';
import {summarizePhysicalObservations,confirmedServiceImpact,type PhysicalServiceObservation} from '../domains/site-registry/service-performance-rules';
const filters=['all','battery','missing'] as const;
type PhysicalSummary=ReturnType<typeof summarizePhysicalObservations>;
// Only combines disjoint calendar buckets from the same selected demo version.
function combineDemoSummaries(rows:PhysicalSummary[],sameSite=false):PhysicalSummary{
 const sum=(key:Exclude<keyof PhysicalSummary,'observedEnergyWh'>)=>sameSite&&['sites','energySites','powerSites','batterySites'].includes(key)?Math.max(0,...rows.map(row=>row[key])):rows.reduce((n,row)=>n+row[key],0);
 const known=rows.filter(row=>row.observedEnergyWh!==null);
 return {sites:sum('sites'),energySites:sum('energySites'),powerSites:sum('powerSites'),batterySites:sum('batterySites'),energyRecords:sum('energyRecords'),powerRecords:sum('powerRecords'),missingEnergyRecords:sum('missingEnergyRecords'),observedEnergyWh:known.length?String(known.reduce((n,row)=>n+BigInt(row.observedEnergyWh!),0n)):null};
}
export function servicePerformanceModel(input:Record<string,string|string[]|undefined>){
 const {supplyFilter='all',...base}=input;if(typeof supplyFilter!=='string'||!filters.includes(supplyFilter as typeof filters[number]))throw Error('invalid_supply_filter');
 // Validate the entire query before normalizing the physical measurement scope.
 const validated=siteAnalysisModel({...base,asOf:base.asOf??DEMO_DATE+'T23:00:00'});
 const normalized={...base,operator:'all',operatorCount:'all',sharing:'all',status:'all',asOf:base.asOf??DEMO_DATE+'T23:00:00'};
 const details=siteAnalysisModel(normalized),scope=siteAnalysisModel({...normalized,search:'',site:'all'}),window=businessWindow(validated.requestedAsOf,details.query.period),buckets=usageBuckets(window,details.query.period);
 const catalog=new Map(DEMO_SITES.map(site=>[site.id,site]));
 const observations=scope.rows.map(row=>{
  const source=calendarSource(catalog.get(row.id)!);
  const series=buckets.map(bucket=>{
   if(details.query.period==='week'||details.query.period==='month'){
    const daily=source.physicalDaily(bucket.key);if(!Number.isSafeInteger(daily.energyWh)||daily.energyWh<0)throw Error('invalid_demo_energy');
    return {sites:1,observedEnergyWh:String(daily.energyWh),energyRecords:daily.physicalSamples,powerRecords:daily.physicalSamples,energySites:1,powerSites:1,batterySites:daily.batterySamples?1:0,missingEnergyRecords:0};
   }
   const at=bucket.times[0],value=source.sample(at.slice(0,10),Number(at.slice(11,13)),'all');
   return summarizePhysicalObservations([{id:row.id+'/'+at,siteId:row.id,start:at+'+08:00',end:new Date(Date.parse(at+'Z')+3600000).toISOString().slice(0,19)+'+08:00',energyWh:value.energyWh===null?null:String(value.energyWh),power:value.power}],window);
  });
  return {id:row.id,series,...combineDemoSummaries(series,true)};
 });
 const total=combineDemoSummaries(observations),byId=new Map(observations.map(row=>[row.id,row]));
 const searched=details.rows.filter(row=>details.query.site==='all'||row.id===details.query.site);
 const matches=(id:string,filter:string)=>filter==='all'||filter==='battery'&&byId.get(id)!.batterySites>0||filter==='missing'&&byId.get(id)!.missingEnergyRecords>0;
 const facets=filters.map(value=>({value,count:searched.filter(row=>matches(row.id,value)).length}));
 const rows=searched.filter(row=>matches(row.id,supplyFilter));
 const page=Math.min(details.query.page,Math.max(1,Math.ceil(rows.length/details.query.pageSize))),visible=new Set(rows.slice((page-1)*details.query.pageSize,page*details.query.pageSize).map(row=>row.id));
 const aggregates=observations.map(({series,...row})=>row);
 const regions=[...new Set(scope.rows.map(row=>row.city))].sort().map(city=>{const ids=new Set(scope.rows.filter(row=>row.city===city).map(row=>row.id));return {id:city,name:DEMO_REGION.cities.find(row=>row.id===city)!.name,...combineDemoSummaries(observations.filter(row=>ids.has(row.id)))};});
 const series=buckets.map((bucket,index)=>({key:bucket.key,label:bucket.label,...combineDemoSummaries(observations.map(row=>row.series[index]))}));
 const evidence=aggregates.filter(row=>visible.has(row.id)).map(row=>{
  const source=calendarSource(catalog.get(row.id)!);
  const records:PhysicalServiceObservation[]=window.times.map(at=>{const value=source.sample(at.slice(0,10),Number(at.slice(11,13)),'all');return {id:'demo/'+row.id+'/'+at,siteId:row.id,start:at+'+08:00',end:new Date(Date.parse(at+'Z')+3600000).toISOString().slice(0,19)+'+08:00',energyWh:value.energyWh===null?null:String(value.energyWh),power:value.power};});
  return {...row,records};
 });
 return {...details,rows,summary:scope.summary,query:{...details.query,asOf:window.asOf},updatedThrough:SAMPLE_CUTOFF,snapshotAt:window.asOf,previousAsOf:window.previousAsOf,nextAsOf:window.nextAsOf,adjusted:window.adjusted,
  performance:{total,regions,series,aggregates,evidence,window,period:analysisPeriod(window,details.query.period),filter:supplyFilter,facets,
   source:{mode:'demo' as const,version:DEMO_VERSION,ruleVersion:CALENDAR_RULE_VERSION,boundary:'physical_site' as const,kind:'interval_energy' as const},
   impact:confirmedServiceImpact(null,null,window,window.end),customerEnergyWh:null,meterBinding:null,maintenance:null,assurance:null}};
}
export type ServicePerformanceModel=ReturnType<typeof servicePerformanceModel>;
