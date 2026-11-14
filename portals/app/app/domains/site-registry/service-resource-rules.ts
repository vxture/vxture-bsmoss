// Snapshot resources are observations, never confirmed service items.
export interface ServiceResourceObservation {
 siteId:string;cityId:string|null;countyId:string|null;brands:readonly string[];
 devices:readonly {id:string;category:string;owner:string}[];
}
export interface ServiceResourceScope {
 mode:'demo';sourceVersion:string;resourceVersion:string;observedAt:string;
}
export const SERVICE_CATEGORIES=['mounting','space','facilities','power','maintenance'] as const;
export function summarizeServiceResources(rows:readonly ServiceResourceObservation[],source:ServiceResourceScope){
 const sites=new Map<string,ServiceResourceObservation>(),devices=new Map<string,{siteId:string;category:string;owner:string}>();
 for(const row of rows){
  if(sites.has(row.siteId))throw Error('duplicate_resource_site');
  sites.set(row.siteId,row);
  for(const device of row.devices){
   const previous=devices.get(device.id);
   if(previous&&(previous.siteId!==row.siteId||previous.category!==device.category||previous.owner!==device.owner))throw Error('conflicting_resource_identity');
   devices.set(device.id,{siteId:row.siteId,category:device.category,owner:device.owner});
  }
 }
 const physical=[...devices.values()],brands=new Set(rows.flatMap(row=>[...row.brands]));
 const totals={sites:sites.size,brands:brands.size,infrastructure:physical.filter(d=>d.owner==='\u94c1\u5854').length,customerDevices:physical.filter(d=>d.owner!=='\u94c1\u5854').length,devices:devices.size};
 const regions=[...new Set(rows.map(row=>row.cityId))].sort((a,b)=>(a??'~').localeCompare(b??'~')).map(cityId=>{
  const members=rows.filter(row=>row.cityId===cityId),ids=new Set(members.map(row=>row.siteId));
  return {cityId,sites:ids.size,infrastructure:physical.filter(d=>ids.has(d.siteId)&&d.owner==='\u94c1\u5854').length,customerDevices:physical.filter(d=>ids.has(d.siteId)&&d.owner!=='\u94c1\u5854').length};
 });
 const categories=[...new Set(physical.map(d=>d.category))].map(category=>({category,count:physical.filter(d=>d.category===category).length}));
 return {source,totals,regions,categories,confirmed:{sites:null,customers:null,serviceItems:null,configuration:null,validity:null,changes:null},serviceSources:SERVICE_CATEGORIES.map(category=>({category,status:'not_connected' as const}))};
}
