import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PgMappingReader } from '../../portals/app/app/domains/management/mapping-reader.ts';
import { mappingManagement } from '../../portals/app/app/domains/management/mapping-service.ts';
import { readPgGrant } from '../../portals/app/app/domains/access/pg-grants.ts';
export async function objectMappingCases(t, { db, adapterPool }) {
  const ws = randomUUID(), foreign = randomUUID();
  for (const w of [ws, foreign]) await db.query(`INSERT INTO bsmoss_resource.station VALUES($1,'st','Mapping station','tower','610000','610100');`, [w]);
  for (const w of [ws, foreign]) await db.query("INSERT INTO bsmoss_integration.source VALUES($1,'src','Fixture source','fixture')", [w]);
  await db.query("INSERT INTO bsmoss_integration.source VALUES($1,'outside','Other source','fixture')", [ws]);
  await db.query("INSERT INTO bsmoss_resource.station VALUES($1,'outside','Other station','tower','610000','610100')", [ws]);
  await db.query("INSERT INTO bsmoss_resource.operator_entity VALUES($1,'op','mobile','Fixture operator')", [ws]);
  for (const id of ['svc', 'outside']) await db.query("INSERT INTO bsmoss_resource.station_service VALUES($1,$2,'st','op','2026-01-01Z','2027-01-01Z')", [ws, id]);
  for (const id of ['dev', 'outside']) await db.query("INSERT INTO bsmoss_resource.device VALUES($1,$2,'st','meter','tower')", [ws, id]);
  await db.query("INSERT INTO bsmoss_resource.network_object VALUES($1,'cell','st','svc','cell')", [ws]);
  const scope = { workspaceId: ws, sourceIds: ['src'], stationIds: ['st'], serviceIds: ['svc'], deviceIds: [], metricKeys: [], allowSiteParameters: false };
  const reader = new PgMappingReader(adapterPool, scope), q = { search: '', kind: 'all', limit: 50 };
  async function mapping(id, patch = {}, workspace = ws) {
    const r = { workspace_id: workspace, id, source_id: 'src', external_type: 'cell', external_id: 'external-' + id, station_id: 'st', service_id: null, network_object_id: null, device_id: null, version: '1', valid_from: '2026-01-01T00:00:00.123456Z', valid_to: '2027-01-01T00:00:00.123456Z', ...patch };
    const keys = Object.keys(r); await db.query('INSERT INTO bsmoss_integration.source_mapping(' + keys.join(',') + ') VALUES(' + keys.map((_, i) => '$' + (i + 1)).join(',') + ')', Object.values(r));
  }
  await t.test('mapping permission seed grants no automatic role rights', async () => {
    const r = await db.query("SELECT p.id FROM local_authz.permission p WHERE p.perm_code='admin.mappings.view' AND NOT EXISTS(SELECT 1 FROM local_authz.role_permission rp WHERE rp.permission_id=p.id)"); assert.equal(r.rowCount, 1);
  });
  await t.test('mapping list and detail filter source station service device and physical permission before LIMIT', async () => {
    await mapping('A', { service_id: 'outside' }); await mapping('B'); await mapping('C', { device_id: 'outside' });
    await mapping('D', { service_id: 'svc', network_object_id: 'cell', version: '9007199254740993' }); await mapping('E', { service_id: 'svc' });
    await mapping('F', { service_id: 'svc', device_id: 'dev' }); await mapping('G', { service_id: 'svc', device_id: 'outside' });
    await mapping('H', { source_id: 'outside', service_id: 'svc' }); await mapping('I', { station_id: 'outside' }); await mapping('foreign', {}, foreign);
    const first = await reader.list({ ...q, limit: 1 }); assert.deepEqual(first.items.map(r => r.id), ['D']); assert.equal(first.next, 'D');
    const second = await reader.list({ ...q, limit: 1, after: first.next }); assert.deepEqual(second.items.map(r => r.id), ['E']); assert.equal(second.next, null);
    for (const id of ['A', 'B', 'C', 'F', 'G', 'H', 'I', 'foreign', 'missing']) assert.equal(await reader.read(id), null);
    const wider = new PgMappingReader(adapterPool, { ...scope, deviceIds: ['dev'], allowSiteParameters: true }); assert.deepEqual((await wider.list(q)).items.map(r => r.id), ['B', 'D', 'E', 'F']);
    const noService = new PgMappingReader(adapterPool, { ...scope, serviceIds: [], deviceIds: ['dev'] }); assert.equal((await noService.list(q)).items.length, 0);
  });
  await t.test('mapping kind literal search microsecond periods and service coverage use actual stored definitions', async () => {
    const m = await reader.read('D'); assert.equal(m.kind, 'network'); assert.equal(m.version, '9007199254740993'); assert.equal(m.validFrom, '2026-01-01T00:00:00.123456Z'); assert.equal(m.serviceCoversMapping, false); assert.equal(m.networkKind, 'cell');
    assert.deepEqual((await reader.list({ ...q, kind: 'service' })).items.map(r => r.id), ['E']);
    assert.deepEqual((await reader.list({ ...q, search: 'cell' })).items.map(r => r.id), ['D', 'E']);
    assert.equal((await reader.list({ ...q, search: '%' })).items.length, 0);
    assert.ok(!Object.hasOwn(m, 'protocol')); assert.ok(!Object.hasOwn(m, 'transformVersion'));
    await mapping('J', { service_id: 'svc', valid_from: '2026-02-01Z', valid_to: '2026-03-01Z' }); assert.equal((await reader.read('J')).serviceCoversMapping, true);
    await mapping('K', { external_id: 'external-J', version: '2', service_id: 'svc', valid_from: '2026-03-01Z', valid_to: '2026-04-01Z' });
    assert.deepEqual((await reader.list({ ...q, search: 'external-J' })).items.map(r => r.id), ['J', 'K']);
  });
  await t.test('mapping reader uses a repeatable read only snapshot and releases after SQL failure', async () => {
    let began = false, rolled = false, released = false;
    const pool = { connect: async () => { const c = await adapterPool.connect(); return { query: async (sql, args) => { if (sql === 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY') began = true; if (sql.startsWith('SELECT m.workspace_id')) throw Error('fixture_mapping_sql'); if (sql === 'ROLLBACK') rolled = true; return c.query(sql, args); }, release: () => { released = true; c.release(); } }; } };
    await assert.rejects(new PgMappingReader(pool, scope).list(q), /fixture_mapping_sql/); assert.ok(began && rolled && released);
    const c = await adapterPool.connect(); try { await assert.rejects(c.query("UPDATE bsmoss_integration.source_mapping SET external_type='changed' WHERE workspace_id=$1", [ws]), e => e.code === '42501'); } finally { c.release(); }
  });
  await t.test('real mapping permission revocation after a read denies list and missing detail', async () => {
    const member = randomUUID(), role = (await db.query("INSERT INTO local_authz.role(role_code,name) VALUES($1,'Mapping reader') RETURNING id", ['mapping-' + ws])).rows[0].id;
    await db.query("INSERT INTO local_authz.member(id,workspace_id,sub,status) VALUES($1,$2,'mapping-reader','active')", [member, ws]);
    await db.query("INSERT INTO local_authz.data_scope(workspace_id,member_id,scope,expires_at) VALUES($1,$2,$3,'2099-01-01Z')", [ws, member, scope]);
    await db.query('INSERT INTO local_authz.member_role(member_id,role_id) VALUES($1,$2)', [member, role]);
    const ports = { now: Date.now, readVerifiedIdentity: async () => ({ sub: 'mapping-reader', activeWorkspace: ws, accountStatus: 'active', governanceRoles: [], expiresAt: Date.now() + 60000 }), readCoverage: async () => ({ workspaceId: ws, product: 'bsmoss', tier: 'test', bundled: false, expiresAt: Date.now() + 60000 }), readLocalGrant: s => readPgGrant(adapterPool, s.workspaceId, s.sub), featuresFor: () => ['metering'] };
    for (const missing of [false, true]) {
      await db.query("INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT $1,id FROM local_authz.permission WHERE perm_code='admin.mappings.view'", [role]);
      const revoke = () => db.query('DELETE FROM local_authz.role_permission WHERE role_id=$1', [role]);
      const service = mappingManagement(ports, { create: s => { const r = new PgMappingReader(adapterPool, s); return { workspaceId: ws, list: async q => { const result = await r.list(q); await revoke(); return result; }, read: async id => { const result = await r.read(id); await revoke(); return result; } }; } });
      await assert.rejects(missing ? service.read('missing', new URLSearchParams()) : service.list(new URLSearchParams()), /permission_denied/);
    }
  });
  await t.test('malformed authorized mapping lookahead rejects the whole page', async () => {
    await mapping('Z', { external_type: '', service_id: 'svc' }); await assert.rejects(reader.read('Z'), /invalid_mapping_record/);
    await assert.rejects(reader.list({ ...q, after: 'J', limit: 1 }), /invalid_mapping_record/);
  });
}
