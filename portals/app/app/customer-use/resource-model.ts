import {siteAnalysisModel} from '../site-analysis/model';
import {DEMO_DATE,DEMO_VERSION} from '../domains/map-demo/rules';
import {DEMO_REGION,DEMO_SITES} from '../domains/map-demo/resources';
import {registryRecord} from '../domains/site-registry/demo-store';
import {RESOURCE_MODEL_VERSION,resourceGraph} from '../domains/site-registry/resource-rules';
import {summarizeServiceResources} from '../domains/site-registry/service-resource-rules';
export function serviceResourceModel(input:Record<string,string|string[]|undefined>){
 const data=siteAnalysisModel(input),scope=siteAnalysisModel({...input,search:'',operatorCount:'all',site:'all'});
 const catalog=new Map(DEMO_SITES.map(site=>[site.id,site]));
 const evidence=scope.rows.map(row=>{
  const graph=resourceGraph(registryRecord(catalog.get(row.id)!,18),DEMO_DATE,DEMO_VERSION);
  // The inventory stays physical when a customer brand is selected.
  return {siteId:row.id,cityId:row.city,countyId:row.county,brands:row.allOperators,devices:graph.devices,graph};
 });
 const rollup=summarizeServiceResources(evidence,{mode:'demo',sourceVersion:DEMO_VERSION,resourceVersion:RESOURCE_MODEL_VERSION,observedAt:scope.snapshotAt+'+08:00'});
 const byId=new Map(evidence.map(row=>[row.siteId,row.graph]));
 const brandStructure=['mobile','telecom','unicom','broadcast','other'].map(code=>({code,sites:evidence.filter(row=>row.brands.includes(code as typeof row.brands[number])).length,devices:evidence.reduce((count,row)=>count+row.devices.filter(device=>device.owner===code).length,0)}));
 const rows=data.rows.filter(row=>data.query.site==='all'||data.query.site===row.id).map(row=>{
  const graph=byId.get(row.id)!;
  return {...row,devices:graph.devices.map(device=>({id:device.id,name:device.name,category:device.category,owner:device.owner})),resources:graph.devices.length};
 });
 const page=Math.min(data.query.page,Math.max(1,Math.ceil(rows.length/data.query.pageSize)));
 const visible=new Set(rows.slice((page-1)*data.query.pageSize,page*data.query.pageSize).map(row=>row.id));
 return {...data,rows,summary:scope.summary,rollup,brandStructure,evidence:evidence.filter(row=>visible.has(row.siteId)),resourceRegions:rollup.regions.map(row=>({...row,name:DEMO_REGION.cities.find(region=>region.id===row.cityId)?.name??'\u5e02\u7ea7\u672a\u5f52\u5c5e'}))};
}
export type ServiceResourceModel=ReturnType<typeof serviceResourceModel>;
