export type QueryInput=Record<string,string|string[]|undefined>;
export interface SnapshotDescriptor {
 id:string;dataset:string;mode:'demo'|'production';sourceVersion:string;mappingVersion:string;
 stockAsOf:string;businessPeriod:{start:string;end:string}|null;dataThrough:string;
 syncedAt:string|null;publishedAt:string|null;periodComplete:boolean|null;ruleSetVersion:string|null;scopeKey?:string;
}
export interface SnapshotScope {snapshotIds:readonly string[];operators:readonly string[];regions:readonly {city:string;county:string}[]}
export interface SnapshotContext {snapshotId:string;businessPeriod:SnapshotDescriptor['businessPeriod'];compareSnapshotId:string|null;operator:string;city:string;county:string}
const keys=['snapshotId','compareSnapshotId','operator','city','county'];
// Catalogue and scope are server-owned. Query strings never supply grants.
export function readSnapshotContext(input:QueryInput,catalog:readonly SnapshotDescriptor[],scope:SnapshotScope):SnapshotContext {
 for(const [key,value] of Object.entries(input))if(!keys.includes(key)||typeof value!=='string'||value.length>160)throw Error('invalid_snapshot_query');
 const snapshotId=input.snapshotId??scope.snapshotIds[0];
 if(typeof snapshotId!=='string'||!scope.snapshotIds.includes(snapshotId)||!catalog.some(s=>s.id===snapshotId))throw Error('invalid_snapshot_scope');
 const compareSnapshotId=input.compareSnapshotId??null;
 if(compareSnapshotId!==null&&(typeof compareSnapshotId!=='string'||compareSnapshotId===snapshotId||!scope.snapshotIds.includes(compareSnapshotId)||!catalog.some(s=>s.id===compareSnapshotId)))throw Error('invalid_comparison_scope');
 const operator=input.operator??'all',city=input.city??'all',county=input.county??'all';
 if(typeof operator!=='string'||!scope.operators.includes(operator)||typeof city!=='string'||typeof county!=='string'||!scope.regions.some(r=>r.city===city&&r.county===county))throw Error('invalid_snapshot_scope');
 return {snapshotId,businessPeriod:catalog.find(s=>s.id===snapshotId)!.businessPeriod,compareSnapshotId,operator,city,county};
}
export function snapshotQuery(context:SnapshotContext):Record<string,string>{return {snapshotId:context.snapshotId,...(context.compareSnapshotId?{compareSnapshotId:context.compareSnapshotId}:{}),operator:context.operator,city:context.city,county:context.county};}
// Navigate actual captures, including revisions at the same stock timestamp.
export function snapshotNeighbors(catalog:readonly SnapshotDescriptor[],snapshotId:string){
 const ordered=[...catalog].sort((a,b)=>Date.parse(a.stockAsOf)-Date.parse(b.stockAsOf)
  ||(Date.parse(a.syncedAt??a.publishedAt??'')||0)-(Date.parse(b.syncedAt??b.publishedAt??'')||0)
  ||a.id.localeCompare(b.id));
 const index=ordered.findIndex(s=>s.id===snapshotId);
 return {previous:index>0?ordered[index-1].id:null,next:index>=0&&index<ordered.length-1?ordered[index+1].id:null};
}
export type ComparisonKind='revision'|'month'|'year'|'custom';
export function snapshotComparison(a:SnapshotDescriptor,b:SnapshotDescriptor){
 const ap=a.businessPeriod,bp=b.businessPeriod,start=(s:SnapshotDescriptor)=>s.businessPeriod?.start??s.stockAsOf;
 const samePeriod=ap&&bp?ap.start===bp.start&&ap.end===bp.end:!ap&&!bp&&a.stockAsOf===b.stockAsOf;
 const calendarMonth=(p:SnapshotDescriptor['businessPeriod'])=>!!p&&p.start.slice(8,10)==='01'&&p.start.slice(11)==='00:00:00+08:00'&&Date.parse(p.end)===Date.UTC(Number(p.start.slice(0,4)),Number(p.start.slice(5,7)),1)-8*3600000;
 const fullMonths=calendarMonth(ap)&&calendarMonth(bp);
 const calendarYear=(p:SnapshotDescriptor['businessPeriod'])=>!!p&&p.start.slice(5)==='01-01T00:00:00+08:00'&&p.end===String(Number(p.start.slice(0,4))+1)+'-01-01T00:00:00+08:00';
 const fullYears=calendarYear(ap)&&calendarYear(bp);
 const monthDistance=(Number(start(a).slice(0,4))-Number(start(b).slice(0,4)))*12+Number(start(a).slice(5,7))-Number(start(b).slice(5,7));
 const kind:ComparisonKind=samePeriod?'revision':fullMonths&&monthDistance===1?'month':(fullMonths||fullYears)&&monthDistance===12?'year':'custom';
 const equalDuration=!ap&&!bp||!!ap&&!!bp&&Date.parse(ap.end)-Date.parse(ap.start)===Date.parse(bp.end)-Date.parse(bp.start);
 const comparable=a.dataset===b.dataset&&a.mappingVersion===b.mappingVersion&&a.ruleSetVersion===b.ruleSetVersion&&a.scopeKey===b.scopeKey&&a.mode===b.mode&&(!ap&&!bp||!!ap&&!!bp&&a.periodComplete===true&&b.periodComplete===true&&(equalDuration||fullMonths||fullYears))&&Number.isFinite(Date.parse(start(a)))&&Number.isFinite(Date.parse(start(b)));
 return {kind,comparable,changeAllowed:comparable&&kind!=='revision',reason:comparable?null:'incompatible_basis' as const};
}
// Percentage changes are integer basis points. Formatting is a separate concern.
export function compareQuantity(a:string|null,b:string|null,comparable:boolean){
 if(!comparable||a===null||b===null)return {delta:null,change:null};
 if(!/^\d+$/.test(a)||!/^\d+$/.test(b))throw Error('invalid_comparison_quantity');
 const av=BigInt(a),bv=BigInt(b),delta=av-bv;
 return {delta:String(delta),change:bv===0n?(av===0n?'unchanged':'new'):String(delta*10000n/bv)};
}
