import {DEMO_DATE} from "../domains/map-demo/rules";
export function analysisWindow(requested:string,period:"hour"|"day"|"week"|"month") {
 const requestedTime=Date.parse(requested+"+08:00");
 const available=Array.from({length:24},(_,hour)=>DEMO_DATE+"T"+String(hour).padStart(2,"0")+":00:00");
 const bounds=(value:string)=>{
  const local=new Date(value+"Z");
  if(period==="hour")local.setUTCMinutes(0,0,0);
  else {local.setUTCHours(0,0,0,0);if(period==="week")local.setUTCDate(local.getUTCDate()-(local.getUTCDay()||7)+1);if(period==="month")local.setUTCDate(1);}
  const start=local.getTime()-8*3600000;
  if(period==="month")local.setUTCMonth(local.getUTCMonth()+1);
  else local.setTime(local.getTime()+(period==="hour"?3600000:period==="week"?7*86400000:86400000));
  return {start,end:local.getTime()-8*3600000};
 };
 let window=bounds(requested);
 let times=available.filter(at=>{const time=Date.parse(at+"+08:00");return time>=window.start&&time<window.end;});
 const adjusted=times.length===0;
 if(adjusted){const nearest=available.reduce((best,at)=>Math.abs(Date.parse(at+"+08:00")-requestedTime)<Math.abs(Date.parse(best+"+08:00")-requestedTime)?at:best);window=bounds(nearest);times=available.filter(at=>{const time=Date.parse(at+"+08:00");return time>=window.start&&time<window.end;});}
 const asOf=times[times.length-1];
 const index=available.indexOf(asOf);
 return {times,asOf,adjusted,start:new Date(window.start).toISOString(),end:new Date(window.end).toISOString(),
  previousAsOf:period==="hour"&&index>0?available[index-1]:null,nextAsOf:period==="hour"&&index<23?available[index+1]:null};
}
