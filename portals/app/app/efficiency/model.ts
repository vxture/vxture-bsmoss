import {siteAnalysisModel} from '../site-analysis/model';
import {analysisWindow} from '../site-analysis/time-window';
import {analysisTimeBuckets,analysisPeriod} from '../domains/analysis/period';
import {DEMO_SITES} from '../domains/map-demo/resources';
import {DEMO_DATE,siteHour} from '../domains/map-demo/rules';
import {defaultMonitoringConfiguration,readMonitoringConfiguration,monitoringConfigurationPolicy,type MonitoringConfiguration} from '../domains/monitoring/parameters';
import {energyObservation,summarizeEnergy,type EnergySample,type EnergyObservation} from '../domains/efficiency/rules';
export const energyFilters=['all','normal','warning','critical','zero','unknown'] as const;
export function efficiencyModel(input:Record<string,string|string[]|undefined>,rawConfiguration:MonitoringConfiguration=defaultMonitoringConfiguration()){
 const {energyFilter='all',topic,...base}=input;
 if(typeof energyFilter!=='string'||!energyFilters.includes(energyFilter as typeof energyFilters[number]))throw Error('invalid_energy_filter');
 if(topic!==undefined&&topic!=='efficiency')throw Error('invalid_efficiency_topic');
 const configuration=readMonitoringConfiguration(rawConfiguration),p=configuration.parameters;
 // Physical meters have no operator allocation; old provider links use the whole station.
 const normalized={...base,operator:'all',operatorCount:'all',sharing:'all',period:base.period??(base.hour!==undefined?'hour':'day'),asOf:base.asOf??(base.hour!==undefined?DEMO_DATE+'T'+String(base.hour).padStart(2,'0')+':00:00':DEMO_DATE+'T23:00:00')};
 const details=siteAnalysisModel(normalized),scope=siteAnalysisModel({...normalized,search:''}),window=analysisWindow(details.requestedAsOf,details.query.period);
 const catalog=new Map(DEMO_SITES.map(s=>[s.id,s])),cache=new Map<string,EnergySample>();
 const sample=(id:string,at:string)=>{const key=id+':'+at;let value=cache.get(key);if(!value){const m=siteHour(catalog.get(id)!,Number(at.slice(11,13)),'all');value={energyWh:m.energyWh,bytes:m.bytes};cache.set(key,value);}return value;};
 const observe=(id:string,times:readonly string[]=window.times)=>energyObservation(times.map(at=>sample(id,at)),p);
 const observations=new Map(scope.rows.map(r=>[r.id,observe(r.id)]));
 const matches=(r:EnergyObservation,filter:string)=>filter==='all'||filter==='normal'&&r.level==='normal'||filter==='warning'&&r.level==='warning'||filter==='critical'&&r.level==='critical'||filter==='zero'&&r.zeroTraffic||filter==='unknown'&&r.missing>0;
 const searched=details.rows.map(row=>({...row,energy:observations.get(row.id)!})),facets=energyFilters.map(value=>({value,count:searched.filter(r=>matches(r.energy,value)).length}));
 const rank={critical:0,warning:1,unknown:2,normal:3};
 const rows=searched.filter(r=>matches(r.energy,energyFilter)).sort((a,b)=>Number(b.energy.zeroTraffic)-Number(a.energy.zeroTraffic)||rank[a.energy.level]-rank[b.energy.level]||(b.energy.intensity??-1)-(a.energy.intensity??-1)||a.id.localeCompare(b.id));
 const aggregate=(members:typeof scope.rows,times:readonly string[]=window.times)=>summarizeEnergy(members.map(r=>times===window.times?observations.get(r.id)!:observe(r.id,times)));
 const total=aggregate(scope.rows),regions=scope.regions.map(r=>({...r,...aggregate(scope.rows.filter(s=>scope.query.city==='all'?s.city===r.id:s.county===r.id))}));
 const buckets=analysisTimeBuckets(window.times,details.query.period),series=buckets.map(bucket=>({key:bucket.key,label:bucket.label,...aggregate(scope.rows,bucket.times)}));
 const page=Math.min(details.query.page,Math.max(1,Math.ceil(rows.length/details.query.pageSize))),visible=new Set(rows.slice((page-1)*details.query.pageSize,page*details.query.pageSize).map(r=>r.id));
 const clientRows=rows.map(row=>({...row,energy:{...row.energy,series:visible.has(row.id)?buckets.map(bucket=>({key:bucket.key,label:bucket.label,...observe(row.id,bucket.times)})):[],samples:visible.has(row.id)?window.times.map(at=>({at,...observe(row.id,[at])})):[]}}));
 return {...details,query:{...details.query,asOf:window.asOf,hour:Number(window.asOf.slice(11,13))},snapshotAt:window.asOf,adjusted:window.adjusted,previousAsOf:window.previousAsOf,nextAsOf:window.nextAsOf,rows:clientRows,summary:scope.summary,
  efficiency:{configuration,total,regions,series,period:analysisPeriod(window,details.query.period),window,facets,filter:energyFilter,policy:monitoringConfigurationPolicy(configuration)}};
}
export type EfficiencyModel=ReturnType<typeof efficiencyModel>;
