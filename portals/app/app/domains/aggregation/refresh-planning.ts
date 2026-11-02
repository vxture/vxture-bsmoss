import {bounds,bucketFor,instant,type Period} from './periods.ts';

export const REFRESH_PLANNING_VERSION='bsmoss-refresh-planning-v1';
export type RefreshGrain='day'|'week'|'month';
export interface RefreshWindow {grain:RefreshGrain;period:Period}
const GRAINS:readonly RefreshGrain[]=['day','week','month'];
function limitOf(limit:number){if(!Number.isSafeInteger(limit)||limit<1||limit>10000)throw Error('invalid_refresh_limit');return limit;}
function grainsOf(grains:readonly RefreshGrain[]){if(!Array.isArray(grains)||!grains.length||grains.length>3||grains.some(g=>!GRAINS.includes(g))||new Set(grains).size!==grains.length)throw Error('invalid_refresh_grains');return [...grains].sort((a,b)=>GRAINS.indexOf(a)-GRAINS.indexOf(b));}
function windowsFor(start:number,end:number,grains:readonly RefreshGrain[],limit:number):RefreshWindow[]{
  const result:RefreshWindow[]=[];
  for(const grain of grains){let cursor=start;
    while(cursor<end){
      if(result.length>=limit)throw Error('refresh_bound_exceeded');
      const period=bucketFor(new Date(cursor).toISOString(),grain);result.push({grain,period});cursor=Date.parse(period.end);
    }
  }
  return result;
}

// Pure internal planning only. The caller resolves authorized finite series and
// source validity; this does not schedule work or assert source completeness.
export function planPeriodicRefresh(input:{now:string;notBefore:string;grains:readonly RefreshGrain[];lookbackHours?:number;limit?:number}){
  const now=instant(input.now),notBefore=instant(input.notBefore),hours=input.lookbackHours??72,limit=limitOf(input.limit??10000),grains=grainsOf(input.grains);
  if(!Number.isSafeInteger(hours)||hours<1||hours>72)throw Error('invalid_refresh_lookback');
  if(notBefore>now)throw Error('future_refresh_start');
  const start=Math.max(notBefore,now-hours*3600000);
  const windows=start===now?[]:windowsFor(start,now,grains,limit).filter(w=>Date.parse(w.period.end)<=now);
  return {version:REFRESH_PLANNING_VERSION,reason:'closed_calendar' as const,scan:{start:new Date(start).toISOString(),end:new Date(now).toISOString()},windows};
}

// Supply both old and new affected intervals, including adjacent counter pairs.
// Legitimate historical corrections are not truncated to the 72-hour scan.
export function planRevisionRefresh(input:{affected:readonly Period[];grains:readonly RefreshGrain[];limit?:number}){
  const limit=limitOf(input.limit??10000),grains=grainsOf(input.grains);
  if(!Array.isArray(input.affected)||input.affected.length>10000)throw Error('invalid_refresh_intervals');
  const ranges=input.affected.map(bounds).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),merged:[number,number][]=[];
  for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}
  const unique=new Map<string,RefreshWindow>();
  for(const [start,end] of merged){
    for(const w of windowsFor(start,end,grains,limit)){
      const key=w.grain+':'+w.period.start;unique.set(key,w);
      if(unique.size>limit)throw Error('refresh_bound_exceeded');
    }
  }
  const windows=[...unique.values()].sort((a,b)=>GRAINS.indexOf(a.grain)-GRAINS.indexOf(b.grain)||a.period.start.localeCompare(b.period.start));
  return {version:REFRESH_PLANNING_VERSION,reason:'input_revision' as const,windows};
}
