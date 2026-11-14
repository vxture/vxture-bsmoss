import {test} from 'node:test';
import assert from 'node:assert/strict';
import {occupancyAnalysis,type OccupancyEndpoint} from './occupancy-analysis';
import {scopeTenancy,type MonthlyTenant,type TenantMonthSnapshot} from './tenancy';
const tenant=(customerId:string,operator='mobile'):MonthlyTenant=>({customerId,operator,from:'2025-01-01T00:00:00+08:00',to:'2027-01-01T00:00:00+08:00',anchor:'unknown',evidence:['captured']});
function endpoint(month:string,sites:{siteId:string;complete:boolean;tenants:MonthlyTenant[]}[]):OccupancyEndpoint{return {scopeKey:'province/all',siteIds:sites.map(r=>r.siteId),snapshot:{id:month,month,revision:1,supersedesId:null,sourceVersion:'v1',asOf:month+'-'+(month.endsWith('09')?'30':'31')+'T23:59:59+08:00',sites}};}
const site=(siteId:string,tenants:MonthlyTenant[])=>({siteId,complete:true,tenants});
test('deduplicated endpoint sets reconcile customer totals and site-lifecycle contributions',()=>{
 const before=endpoint('2026-09',[site('a',[tenant('m'),tenant('m'),tenant('t','telecom')]),site('old',[tenant('old','other')])]);
 const now=endpoint('2026-10',[site('a',[tenant('m'),tenant('new','other')]),site('new',[tenant('t','telecom')])]);
 const a=occupancyAnalysis(now,before,['mobile','telecom','other']);assert.equal(a.current,3);assert.equal(a.baseline,3);assert.equal(a.added,2);assert.equal(a.removed,2);assert.equal(a.net,0);
 assert.equal(a.addedExisting,1);assert.equal(a.addedNewSites,1);assert.equal(a.removedExisting,1);assert.equal(a.removedRetiredSites,1);
 for(const key of ['current','baseline','added','removed','net','addedExisting','addedNewSites','removedExisting','removedRetiredSites'] as const)assert.equal(a.customers.reduce((n,c)=>n+c[key]!,0),a[key]);
 assert.equal(a.net,a.current!-a.baseline!);assert.equal(a.added,a.addedExisting!+a.addedNewSites!);assert.equal(a.removed,a.removedExisting!+a.removedRetiredSites!);
});
test('confirmed vacancy is zero; missing or partial evidence is unknown',()=>{
 const now=endpoint('2026-10',[site('a',[])]),before=endpoint('2026-09',[site('a',[])]);const zero=occupancyAnalysis(now,before,['mobile']);assert.equal(zero.current,0);assert.equal(zero.net,0);
 for(const prior of [{...before,snapshot:null},{...before,siteIds:['missing']},{...before,snapshot:{...before.snapshot!,sites:[{...before.snapshot!.sites[0],complete:false}]}}]){const a=occupancyAnalysis(now,prior,['mobile']);assert.equal(a.current,0);assert.equal(a.baseline,null);assert.equal(a.added,null);assert.equal(a.removed,null);assert.equal(a.reason,'baseline_missing');}
});
test('scope, source version, revisions and changed customer ownership never become business changes',()=>{
 const now=endpoint('2026-10',[site('a',[tenant('m')])]),before=endpoint('2026-09',[site('a',[tenant('m')])]);
 for(const [prior,reason] of [[{...before,scopeKey:'another'},'scope_changed'],[{...before,snapshot:{...before.snapshot!,sourceVersion:'v2'}},'basis_changed'],[{...before,snapshot:{...before.snapshot!,month:'2026-10'}},'revision'],[endpoint('2026-09',[site('a',[tenant('m','telecom')])]),'customer_changed']] as const){const a=occupancyAnalysis(now,prior,['mobile','telecom']);assert.equal(a.reason,reason);assert.equal(a.net,null);assert.equal(a.added,null);}
});
test('validity is half-open and a brand change across different sites requires confirmation',()=>{
 const before=endpoint('2026-09',[site('a',[tenant('m')])]),now=endpoint('2026-10',[site('a',[{...tenant('expired'),to:'2026-10-31T23:59:59+08:00'},{...tenant('future'),from:'2026-11-01T00:00:00+08:00'}])]);
 const a=occupancyAnalysis(now,before,['mobile']);assert.equal(a.current,0);assert.equal(a.removed,1);assert.equal(a.net,-1);
 assert.equal(occupancyAnalysis(endpoint('2026-10',[site('b',[tenant('m','telecom')])]),before,['mobile','telecom']).reason,'customer_changed');
});
test('restricted tenancy never reveals excluded customers or claims complete regional changes',()=>{
 const raw=endpoint('2026-10',[site('a',[tenant('m'),tenant('t','telecom')])]);
 const capture=scopeTenancy({refs:[{month:'2026-10',snapshotId:'2026-10'}],snapshots:[raw.snapshot!]},new Set(['a']),['mobile'])!;
 const a=occupancyAnalysis({...raw,snapshot:capture.snapshots[0]},endpoint('2026-09',[site('a',[tenant('m')])]),['mobile']);assert.equal(a.current,null);assert.equal(a.net,null);assert.deepEqual(a.customers.map(c=>c.operator),['mobile']);
});
