import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portalNavigation} from './navigation';
import {towerMigration,towerTargets,migrationLabel} from './tower-migration';
test('every existing navigation destination has a migration disposition without routing changes',()=>{
 for(const entry of [...portalNavigation(true),...portalNavigation(true,'management')]){assert.ok(towerMigration[entry.id]);assert.ok(migrationLabel(entry.id));for(const target of towerMigration[entry.id].targets)assert.ok(towerTargets.some(t=>t.id===target));assert.ok(!entry.href.startsWith('/tower-service/'));}
 assert.equal(towerMigration.capacity.state,'legacy');assert.equal(towerMigration.monitoring.state,'legacy');assert.equal(towerTargets.length,8);
 assert.deepEqual(towerTargets.filter(t=>t.available).map(t=>t.path),['/tower-service/overview','/product-preview','/tower-service/resources','/tower-service/services','/tower-service/evidence','/tower-service/judgment','/tower-service/sync','/tower-service/rules']);
});
