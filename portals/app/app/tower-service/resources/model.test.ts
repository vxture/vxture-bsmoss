import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resourceQueryModel,resourceSnapshot} from './model';
import {resourceSliceHref} from '../links';
test('resource query pins the sole real demo inventory and does not fabricate sync or history',()=>{
 const all=resourceQueryModel({});assert.equal(all.snapshots.length,1);assert.equal(all.snapshot.businessPeriod,null);assert.equal(all.snapshot.syncedAt,null);
 assert.equal(all.data.rollup.totals.infrastructure,5400);assert.equal(all.data.rollup.totals.sites,1080);
 assert.equal(all.snapshot.stockAsOf,all.data.rollup.source.observedAt);
 const city=resourceQueryModel({city:'610100',operator:'other'});assert.ok(city.data.rollup.totals.sites<240);assert.ok(city.data.rows.every(r=>r.city==='610100'&&r.allOperators.includes('other')));
 assert.equal(city.data.rollup.totals.infrastructure,city.data.rollup.totals.sites*5);
 const local=resourceQueryModel({search:'SX-DEMO-001',pageSize:'10'});assert.equal(local.data.rows.length,1);assert.deepEqual(local.data.rollup,all.data.rollup);
 const page2=resourceQueryModel({page:'2',pageSize:'10'});assert.deepEqual(page2.data.evidence.map(r=>r.siteId),page2.data.rows.slice(10,20).map(r=>r.id));
 for(const input of [{snapshotId:'unknown'},{snapshotId:[resourceSnapshot.id,resourceSnapshot.id]},{compareSnapshotId:resourceSnapshot.id},{compareSnapshotId:'missing'},{businessPeriod:'2026-09'},{asOf:'2026-09-25'},{period:'month'},{workspaceId:'forged'}])assert.throws(()=>resourceQueryModel(input),/invalid_/);
});
test('crossing from legacy copies only supported scope, never invents a snapshot from a date',()=>{
 const url=new URL(resourceSliceHref('/customer-use?city=610100&county=all&operator=other&period=month&asOf=2026-09-01&section=legacy&compare=previous&search=demo'),'http://local');
 assert.equal(url.pathname,'/tower-service/resources');assert.equal(url.searchParams.get('operator'),'other');assert.equal(url.searchParams.get('search'),'demo');
 for(const key of ['period','asOf','section','compare','snapshotId'])assert.equal(url.searchParams.has(key),false);
});
