import {serializeSelection} from '../domains/map-demo/geometry';
import type {MapQuery} from '../domains/map-demo/types';
export interface Investigation {value:string;href:string;label:string;source:'uv'|'history'|'snapshot'}
export function investigationValue(href:string){
 const clean=href.split('#')[0];
 if(!clean.startsWith('/')||clean.startsWith('//')||clean.length>6000)throw Error('invalid_investigation');
 const p=new URLSearchParams(clean.split('?')[1]);p.delete('investigation');
 return JSON.stringify({v:1,href:clean.split('?')[0]+'?'+p});
}
export function keepInvestigation(href:string,current?:Investigation){
 if(!current)return href;
 const [base,fragment]=href.split('#'),[path,query='']=base.split('?'),p=new URLSearchParams(query);
 p.set('investigation',current.value);return path+'?'+p+(fragment?'#'+fragment:'');
}
export function carryInvestigation(href:string,origin:string,current?:Investigation){
 return keepInvestigation(href,current??{value:investigationValue(origin),href:origin,label:'',source:'snapshot'});
}
export function mapInvestigationHref(s:Pick<MapQuery,'cityId'|'countyId'|'operator'|'hour'|'search'> & {selection?:MapQuery['selection']|null;selectedId?:string|null;topic?:string;topicOpen?:boolean;usageOpen?:boolean;usagePeriod?:string;reportOpen?:boolean;reportPeriod?:string;compareIds?:string[]}){
 const p=new URLSearchParams({city:s.cityId,county:s.countyId,operator:s.operator,hour:String(s.hour)});
 if(s.selection)p.set('selection',serializeSelection(s.selection));if(s.search)p.set('search',s.search);
 if(s.selectedId)p.set('site',s.selectedId);if(s.topicOpen&&s.topic)p.set('topic',s.topic);
 if(s.usageOpen&&s.usagePeriod)p.set('usage',s.usagePeriod);if(s.reportOpen&&s.reportPeriod)p.set('report',s.reportPeriod);
 if(s.compareIds?.length)p.set('compare',s.compareIds.join(','));return '/product-preview?'+p;
}
