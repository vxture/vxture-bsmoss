import type {QueryInput} from '../../domains/tower-service/query';
import type {InventoryRow,PublishedSnapshot} from '../../domains/tower-service/foundation';
import {tenantMonth,summarizeTenancy} from '../../domains/tower-service/tenancy';
import {publishedResourceModel} from './published-model';
import {parseHistoryId,beijing} from '../../domains/tower-service/history-calendar';

import {facilities,type Facility} from './vocabulary';
const localKeys=['view','siteType','scene','facility','metric','sort','direction','month','tenantCount','anchor','regionLevel','regionRanking','resourceView'];
const typeKeys=['ground','rooftop','unknown'],sceneKeys=['urban','hub','industrial','mountain','efficient','shared','unknown'];
export function baselineModel(input:QueryInput,versions:PublishedSnapshot[]){
 for(const value of Object.values(input))if(typeof value!=='string')throw Error('invalid_resource_query');
 if(input.search!==undefined&&(input.search as string).trim().length>80||input.operatorCount!==undefined&&!['all','1','2','3','4','5'].includes(input.operatorCount as string))throw Error('invalid_resource_query');
 const baseInput:QueryInput={};for(const [key,value] of Object.entries(input))if(!localKeys.includes(key))baseInput[key]=value;
 const pick=(key:string,values:readonly string[],fallback:string)=>{const raw=input[key]??fallback;if(typeof raw!=='string'||!values.includes(raw))throw Error('invalid_resource_'+key);return raw;};
 const view=pick('view',['composition','sites','sharing','regions'],'sites'),siteType=pick('siteType',['all',...typeKeys],'all'),scene=pick('scene',['all',...sceneKeys],'all'),facility=pick('facility',['all',...Object.keys(facilities)],'all'),metric=pick('metric',['sites',...Object.keys(facilities),'sharing'],'sites'),sort=pick('sort',['code','value'],'code'),direction=pick('direction',['asc','desc'],'asc'),tenantCount=pick('tenantCount',['all','0','1','2','3','4','5+'],'all'),anchor=pick('anchor',['all','yes','no','unknown'],'all');
 if(view!=='sites'){baseInput.search='';baseInput.operatorCount='all';}
 const model=publishedResourceModel(baseInput,versions),{context}=model,inventory=versions.find(s=>s.id===context.snapshotId)!.inventory;
 pick('regionLevel',['city','county'],context.city==='all'?'city':'county');
 const regionRanking=pick('regionRanking',['all','top','bottom'],'all'),regionLevel=regionRanking==='all'&&context.city==='all'?'city':'county';
 const requestedView=pick('resourceView',['compare','tower','operators'],'tower'),resourceView=requestedView==='compare'?'tower':requestedView;
 const scope=inventory.rows.filter(r=>(context.city==='all'||r.city===context.city)&&(context.county==='all'||r.county===context.county)&&(context.operator==='all'||r.allOperators.includes(context.operator)));
 const months=inventory.tenancy?.refs.map(r=>r.month).sort().reverse()??[],month=input.month??(parseHistoryId(context.snapshotId)?beijing(Date.parse(model.snapshot.stockAsOf)-1).slice(0,7):model.snapshot.stockAsOf.slice(0,7));
 if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month!==model.snapshot.stockAsOf.slice(0,7)&&!months.includes(month))throw Error('invalid_resource_month');
 const monthly=tenantMonth(inventory.tenancy,month),tenancy=summarizeTenancy(monthly,scope.map(r=>r.id));
 const owned=(rows:InventoryRow[],kind?:string)=>new Set(rows.flatMap(r=>r.devices.filter(d=>d.owner==='\u94c1\u5854'&&(!kind||d.category===kind)).map(d=>d.id))).size;
 const customerDevices=(rows:InventoryRow[])=>new Map(rows.flatMap(r=>r.devices.filter(d=>d.owner!=='\u94c1\u5854'&&(context.operator==='all'||d.owner===context.operator)).map(d=>[d.id,d] as const)));
 const customers=customerDevices(scope),customerCounts=[...new Set([...['mobile','telecom','unicom','broadcast','other'].filter(code=>context.operator==='all'||code===context.operator),...Array.from(customers.values(),d=>d.owner)])].map(code=>{const devices=[...customers.values()].filter(d=>d.owner===code);return {code,count:devices.length,sites:scope.filter(r=>r.devices.some(d=>d.owner===code)).length,categories:[...new Set(devices.map(d=>d.category))].map(category=>({category,count:devices.filter(d=>d.category===category).length}))};});
 const resourceTotals={sites:scope.length,facilities:owned(scope),customerDevices:customers.size};
 const previous=versions.find(s=>s.id===context.compareSnapshotId),previousScope=previous?.inventory.rows.filter(r=>(context.city==='all'||r.city===context.city)&&(context.county==='all'||r.county===context.county)&&(context.operator==='all'||r.allOperators.includes(context.operator)));
 const customerDelta=model.comparison?.comparable&&previousScope?String(customers.size-customerDevices(previousScope).size):null;
 const metadata=Object.fromEntries(scope.map(r=>[r.id,r.attributes??null]));
 const ids=new Set(scope.filter(r=>(siteType==='all'||(r.attributes?.siteType??'unknown')===siteType)&&(scene==='all'||(r.attributes?.scene??'unknown')===scene)&&(facility==='all'||r.devices.some(d=>d.owner==='\u94c1\u5854'&&d.category===facilities[facility as Facility]))).map(r=>r.id));
 const rows=model.data.rows.filter(r=>view!=='sites'||ids.has(r.id)),page=Math.min(model.data.query.page,Math.max(1,Math.ceil(rows.length/model.data.query.pageSize))),visible=new Set(rows.slice((page-1)*model.data.query.pageSize,page*model.data.query.pageSize).map(r=>r.id));
 // A county view still retains its selected row. Unknown geography is separate,
 // and missing regions are never materialized as zero-valued observations.
 const byCity=regionLevel==='city';
 const regions=[...new Set(scope.map(r=>byCity?r.city:r.county))].map(code=>{const members=scope.filter(r=>(byCity?r.city:r.county)===code),shared=summarizeTenancy(monthly,members.map(r=>r.id)),devices=customerDevices(members);return {code,name:(byCity?members[0]?.cityName:members[0]?.countyName)||'\u672a\u5f52\u5c5e',city:members[0]?.city??'unknown',cityName:members[0]?.cityName??'',county:byCity?'all':code,sites:members.length,facilities:owned(members),customerDevices:devices.size,operators:Object.fromEntries(customerCounts.map(customer=>[customer.code,[...devices.values()].filter(d=>d.owner===customer.code).length])),categories:Object.fromEntries(Object.entries(facilities).map(([key,value])=>[key,owned(members,value)])),sharing:shared.sharingRate,value:metric==='sites'?members.length:metric==='sharing'?shared.sharingRate:owned(members,facilities[metric as Facility])};});
 regions.sort((a,b)=>{if(a.code==='unknown')return b.code==='unknown'?0:1;if(b.code==='unknown')return -1;if(sort==='value'&&(a.value===null||b.value===null))return a.value===b.value?0:a.value===null?1:-1;const n=sort==='value'?a.value!-b.value!:a.code.localeCompare(b.code);return (direction==='desc'?-1:1)*n;});
 const rankValue=(r:typeof regions[number])=>resourceView==='tower'?r.facilities:r.customerDevices;
 const chartRegions=regionRanking==='all'?regions:[...regions].filter(r=>r.code!=='unknown').sort((a,b)=>(regionRanking==='top'?-1:1)*(rankValue(a)-rankValue(b))||a.code.localeCompare(b.code)).slice(0,10);
 return {...model,resourceTotals,customerCounts,customerDelta,view,filters:{siteType,scene,facility,metric,sort,direction,month,tenantCount,anchor,regionLevel,regionRanking,resourceView},months,metadata:view==='sites'?metadata:{},tenancy:monthly?tenancy:{...tenancy,rows:[]},tenantRows:(monthly?tenancy.rows:[]).filter(r=>(tenantCount==='all'||(tenantCount==='5+'?r.count!==null&&r.count>=5:r.count===Number(tenantCount)))&&(anchor==='all'||r.anchor===anchor)).map(r=>({...r,name:scope.find(s=>s.id===r.siteId)!.name})),tenantVersion:monthly?{id:monthly.id,revision:monthly.revision,asOf:monthly.asOf,sourceVersion:monthly.sourceVersion}:null,regions,chartRegions,facilityCounts:Object.entries(facilities).map(([key,label])=>({key,label,count:owned(scope,label)})),missingAttributes:scope.filter(r=>!r.attributes).length,data:{...model.data,rows:view==='sites'?rows:[],query:{...model.data.query,page},evidence:scope.filter(r=>view==='sites'&&visible.has(r.id)).map(r=>({siteId:r.id,cityId:r.city,countyId:r.county,brands:r.allOperators as typeof model.data.evidence[number]['brands'],devices:r.graph.devices,graph:r.graph}))}};
}
export type BaselineModel=ReturnType<typeof baselineModel>;
