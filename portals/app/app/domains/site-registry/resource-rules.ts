import type {Operator,OperatorFilter} from '../map-demo/types';
import type {SiteRecord} from './rules';

export const RESOURCE_MODEL_VERSION='bsmoss-site-resource-snapshot-v2';
export type ResourceValidity={from:null;to:null;basis:'unknown'};
export type ResourceObservation={kind:'power'|'energy'|'temperature'|'none';value:string|number|null};
export interface ResourceDevice {
 id:string;siteId:string;name:string;category:string;owner:string;relationId:string|null;relationIds:string[];
 spec:string;state:'unknown';stateLabel:string;validity:ResourceValidity;observation:ResourceObservation;
}
export interface ResourceRelation {
 id:string;siteId:string;code:Operator;deviceIds:string[];validity:ResourceValidity;
}
export interface ResourceGraph {
 version:string;sourceVersion:string;observedAt:string;
 physical:{id:string;name:string;assetCode:string;validity:ResourceValidity};
 relations:ResourceRelation[];devices:ResourceDevice[];
}
const unknownValidity=():ResourceValidity=>({from:null,to:null,basis:'unknown'});

// One observed inventory, never a lifecycle or equipment telemetry history.
export function resourceGraph(site:Pick<SiteRecord,'id'|'name'|'assetCode'|'towerType'|'heightMeters'|'operators'|'current'>,date:string,sourceVersion:string):ResourceGraph {
 const ids=site.operators.map(code=>site.id+'-'+code);
 const shared:{suffix:string;name:string;category:string;spec:string;observation:ResourceObservation}[]=[
  {suffix:'T01',name:site.towerType,category:'\u5854\u4f53',spec:site.heightMeters+' m',observation:{kind:'none',value:null}},
  {suffix:'P01',name:'\u5f00\u5173\u7535\u6e90',category:'\u4f9b\u7535',spec:'-48 V / 600 A',observation:{kind:'power',value:site.current.power}},
  {suffix:'B01',name:'\u540e\u5907\u7535\u6c60\u7ec4',category:'\u50a8\u80fd',spec:'48 V / 200 Ah',observation:{kind:'power',value:site.current.power}},
  {suffix:'E01',name:'\u7ad9\u5740\u603b\u7535\u8868',category:'\u8ba1\u91cf',spec:'\u7269\u7406\u7ad9\u7ea7 \u00b7 Wh',observation:{kind:'energy',value:site.current.energyWh}},
  {suffix:'C01',name:'\u673a\u623f\u7a7a\u8c03',category:'\u73af\u5883',spec:'\u7cbe\u5bc6\u6e29\u63a7',observation:{kind:'temperature',value:site.current.temperature}},
 ];
 const devices:ResourceDevice[]=shared.map(d=>({id:site.id+'-'+d.suffix,siteId:site.id,name:d.name,category:d.category,
  owner:'\u94c1\u5854',relationId:null,relationIds:[...ids],spec:d.spec,state:'unknown',stateLabel:'\u672a\u91c7\u96c6',validity:unknownValidity(),observation:d.observation}));
 site.operators.forEach((code,i)=>devices.push({id:site.id+'-R'+(i+1),siteId:site.id,name:'\u65e0\u7ebf\u63a5\u5165\u8bbe\u5907',category:'\u65e0\u7ebf',
  owner:code,relationId:ids[i],relationIds:[ids[i]],spec:i%2===0?'4G / 5G':'5G',state:'unknown',stateLabel:'\u672a\u91c7\u96c6',validity:unknownValidity(),observation:{kind:'none',value:null}}));
 return {version:RESOURCE_MODEL_VERSION,sourceVersion,observedAt:date+'T'+String(site.current.hour).padStart(2,'0')+':00:00+08:00',
  physical:{id:site.id,name:site.name,assetCode:site.assetCode,validity:unknownValidity()},devices,
  relations:site.operators.map((code,i)=>({id:ids[i],siteId:site.id,code,deviceIds:devices.filter(d=>d.relationIds.includes(ids[i])).map(d=>d.id),validity:unknownValidity()}))};
}

export function resourceScope(graph:ResourceGraph,operator:OperatorFilter){
 const relations=graph.relations.filter(r=>operator==='all'||r.code===operator),ids=new Set(relations.flatMap(r=>r.deviceIds));
 return {relations,devices:graph.devices.filter(d=>ids.has(d.id))};
}
