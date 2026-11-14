import {serviceResourceModel} from '../../customer-use/resource-model';
import {DEMO_DATE,DEMO_VERSION} from '../../domains/map-demo/rules';
import {RESOURCE_MODEL_VERSION} from '../../domains/site-registry/resource-rules';
import {DEMO_REGION} from '../../domains/map-demo/resources';
import {readSnapshotContext,type QueryInput,type SnapshotDescriptor,type SnapshotScope} from '../../domains/tower-service/query';
export const resourceSnapshot:SnapshotDescriptor={id:'demo-resources-20261025-18-v1',dataset:'site-resources',mode:'demo',sourceVersion:DEMO_VERSION,mappingVersion:RESOURCE_MODEL_VERSION,stockAsOf:DEMO_DATE+'T18:00:00+08:00',businessPeriod:null,dataThrough:DEMO_DATE+'T18:00:00+08:00',syncedAt:null,publishedAt:null,periodComplete:null,ruleSetVersion:null,scopeKey:'610000:all:broadcast,mobile,other,telecom,unicom'};
export const resourceScope:SnapshotScope={snapshotIds:[resourceSnapshot.id],operators:['all','mobile','telecom','unicom','broadcast','other'],regions:[{city:'all',county:'all'},...DEMO_REGION.cities.map(c=>({city:c.id,county:'all'})),...DEMO_REGION.counties.map(c=>({city:c.cityId,county:c.id}))]};
export function resourceQueryModel(input:QueryInput){
 const global:QueryInput={},local:QueryInput={};
 for(const [key,value] of Object.entries(input))(['search','page','pageSize','operatorCount'].includes(key)?local:global)[key]=value;
 const context=readSnapshotContext(global,[resourceSnapshot],resourceScope);
 const data=serviceResourceModel({...local,city:context.city,county:context.county,operator:context.operator});
 return {data,context,snapshots:[resourceSnapshot],snapshot:resourceSnapshot};
}
export type ResourceQueryModel=ReturnType<typeof resourceQueryModel>&{comparison?:{kind:string;comparable:boolean;sites:string|null;facilities:string|null}};
