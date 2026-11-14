import {beijing,DEFAULT_HISTORY_ID,HISTORY_END,HISTORY_START,historyId,parseHistoryId} from '../../domains/tower-service/history-calendar';
import type {SnapshotContext} from '../../domains/tower-service/query';
export type SharingGrain='month'|'quarter'|'year';
export function sharingGrain(value:unknown):SharingGrain{if(value===undefined)return 'month';if(!['month','quarter','year'].includes(String(value))||typeof value!=='string')throw Error('invalid_sharing_grain');return value as SharingGrain;}
export function sharingPeriodId(value:string,grain:SharingGrain){
 if(!/^\d{4}-\d{2}-01$/.test(value))throw Error('invalid_sharing_date');
 const year=Number(value.slice(0,4)),month=Number(value.slice(5,7))-1,span=grain==='year'?12:grain==='quarter'?3:1;
 if(month<0||month>11)throw Error('invalid_sharing_date');
 const first=Math.floor(month/span)*span,start=Date.UTC(year,first,1)-8*3600000,end=Date.UTC(year,first+span,1)-8*3600000;
 if(end<=Date.parse(HISTORY_START)||start>=Date.parse(HISTORY_END))throw Error('invalid_sharing_date');
 return historyId('month',beijing(Math.min(end,Date.parse(HISTORY_END))-1));
}
export function sharingMonth(id:string,grain:SharingGrain){
 const p=parseHistoryId(id);if(!p)return id;
 const anchor=beijing(Date.parse(p.to)-1),year=Number(anchor.slice(0,4)),month=Number(anchor.slice(5,7));
 const endMonth=grain==='year'?12:grain==='quarter'?Math.ceil(month/3)*3:month;
 const end=Math.min(Date.UTC(year,endMonth,1)-8*3600000,Date.parse(HISTORY_END));
 return historyId('month',beijing(end-1));
}
export function analysisHref(context:Pick<SnapshotContext,'snapshotId'|'city'|'county'>,view:'energy'|'sharing'|'occupancy',grain:SharingGrain='month'){
 const snapshotId=view!=='energy'?sharingMonth(context.snapshotId,grain):context.snapshotId;
 return '/tower-service/judgment?'+new URLSearchParams({snapshotId,operator:'all',city:context.city,county:context.county,view,...(view!=='energy'?{grain}:{})});
}
export function sharingStep(id:string,grain:SharingGrain,direction:-1|1){
 const p=parseHistoryId(id);if(!p)return null;
 const date=beijing(Date.parse(p.to)-1),year=Number(date.slice(0,4)),month=Number(date.slice(5,7))-1,span=grain==='year'?12:grain==='quarter'?3:1;
 const start=Date.UTC(year,Math.floor(month/span)*span,1)-8*3600000;
 const next=direction<0?start-1:Date.UTC(year,Math.floor(month/span)*span+span,1)-8*3600000;
 if(next<Date.parse(HISTORY_START)||next>=Date.parse(HISTORY_END))return null;
 return sharingMonth(historyId('month',beijing(next)),grain);
}
export function sharingDestination(input:Record<string,string|string[]|undefined>){
 const params=new URLSearchParams({view:'sharing'});
 for(const key of ['snapshotId','city','county']){const value=input[key];if(value!==undefined)for(const v of Array.isArray(value)?value:[value])params.append(key,v);}
 if(!params.has('snapshotId'))params.set('snapshotId',DEFAULT_HISTORY_ID);
 return '/tower-service/judgment?'+params;
}
