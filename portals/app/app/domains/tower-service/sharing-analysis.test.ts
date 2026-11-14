import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sharingAnalysis} from './sharing-analysis';
import {scopeTenancy,type MonthlyTenant,type TenantMonthSnapshot} from './tenancy';
const t=(customerId:string,operator='mobile'):MonthlyTenant=>({customerId,operator,from:'2026-01-01T00:00:00+08:00',to:'2027-01-01T00:00:00+08:00',anchor:'unknown',evidence:['source']});
const source=():TenantMonthSnapshot=>({id:'oct',month:'2026-10',revision:1,supersedesId:null,sourceVersion:'source-v1',asOf:'2026-10-31T23:59:59+08:00',sites:[{siteId:'a',complete:true,tenants:[t('m'),t('m'),t('t','telecom')]},{siteId:'b',complete:true,tenants:[t('one','other'),t('two','other')]},{siteId:'c',complete:true,tenants:[]},{siteId:'d',complete:true,tenants:[t('m')]}]});
test('sharing counts concrete customers, reconciles structure and keeps operator overlaps',()=>{
 const a=sharingAnalysis(source(),['a','b','c','d'],['mobile','telecom','other']);assert.equal(a.occupied,3);assert.equal(a.shared,2);assert.equal(a.relationships,5);assert.equal(a.rateBps,6667);assert.equal(a.averageHundredths,167);assert.equal(a.buckets.reduce((n,b)=>n+b.count!,0),4);
 assert.deepEqual(a.customers[0],{id:'mobile',operator:'mobile',covered:2,shared:1,single:1,double:1,triple:0,quadruple:0,fivePlus:0,rateBps:5000});assert.equal(a.customers[2].covered,1);assert.equal(a.customers[2].shared,1);assert.equal(a.customers.reduce((n,c)=>n+c.covered!,0),4);
});
test('six structure buckets separate three/four and include five or more concrete customers',()=>{
 const s=source();s.sites=Array.from({length:7},(_,count)=>({siteId:String(count),complete:true,tenants:Array.from({length:count},(_,i)=>t('customer-'+i))}));
 const a=sharingAnalysis(s,s.sites.map(r=>r.siteId),['mobile']);
 assert.deepEqual(a.buckets,[{id:'vacant',count:1},{id:'single',count:1},{id:'double',count:1},{id:'triple',count:1},{id:'quadruple',count:1},{id:'fivePlus',count:2}]);
 assert.equal(a.buckets.reduce((n,b)=>n+b.count!,0),a.siteCount);const c=a.customers[0];assert.equal(c.covered,6);assert.equal(c.single!+c.double!+c.triple!+c.quadruple!+c.fivePlus!,c.covered);assert.equal(c.double!+c.triple!+c.quadruple!+c.fivePlus!,c.shared);
});
test('explicit vacancy is zero; missing, partial and restricted sources remain unknown',()=>{
 const empty=sharingAnalysis(source(),['c'],['mobile']);assert.equal(empty.occupied,0);assert.equal(empty.rateBps,null);assert.equal(empty.buckets[0].count,1);
 for(const a of [sharingAnalysis(null,['a'],['mobile']),sharingAnalysis(source(),['missing'],['mobile']),sharingAnalysis(scopeTenancy({snapshots:[source()],refs:[{month:'2026-10',snapshotId:'oct'}]},new Set(['a']),['mobile'])!.snapshots[0],['a'],['mobile'])]){assert.equal(a.shared,null);assert.equal(a.rateBps,null);assert.equal(a.customers[0].shared,null);assert.ok(a.buckets.every(b=>b.count===null));}
});
test('as-of validity and regional membership determine customer presence',()=>{const s=source();s.sites[0].tenants[1]={...t('expired'),to:s.asOf};s.sites[0].tenants[2]={...t('future','telecom'),from:'2026-11-01T00:00:00+08:00'};const a=sharingAnalysis(s,['a'],['mobile','telecom']);assert.equal(a.shared,0);assert.equal(a.customers[1].covered,0);assert.equal(a.relationships,1);});
