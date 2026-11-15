import type {DemoSite} from '../map-demo/types';
import {QUALITY_DIMENSIONS,serviceQuality,type QualityInput} from './quality';
// Independent synthetic facility observations, not target scores or radio KPIs.
export function demoQuality(site:DemoSite,month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('invalid_quality_month');
 const [year,number]=month.split('-').map(Number),days=new Date(Date.UTC(year,number,0)).getUTCDate();
 const expected=days*86400,seed=(site.seed+year*17+number*31)>>>0;
 const outage=seed%19===0?3600+(seed%4)*900:seed%7===0?180:0;
 const bad={power:outage,backup:seed%11===0?72000:seed%3===0?7200:0,environment:seed%5===0?21600:3600,recovery:Math.max(0,outage-3600)};
 const input=Object.fromEntries(QUALITY_DIMENSIONS.map(id=>[id,{expectedSeconds:expected,observedSeconds:seed%97===0?Math.floor(expected*0.9):expected,badSeconds:bad[id],applicable:true,complete:true,source:`synthetic-facility-v1/${site.id}/${month}/${id}`}])) as QualityInput;
 return serviceQuality(input,site.profile==='hub'&&outage>=3600);
}
