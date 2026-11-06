import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PgSourceReader } from '../../portals/app/app/domains/management/source-reader.ts';
import { PgSourcePreflightReader } from '../../portals/app/app/domains/management/source-preflight-reader.ts';
import { sourcePreflight } from '../../portals/app/app/domains/management/source-preflight-service.ts';
import { sourceProposal } from '../../portals/app/app/domains/management/source-preflight-rules.ts';
import { sourceBinding } from '../../portals/app/app/domains/integration/rules.ts';
import { fingerprintOf } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { readPgGrant } from '../../portals/app/app/domains/access/pg-grants.ts';
export async function sourcePreflightCases(t, { db, adapterPool }) {
  const ws = randomUUID(), foreign = randomUUID(), metric = 'service.data.uplink_bytes@1';
  const scope = { workspaceId: ws, sourceIds: ['src'], stationIds: ['A', 'B', 'missing'], serviceIds: ['sa', 'sb', 'hidden-parent', 'missing'], deviceIds: ['da', 'db', 'hidden-parent', 'missing'], metricKeys: [metric, 'unknown.metric@1'], allowSiteParameters: true };
  const bindingScope = { ...scope, stationIds: ['A'], serviceIds: ['sa'], deviceIds: ['da'], metricKeys: [metric], allowSiteParameters: false };
  for (const w of [ws, foreign]) {
    await db.query("INSERT INTO bsmoss_integration.source VALUES($1,'src','Fixture source','fixture')", [w]);
    for (const st of ['A', 'B', 'outside']) await db.query("INSERT INTO bsmoss_resource.station VALUES($1,$2,$2,'tower','610000','610100')", [w, st]);
    await db.query("INSERT INTO bsmoss_resource.operator_entity VALUES($1,'op','mobile','Fixture operator')", [w]);
    for (const [id, st] of [['sa', 'A'], ['sb', 'B'], ['hidden-parent', 'outside']]) await db.query("INSERT INTO bsmoss_resource.station_service VALUES($1,$2,$3,'op','2026-01-01Z','2027-01-01Z')", [w, id, st]);
    for (const [id, st] of [['da', 'A'], ['db', 'B'], ['hidden-parent', 'outside']]) await db.query("INSERT INTO bsmoss_resource.device VALUES($1,$2,$3,'meter','tower')", [w, id, st]);
  }
  async function register(id, revision = '1', patch = {}, workspaceId = ws, digest) {
    const b = sourceBinding({ id, revision, sourceId: 'src', adapterVersion: 'a1', transformVersion: 't1', coverageStart: '2026-01-01T00:00:00.000Z', scope: { ...bindingScope, workspaceId }, ...patch });
    await db.query(`INSERT INTO bsmoss_integration.source_binding_revision(workspace_id,id,revision,source_id,status,binding,binding_sha256,review_ref)
      VALUES($1,$2,$3,'src','active',$4,$5,'fixture:review')`, [workspaceId, id, revision, b, digest ?? fingerprintOf(b)]);
  }
  await register('binding'); await register('foreign', '1', {}, foreign);
  await register('hidden', '1', { scope: { ...bindingScope, stationIds: ['outside'] } });
  const source = new PgSourceReader(adapterPool, scope), reader = new PgSourcePreflightReader(adapterPool, scope);
  async function draft() {
    const r = await source.read('binding');
    return sourceProposal({ expected: { revision: r.revision, digest: r.digest }, proposed: { revision: (BigInt(r.revision) + 1n).toString(), status: 'paused', adapterVersion: r.adapterVersion, transformVersion: r.transformVersion, coverageStart: r.binding.coverageStart,
      scope: { stationIds: [...r.binding.scope.stationIds], serviceIds: [...r.binding.scope.serviceIds], deviceIds: [...r.binding.scope.deviceIds], metricKeys: [...r.binding.scope.metricKeys], allowSiteParameters: r.binding.scope.allowSiteParameters } }, basis: { reference: 'fixture:not-an-approval', sha256: 'a'.repeat(64) } });
  }
  await t.test('source preflight permission seed is independent and grants no role assignments', async () => {
    assert.equal((await db.query("SELECT p.id FROM local_authz.permission p WHERE p.perm_code='admin.sources.preflight' AND NOT EXISTS(SELECT 1 FROM local_authz.role_permission rp WHERE rp.permission_id=p.id)")).rowCount, 1);
  });
  await t.test('source preflight reads actual references and changes neither registration evidence positions nor tasks', async () => {
    const counts = async () => (await db.query(`SELECT (SELECT count(*) FROM bsmoss_integration.source_binding_revision) revisions,
      (SELECT count(*) FROM bsmoss_integration.source_intake_receipt) receipts,(SELECT count(*) FROM bsmoss_integration.source_intake_task) tasks,
      (SELECT count(*) FROM bsmoss_integration.source_intake_task_event) events,(SELECT count(*) FROM bsmoss_metering.input_change) inputs`)).rows[0];
    const before = await counts(), p = await draft();
    p.proposed.scope = { stationIds: ['B'], serviceIds: ['sb'], deviceIds: ['db'], metricKeys: [metric], allowSiteParameters: true };
    const result = await reader.preview('binding', p);
    assert.equal(result.assessment, 'needs_review'); assert.equal(result.checks.resourceReferences, 'resolved'); assert.deepEqual(result.resourceIssues, []);
    assert.deepEqual(result.scopeChanges.find(c => c.dimension === 'stationIds'), { dimension: 'stationIds', added: ['B'], removed: ['A'] });
    assert.notEqual(result.proposed.digest, result.before.digest); assert.equal(result.intake.oldPositionReuse, 'requires_reviewed_rebaseline');
    assert.deepEqual(await counts(), before);
  });
  await t.test('source preflight flags missing resources unknown metric and associations outside proposed stations without leaking parent IDs', async () => {
    const p = await draft(); p.proposed.scope = { stationIds: ['A', 'missing'], serviceIds: ['sb', 'hidden-parent', 'missing'], deviceIds: ['db', 'hidden-parent', 'missing'], metricKeys: [metric, 'unknown.metric@1'], allowSiteParameters: false };
    const r = await reader.preview('binding', p); assert.equal(r.assessment, 'blocked');
    assert.deepEqual(r.resourceIssues, [{ dimension: 'stationIds', id: 'missing' }, ...['hidden-parent', 'missing', 'sb'].map(id => ({ dimension: 'serviceIds', id })), ...['db', 'hidden-parent', 'missing'].map(id => ({ dimension: 'deviceIds', id })), { dimension: 'metricKeys', id: 'unknown.metric@1' }]);
    assert.ok(!JSON.stringify(r).includes('outside')); assert.equal(r.checks.sourceCapabilities, 'not_assessed');
  });
  await t.test('source preflight rejects original or proposed unauthorized scopes before any resource lookup', async () => {
    const p = await draft();
    for (const id of ['foreign', 'hidden', 'missing']) assert.equal(await reader.preview(id, p), null);
    let references = 0;
    const pool = { connect: async () => { const c = await adapterPool.connect(); return { query: async (sql, args) => { if (sql.startsWith('SELECT id FROM') || sql.startsWith('SELECT code')) references++; return c.query(sql, args); }, release: () => c.release() }; } };
    for (const dim of ['stationIds', 'serviceIds', 'deviceIds', 'metricKeys']) {
      const proposed = structuredClone(p); proposed.proposed.scope[dim] = ['outside'];
      await assert.rejects(new PgSourcePreflightReader(pool, scope).preview('binding', proposed), /permission_denied/);
    }
    assert.equal(references, 0);
    await assert.rejects(new PgSourcePreflightReader(adapterPool, { ...scope, allowSiteParameters: false }).preview('binding', { ...p, proposed: { ...p.proposed, scope: { ...p.proposed.scope, allowSiteParameters: true } } }), /permission_denied/);
  });
  await t.test('source preflight uses one read only snapshot for baseline and resources even during concurrent registration', async () => {
    const p = await draft(); let changed = false, began = false;
    const pool = { connect: async () => { const c = await adapterPool.connect(); return { query: async (sql, args) => { if (sql === 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY') began = true; const rows = await c.query(sql, args); if (!changed && sql.startsWith('SELECT b.*')) { changed = true; await register('binding', '2', { adapterVersion: 'a2' }); } return rows; }, release: () => c.release() }; } };
    const r = await new PgSourcePreflightReader(pool, scope).preview('binding', p); assert.ok(began); assert.equal(r.before.revision, '1'); assert.equal(r.before.adapterVersion, 'a1');
    await assert.rejects(reader.preview('binding', p), /source_context_changed/);
    const bad = await draft(); bad.expected.digest = 'f'.repeat(64); await assert.rejects(reader.preview('binding', bad), /source_context_changed/);
  });
  await t.test('source preflight SQL failure rolls back releases and corrupted registration is never previewed', async () => {
    let rolled = false, released = false;
    const pool = { connect: async () => { const c = await adapterPool.connect(); return { query: async (sql, args) => { if (sql.startsWith('SELECT id FROM')) throw Error('fixture_source_preflight_sql'); if (sql === 'ROLLBACK') rolled = true; return c.query(sql, args); }, release: () => { released = true; c.release(); } }; } };
    await assert.rejects(new PgSourcePreflightReader(pool, scope).preview('binding', await draft()), /fixture_source_preflight_sql/); assert.ok(rolled && released);
    await register('corrupt', '1', {}, ws, '0'.repeat(64)); await assert.rejects(reader.preview('corrupt', await draft()), /invalid_source_registration/);
  });
  await t.test('real source preflight permission revocation suppresses successful missing and stale responses', async () => {
    const member = randomUUID(), role = (await db.query("INSERT INTO local_authz.role(role_code,name) VALUES($1,'Source preflight') RETURNING id", ['source-preflight-' + ws])).rows[0].id;
    await db.query("INSERT INTO local_authz.member(id,workspace_id,sub,status) VALUES($1,$2,'source-preflight','active')", [member, ws]);
    await db.query("INSERT INTO local_authz.data_scope(workspace_id,member_id,scope,expires_at) VALUES($1,$2,$3,'2099-01-01Z')", [ws, member, scope]); await db.query('INSERT INTO local_authz.member_role(member_id,role_id) VALUES($1,$2)', [member, role]);
    const ports = { now: Date.now, readVerifiedIdentity: async () => ({ sub: 'source-preflight', activeWorkspace: ws, accountStatus: 'active', governanceRoles: [], expiresAt: Date.now() + 60000 }), readCoverage: async () => ({ workspaceId: ws, product: 'bsmoss', tier: 'test', bundled: false, expiresAt: Date.now() + 60000 }), readLocalGrant: s => readPgGrant(adapterPool, s.workspaceId, s.sub), featuresFor: () => ['metering'] };
    for (const mode of ['success', 'missing', 'stale']) {
      await db.query("INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT $1,id FROM local_authz.permission WHERE perm_code='admin.sources.preflight'", [role]);
      const p = await draft(); if (mode === 'stale') p.expected.revision = '999';
      const service = sourcePreflight(ports, { create: s => ({ workspaceId: ws, preview: async (id, p) => { try { return await new PgSourcePreflightReader(adapterPool, s).preview(id, p); } finally { await db.query('DELETE FROM local_authz.role_permission WHERE role_id=$1', [role]); } } }) });
      await assert.rejects(service.preview(mode === 'missing' ? 'missing' : 'binding', p), /permission_denied/);
    }
  });
}
