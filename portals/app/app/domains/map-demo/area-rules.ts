import {selectionBounds} from './geometry.ts';
import type { AreaAnalysis, DemoSite, MapQuery } from './types.ts';
import { OPERATOR_CODES } from './types.ts';
import { siteHour } from './rules.ts';
// Sum counters first; never average station percentages or duplicate physical energy per operator.
export function analyzeArea(sites:readonly DemoSite[],query:MapQuery):AreaAnalysis {
  if(!query.selection)throw Error('selection_required');
  const operators=OPERATOR_CODES.filter(op=>query.operator==='all'||op===query.operator).map(code=>{
    const applicable=sites.filter(s=>s.operators.includes(code));
    let bytes=0,voiceSeconds=0,sms=0,attempts=0,connected=0;
    for(const site of applicable){const m=siteHour(site,query.hour,code);bytes+=m.bytes;voiceSeconds+=m.voiceSeconds;sms+=m.sms;attempts+=m.attempts;connected+=m.connected;}
    return {code,sites:applicable.length,bytes,voiceSeconds,sms,connectionRate:attempts?connected/attempts:null};
  });
  const series=Array.from({length:24},(_,hour)=>{
    let bytes=0,voiceSeconds=0,attempts=0,connected=0,used=0,capacity=0,energyWh=0;
    for(const site of sites){const m=siteHour(site,hour,query.operator);bytes+=m.bytes;voiceSeconds+=m.voiceSeconds;attempts+=m.attempts;connected+=m.connected;used+=m.used;capacity+=m.capacity;energyWh+=m.energyWh??0;}
    return {hour,bytes,voiceSeconds,connectionRate:attempts?connected/attempts:null,load:capacity?used/capacity:null,energyWh:query.operator==='all'?energyWh:null};
  });
  return {bounds:selectionBounds(query.selection),selection:query.selection,operators,series};
}
