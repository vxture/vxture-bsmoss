import {OPERATORS} from '../../domains/tower-service/foundation';
import {energyAnalysis} from '../../domains/tower-service/energy';
import {readSnapshotContext,type QueryInput} from '../../domains/tower-service/query';
import {resourceScope} from '../resources/model';
import type {readTowerPreview} from '../../domains/tower-service/history-reader';
export function energyModel(input:QueryInput,result:Awaited<ReturnType<typeof readTowerPreview>>){
 for(const [key,value] of Object.entries(input))if(!['snapshotId','compareSnapshotId','city','county','operator','view','page'].includes(key)||typeof value!=='string'||value.length>160||key==='page'&&!/^[1-9]\d*$/.test(value))throw Error('invalid_energy_query');
 const global:QueryInput={};for(const key of ['snapshotId','city','county'])if(input[key]!==undefined)global[key]=input[key];
 const snapshots=result.versions.map(v=>v.inventory.descriptor),context=readSnapshotContext({...global,operator:'all'},snapshots,{...resourceScope,operators:['all',...result.access.operators],snapshotIds:snapshots.map(s=>s.id)}),snapshot=result.versions.find(v=>v.id===context.snapshotId)!;
 const operator=String(input.operator??'all');
 if(!['all',...result.access.operators].includes(operator))throw Error('invalid_energy_filter');
 const analysis=energyAnalysis(snapshot,context,result.access.operators,{history:result.history,scope:result.scope});
 const {entries,...summary}=analysis;
 const customers=analysis.operators.map(row=>{
  const records=entries.filter(r=>r.operator===row.operator),allocated=records.filter(r=>r.method==='allocated'),known=allocated.filter(r=>r.state==='complete');
  const total=(values:(string|null)[])=>values.every(v=>v!==null)?values.reduce((n,v)=>n+BigInt(v!),0n).toString():null;
  return {...row,name:records[0]?.customerName??row.operator,measuredRecords:records.filter(r=>r.method==='measured').length,allocatedRecords:allocated.length,pendingMeasured:total(records.filter(r=>r.method==='measured'&&r.state!=='complete').map(r=>r.observed)),pendingAllocated:total(allocated.filter(r=>r.state!=='complete').map(r=>r.observed)),shareBps:allocated.length&&allocated.every(r=>r.shareBps===allocated[0].shareBps)?allocated[0].shareBps:null,poolQuantity:total(known.map(r=>r.poolQuantity)),ruleRefs:[...new Set(allocated.flatMap(r=>r.ruleRef?[r.ruleRef]:[]))],sourceRefs:[...new Set(records.filter(r=>r.method==='measured').map(r=>r.ruleRef).filter((v):v is string=>!!v))]};
 });
 return {context,snapshot:snapshot.inventory.descriptor,snapshots,allowedOperators:result.access.operators.filter(o=>OPERATORS.includes(o as typeof OPERATORS[number])),analysis:summary,customers,filters:{operator}};
}
export type EnergyModel=ReturnType<typeof energyModel>;
