import {OPERATORS} from '../../domains/tower-service/foundation';
import {historyTenancy} from '../../domains/tower-service/history';
import {beijing,parseHistoryId} from '../../domains/tower-service/history-calendar';
import {tenantMonth} from '../../domains/tower-service/tenancy';
import {readSnapshotContext,type QueryInput} from '../../domains/tower-service/query';
import type {readTowerPreview} from '../../domains/tower-service/history-reader';
import {resourceScope} from '../resources/model';
import {sharingGrain} from './analysis-links';

export type TenancyResult=Pick<Awaited<ReturnType<typeof readTowerPreview>>,'versions'|'access'|'history'|'scope'>;
export function tenancyContext(input:QueryInput,result:TenancyResult){
 for(const [key,value] of Object.entries(input))if(!['snapshotId','city','county','operator','view','grain','page'].includes(key)||typeof value!=='string'||value.length>160||key==='page'&&!/^[1-9]\d*$/.test(value))throw Error('invalid_sharing_query');
 if(input.operator!==undefined&&!['all',...result.access.operators].includes(String(input.operator)))throw Error('invalid_sharing_operator');
 const grain=sharingGrain(input.grain),snapshots=result.versions.map(v=>v.inventory.descriptor),global:QueryInput={};
 for(const key of ['snapshotId','city','county'])if(input[key]!==undefined)global[key]=input[key];
 const context=readSnapshotContext({...global,operator:'all'},snapshots,{...resourceScope,operators:['all',...result.access.operators],snapshotIds:snapshots.map(s=>s.id)}),version=result.versions.find(v=>v.id===context.snapshotId)!,inventory=version.inventory,p=parseHistoryId(context.snapshotId);
 const operators=OPERATORS.filter(o=>result.access.operators.includes(o)),regional=(r:{city:string;county:string})=>(context.city==='all'||r.city===context.city)&&(context.county==='all'||r.county===context.county);
 const target=p?beijing(Date.parse(p.to)-1).slice(0,7):inventory.descriptor.stockAsOf.slice(0,7),history=p?result.history:null;
 const sourceMonths=history?history.months.map(m=>m.month):inventory.tenancy?.refs.map(r=>r.month)??[];
 const start=[...sourceMonths].filter(m=>m<=target).sort()[0]??target,months:string[]=[];
 for(let cursor=start;cursor<=target;){months.push(cursor);const d=new Date(cursor+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);cursor=d.toISOString().slice(0,7);}
 const siteMap=new Map((history?.sites??inventory.rows).map(r=>[r.id,r]));
 const monthly=months.map(month=>{
  const source=history?historyTenancy(history,month,result.scope):tenantMonth(inventory.tenancy,month);
  const ids=history?(source?.sites??[]).filter(r=>{const site=siteMap.get(r.siteId);return !!site&&regional(site);}).map(r=>r.siteId):inventory.rows.filter(regional).map(r=>r.id);
  return {month,source,ids};
 });
 return {context,snapshot:inventory.descriptor,snapshots,grain,operators,target,monthly,history:!!history,availableSince:months[0]};
}
