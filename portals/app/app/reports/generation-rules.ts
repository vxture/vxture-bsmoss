import {DEMO_REGION} from '../domains/map-demo/resources';
import {DEMO_DATE} from '../domains/map-demo/rules';
import {historicalDate} from '../domains/map-demo/history-calendar';
import {parseSiteQuery} from '../domains/site-registry/rules';
export function generationQuery(input:Record<string,string|string[]|undefined>){
 for(const [key,value] of Object.entries(input))if(!['city','county','operator','period','date'].includes(key)||typeof value!=='string')throw Error('invalid_generation_query');
 const period=input.period??'day',date=input.date??DEMO_DATE;
 if(typeof period!=='string'||!['day','week','month'].includes(period)||typeof date!=='string')throw Error('invalid_generation_query');
 historicalDate(date);
 const q=parseSiteQuery({city:input.city??'all',county:input.county??'all',operator:input.operator??'all'},DEMO_REGION);
 return {city:q.city,county:q.county,operator:q.operator,period:period as 'day'|'week'|'month',date};
}
export type GenerationQuery=ReturnType<typeof generationQuery>;
export function generationHref(q:GenerationQuery){return '/reports/new?'+new URLSearchParams(q);}
