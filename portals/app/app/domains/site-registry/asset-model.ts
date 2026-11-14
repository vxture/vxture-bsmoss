import {DEMO_REGION,DEMO_SITES} from "../map-demo/resources";
import {DEMO_DATE,DEMO_VERSION} from "../map-demo/rules";
import {registryRecord} from "./demo-store";
import {resourceGraph} from "./resource-rules";
import {parseSiteQuery,type SiteRecord} from "./rules";
import {maintenanceFor,type MaintenanceCatalog,type MaintenanceRecord} from "./maintenance-rules";
import {DEVICE_CATEGORIES} from "./asset-labels";
export type AssetSite=Pick<SiteRecord,"id"|"name"|"assetCode"|"cityId"|"countyId"|"cityName"|"countyName"|"siteType"|"profile"|"address"|"lng"|"lat"|"towerType"|"heightMeters"|"roomType"|"operators">;
export interface AssetDevice {id:string;name:string;category:keyof typeof DEVICE_CATEGORIES;categoryName:string;owner:string;spec:string;siteId:string;shared:boolean}
export interface AssetRow {id:string;kind:"site";name:string;code:string;site:AssetSite;deviceCount:number;maintenance:MaintenanceRecord|null}
function sourceAssets(){
 return DEMO_SITES.map(raw=>{
  const record=registryRecord(raw,18);
  const {id,name,assetCode,cityId,countyId,cityName,countyName,siteType,profile,address,lng,lat,towerType,heightMeters,roomType,operators}=record;
  const site:AssetSite={id,name,assetCode,cityId,countyId,cityName,countyName,siteType,profile,address,lng,lat,towerType,heightMeters,roomType,operators};
  const graph=resourceGraph(record,DEMO_DATE,DEMO_VERSION);
  const devices:AssetDevice[]=graph.devices.map(device=>{
   const suffix=device.id.slice(site.id.length+1),category:keyof typeof DEVICE_CATEGORIES=suffix==="T01"?"tower":suffix==="P01"?"power":suffix==="B01"?"battery":suffix==="E01"?"meter":suffix==="C01"?"cooling":"radio";
   return {id:device.id,name:device.name,category,categoryName:DEVICE_CATEGORIES[category],owner:device.relationId===null?"tower":device.owner,spec:device.spec,siteId:site.id,shared:device.relationId===null};
  });
  return {site,devices};
 });
}
export function assetSource(){return {id:"station-snapshot",name:"\u7ad9\u7f51\u57fa\u7840\u8d44\u6599\u5feb\u7167",version:DEMO_VERSION,through:DEMO_DATE+"T18:00:00+08:00",syncedAt:null,mapping:"unconnected" as const,sync:"unconnected" as const};}
export function assetRegistry(input:Record<string,string|string[]|undefined>,catalog:MaintenanceCatalog,canMaintain=false){
 const parsed=parseSiteQuery(input,DEMO_REGION),q={...parsed,view:"sites" as const,status:"all",sharing:"all",sort:"name" as const,hour:18,period:"day" as const};
 q.category="all";q.owner="all";q.site="all";
 if(parsed.view==="devices"){q.page=1;q.maintenance="all";}
 const sites=sourceAssets().filter(({site})=>(q.city==="all"||site.cityId===q.city)&&(q.county==="all"||site.countyId===q.county)&&(q.site==="all"||site.id===q.site)&&(q.siteType==="all"||site.siteType===q.siteType)&&(q.scene==="all"||site.profile===q.scene)&&(q.operator==="all"||site.operators.some(code=>code===q.operator)));
 const rows:AssetRow[]=sites.map(({site,devices})=>({id:site.id,kind:"site",name:site.name,code:site.assetCode,site,deviceCount:devices.length,maintenance:maintenanceFor(catalog,"site",site.id)??null}));
 const term=q.search.toLocaleLowerCase();
 const filtered=rows.filter(row=>(!term||[row.id,row.name,row.code,row.site.id,row.site.name,row.site.address,row.maintenance?.alias??"",row.maintenance?.note??""].some(value=>value.toLocaleLowerCase().includes(term)))&&(q.maintenance==="all"||(q.maintenance==="maintained")===!!row.maintenance));
 filtered.sort((a,b)=>((a.maintenance?.alias||a.name).localeCompare(b.maintenance?.alias||b.name)||a.id.localeCompare(b.id))*(q.direction==="asc"?1:-1));
 const count=filtered.length,pages=Math.max(1,Math.ceil(count/q.pageSize)),page=Math.min(q.page,pages);
 return {query:{...q,page},source:assetSource(),canMaintain,count,pages,rows:filtered.slice((page-1)*q.pageSize,page*q.pageSize)};
}
export function assetDetail(id:string,catalog:MaintenanceCatalog,canMaintain=false){
 const entry=sourceAssets().find(entry=>entry.site.id===id);
 if(!entry)return null;
 const ids=new Set([entry.site.id,...entry.devices.map(device=>device.id)]);
 return {kind:"site-assets" as const,...entry,source:assetSource(),canMaintain,maintenance:{records:catalog.records.filter(record=>ids.has(record.id)),events:catalog.events.filter(event=>ids.has(event.id))}};
}
export function hasAsset(kind:"site"|"device",id:string){return sourceAssets().some(entry=>kind==="site"?entry.site.id===id:entry.devices.some(device=>device.id===id));}
export type AssetRegistry=ReturnType<typeof assetRegistry>;
export type AssetDetail=NonNullable<ReturnType<typeof assetDetail>>;
