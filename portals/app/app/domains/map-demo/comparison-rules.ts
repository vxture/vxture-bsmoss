import { GIB } from './rules.ts';
import { mapContextKey } from './geometry.ts';
import type { HourMetrics, MapQuery } from './types.ts';
export const COMPARE_LIMIT=4;
export type ComparisonMetric='traffic'|'voice'|'sms'|'connection'|'load'|'energy'|'temperature'|'latency';
export function parseComparisonIds(value:string):string[] {
  const ids=value.split(',');
  if(ids.length<1||ids.length>COMPARE_LIMIT||new Set(ids).size!==ids.length||ids.some(id=>! /^[A-Za-z0-9-]{1,40}$/.test(id)))throw Error('invalid_comparison');
  return ids;
}
// Search locates candidates; it must not hide already pinned comparison stations.
export function comparisonContextKey(q:MapQuery,ids:readonly string[]):string {
  return JSON.stringify([mapContextKey({...q,search:''}),ids]);
}
export function comparisonValue(metric:ComparisonMetric,m:HourMetrics):number|null {
  switch(metric){
    case 'traffic':return m.bytes/GIB;
    case 'voice':return m.voiceSeconds/3600;
    case 'sms':return m.sms;
    case 'connection':return m.attempts?m.connected/m.attempts*100:null;
    case 'load':return m.capacity?m.used/m.capacity*100:null;
    case 'energy':return m.energyWh===null?null:m.energyWh/1000;
    case 'temperature':return m.temperature;
    case 'latency':return m.latency;
  }
}
