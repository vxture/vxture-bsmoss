import { authenticatedDemoEnabled, demoDataEnabled } from "../../lib/demo-mode";
import type {FoundationAccess,PublishedSnapshot} from './foundation';
import {assertAccess} from './foundation';
import type {QueryInput,SnapshotDescriptor} from './query';
import {serviceDescriptor} from './quantification';
import {previewAccess,previewFoundation,previewReadInventory,previewRoot,previewSeed,validPreviewSession} from './preview';
import {readDemoHistory} from './history-store';
import {postgresDemoEnabled,readDemoPeriods} from './demo-artifact';
import {historyAggregate,historyScope,materializeHistory,type DemoHistory} from './history';
import {DEFAULT_HISTORY_ID,HISTORY_START,HISTORY_END,HISTORY_VERSION,parseHistoryId,historyWindow,stepHistory,yearHistory} from './history-calendar';
let reference: ReturnType<typeof previewSeed> | undefined;
const materialized=new Map<string,PublishedSnapshot>();
function capturedHistory(h:DemoHistory,id:string,scope:ReturnType<typeof historyScope>){const key=id+'|'+JSON.stringify([...scope.operators].sort())+'|'+JSON.stringify([...scope.siteIds].sort());let snapshot=materialized.get(key);if(!snapshot){snapshot=materializeHistory(h,id,scope);materialized.set(key,snapshot);if(materialized.size>4)materialized.delete(materialized.keys().next().value!);}return snapshot;}
// Explicit preview adapter only. Formal pages continue to require real access.
// Existing workspace snapshots/reports are never rewritten or bulk-hydrated.
export async function readTowerPreview(input:QueryInput,session:string|undefined,options:{comparison?:boolean}={}){
 if(!demoDataEnabled())throw Error('preview_unavailable');
 if(authenticatedDemoEnabled())session=undefined;
 const original=validPreviewSession(session)?await previewFoundation(session).read():{state:reference??(reference=previewSeed('reference-only')),access:previewAccess('reference-only')};
 const access:FoundationAccess={...previewAccess(validPreviewSession(session)?'preview-'+session:'reference-only'),...original.access};assertAccess(access,'read',Date.now());
 const databasePeriods=postgresDemoEnabled() && input.view==='periods';
 const bundle=await readDemoHistory(previewRoot()+'/demo-history',previewReadInventory(),false,input.view==='periods'&&!databasePeriods);
 let h=bundle.history;
 const query={...input};if(!query.snapshotId)query.snapshotId=DEFAULT_HISTORY_ID;
 if(databasePeriods)h={...h,rollups:await readDemoPeriods(historyWindow(parseHistoryId(query.snapshotId)?.id??DEFAULT_HISTORY_ID))};
 const scope=historyScope(h,access,Date.now());
 const selected=parseHistoryId(query.snapshotId),ids=new Set<string>();if(selected){ids.add(selected.id);if(options.comparison||query.view==='periods'||query.view==='comparison'){const mode=query.comparisonMode??(query.compareSnapshotId?'custom':'previous'),baseline=mode==='year'?yearHistory(selected.id):mode==='previous'?stepHistory(selected.id,-1):null;if(baseline)ids.add(baseline);}}
 if(typeof query.compareSnapshotId==='string'&&parseHistoryId(query.compareSnapshotId))ids.add(query.compareSnapshotId);
 const versions=[...original.state.snapshots,...[...ids].map(id=>capturedHistory(h,id,scope))];
 const descriptors=historyWindow(selected?.id??DEFAULT_HISTORY_ID).map(id=>historyDescriptor(h,id,access));
 for(const v of versions)if(!descriptors.some(d=>d.id===v.id))descriptors.push(v.inventory.descriptor);
 assertAccess(access,'read',Date.now());
 return {input:query,versions,access,history:h,scope,catalog:descriptors,metadata:{version:HISTORY_VERSION,start:HISTORY_START,end:HISTORY_END,bytes:bundle.bytes,digest:bundle.digest,days:h.days,relations:h.relations.length,dailyFacts:h.daily.length,configs:h.configs.length,months:h.months.length}};
}
export function historyDescriptor(h:DemoHistory|undefined,id:string,access:FoundationAccess):SnapshotDescriptor {
 const p=parseHistoryId(id)!;return {id,dataset:'site-resources',mode:'demo',sourceVersion:HISTORY_VERSION,mappingVersion:HISTORY_VERSION+':resources',stockAsOf:p.to,dataThrough:p.to,businessPeriod:{start:p.start,end:p.end},periodComplete:p.complete,syncedAt:HISTORY_END,publishedAt:HISTORY_END,ruleSetVersion:HISTORY_VERSION,scopeKey:JSON.stringify([...access.operators].sort())};
}
export function historyServiceTrend(result:Awaited<ReturnType<typeof readTowerPreview>>,metric:string,city:string,county:string,operator:string){
 const {history:h,scope}=result;const current=parseHistoryId(result.input.snapshotId);if(!current)return null;
 return historyWindow(current.id).map(id=>{const p=parseHistoryId(id)!,value=historyAggregate(h,id,metric,scope,{city,county,operator});return {id,start:p.start,end:p.end,asOf:p.to,complete:p.complete,quantity:value.quantity,compatible:p.complete,values:result.access.operators.filter(o=>operator==='all'||operator===o).map(operator=>({operator,quantity:historyAggregate(h,id,metric,scope,{city,county,operator}).quantity}))};});
}
export function extendHistoryCatalog<T extends {snapshots:SnapshotDescriptor[]}>(model:T,result:Pick<Awaited<ReturnType<typeof readTowerPreview>>,'catalog'>,services=false):T {
 const descriptors=result.catalog.map(d=>{
  if(!parseHistoryId(d.id))return model.snapshots.find(s=>s.id===d.id)??d;
  if(!services)return d;
  // Descriptor only: no full inventory is constructed for unselected periods.
  return {...d,dataset:'tower-services',mappingVersion:HISTORY_VERSION+':mapping',ruleSetVersion:HISTORY_VERSION+':catalog:DEMO-SERVICE-v1'};
 });
 return {...model,snapshots:descriptors.reverse()};
}
