import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PgSourceReader } from '../../portals/app/app/domains/management/source-reader.ts';
import { PgSourcePreflightReader } from '../../portals/app/app/domains/management/source-preflight-reader.ts';
import { sourcePreflight } from '../../portals/app/app/domains/management/source-preflight-service.ts';
import { sourceIntakeTasks } from '../../portals/app/app/domains/integration/pg-intake-tasks.ts';
import { sourceIntake } from '../../portals/app/app/domains/integration/pg-intake.ts';
import { sourceBinding } from '../../portals/app/app/domains/integration/rules.ts';
import { fingerprintOf } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { readPgGrant } from '../../portals/app/app/domains/access/pg-grants.ts';

export async function sourceIntakeImpactCases(t, { db, adapterPool }) {
  const ws = randomUUID(), foreign = randomUUID();
  const scope = { workspaceId: ws, sourceIds: ['src'], stationIds: ['A', 'outside'], serviceIds: [], deviceIds: [], metricKeys: ['service.data.uplink_bytes@1'], allowSiteParameters: false };
  for (const w of [ws, foreign]) {
    await db.query("INSERT INTO bsmoss_integration.source VALUES($1,'src','Impact fixture','fixture')", [w]);
    for (const id of ['A', 'outside']) await db.query("INSERT INTO bsmoss_resource.station VALUES($1,$2,$2,'tower','610000','610100')", [w, id]);
  }
  async function register(id, revision = '1', stations = ['A'], workspaceId = ws) {
    const b = sourceBinding({ id, revision, sourceId: 'src', adapterVersion: 'fixture', transformVersion: '1', coverageStart: '2026-01-01T00:00:00.000Z', scope: { ...scope, workspaceId, stationIds: stations } });
    await db.query(`INSERT INTO bsmoss_integration.source_binding_revision(workspace_id,id,revision,source_id,status,binding,binding_sha256,review_ref)
      VALUES($1,$2,$3,'src','active',$4,$5,'fixture:impact')`, [workspaceId, id, revision, b, fingerprintOf(b)]);
  }
  const ports = (w = ws) => ({ readVerifiedIdentity: async () => ({ sub: 'fixture', activeWorkspace: w, accountStatus: 'active', governanceRoles: [], expiresAt: Date.now() + 60000 }), readCoverage: async () => ({ workspaceId: w, product: 'bsmoss', tier: 'test', bundled: false, expiresAt: Date.now() + 60000 }), readLocalGrant: async () => ({ workspaceId: w, sub: 'fixture', active: true, permissions: ['metering.ingest'], scope: { ...scope, workspaceId: w }, expiresAt: Date.now() + 60000 }), featuresFor: () => ['metering'] });
  let revision = 1;
  const connector = {
    head: async () => ({ sourceId: 'src', snapshotId: 'snapshot-' + revision, dataRevision: 'r' + revision, availableThrough: new Date(Date.parse('2026-01-01T00:00:00Z') + revision * 3600000).toISOString(), changeCursor: 'cursor-' + revision, completionClaim: null }),
    page: async ({ plan, after }) => ({ planId: plan.id, snapshotId: plan.snapshotId, after, items: [], next: null })
  };
  const source = new PgSourceReader(adapterPool, scope), reader = new PgSourcePreflightReader(adapterPool, scope);
  async function proposal(id = 'impact') {
    const r = await source.read(id);
    const { sourceIds: _sources, workspaceId: _w, ...s } = r.binding.scope;
    return { expected: { revision: r.revision, digest: r.digest }, proposed: { revision: String(BigInt(r.revision) + 1n), status: 'paused', adapterVersion: r.adapterVersion, transformVersion: r.transformVersion, coverageStart: r.binding.coverageStart, scope: s }, basis: { reference: 'fixture:not-approval', sha256: 'a'.repeat(64) } };
  }
  const wrap = hook => ({ connect: async () => { const c = await adapterPool.connect(); return { query: async (sql, args) => { const result = await c.query(sql, args); await hook(sql, args, result); return result; }, release: () => c.release() }; } });
  const counts = async () => (await db.query(`SELECT
    (SELECT count(*) FROM bsmoss_integration.source_intake_receipt) receipts,
    (SELECT count(*) FROM bsmoss_integration.source_intake_task) tasks,
    (SELECT count(*) FROM bsmoss_integration.source_intake_task_event) events,
    (SELECT count(*) FROM bsmoss_integration.source_binding_revision) bindings,
    (SELECT count(*) FROM bsmoss_metering.input_change) inputs`)).rows[0];
  await t.test('intake impact permission is independently seeded without role grants', async () => {
    assert.equal((await db.query("SELECT id FROM local_authz.permission p WHERE perm_code='admin.sources.intake_impact.view' AND NOT EXISTS(SELECT 1 FROM local_authz.role_permission rp WHERE rp.permission_id=p.id)")).rowCount, 1);
    await register('impact'); await register('impact', '1', ['A'], foreign);
    for (revision = 1; revision <= 21; revision++) await sourceIntakeTasks(adapterPool, ports(), connector).run({ bindingId: 'impact', commandId: 'impact-' + revision });
    await sourceIntake(adapterPool, ports(foreign), connector).receive('impact');
    const failed = await sourceIntakeTasks(adapterPool, ports(), { ...connector, head: async () => { throw Error('fixture'); } }).run({ bindingId: 'impact', commandId: 'impact-failed' });
    assert.equal(failed.latest.state, 'failed');
  });
  await t.test('intake impact validates actual current revision receipts and task history with bounded lookahead and no writes', async () => {
    const before = await counts(), r = await reader.preview('impact', await proposal(), scope), e = r.intake.evidence;
    assert.equal(e.status, 'current_revision_assessed'); assert.equal(e.bindingRevision, '1');
    assert.equal(e.receipts.items.length, 20); assert.equal(e.receipts.hasMore, true); assert.equal(e.receipts.items[0].sequence, '21'); assert.equal(e.receipts.items[0].inserted, 0);
    assert.equal(e.tasks.items.length, 20); assert.equal(e.tasks.hasMore, true); assert.equal(e.tasks.items[0].state, 'failed'); assert.equal(e.tasks.items[0].revision, '2');
    assert.equal(e.earlierRevisions, 'not_assessed'); assert.equal(e.latestPosition, 'not_assessed'); assert.equal(r.downstream.reports, 'not_assessed');
    assert.doesNotMatch(JSON.stringify(e), /manifest|cursor|actor|requestedBy|failureCode|databaseActor/); assert.deepEqual(await counts(), before);
    const localIds = (await db.query('SELECT id FROM bsmoss_integration.source_intake_receipt WHERE workspace_id=$1', [ws])).rows.map(r => r.id);
    assert.ok(e.receipts.items.every(r => localIds.includes(r.id)));
  });
  await t.test('intake impact does not query evidence without independent complete original scope', async () => {
    let queries = 0;
    const guarded = wrap(async sql => { if (sql.includes('source_intake_receipt') || sql.includes('source_intake_task')) queries++; });
    for (const allowed of [undefined, { ...scope, stationIds: [] }, { ...scope, metricKeys: [] }]) {
      const r = await new PgSourcePreflightReader(guarded, scope).preview('impact', await proposal(), allowed);
      assert.deepEqual(r.intake.evidence, { status: 'not_authorized' }); assert.equal(r.intake.existingTasks, 'not_assessed');
    }
    assert.equal(queries, 0);
  });
  await t.test('intake impact refuses a corrupted receipt lookahead rather than returning a partial success', async () => {
    const broken = wrap(async (sql, _args, result) => { if (sql.includes('FROM bsmoss_integration.source_intake_receipt r')) { assert.equal(result.rows.length, 21); result.rows[20].manifest_sha256 = '0'.repeat(64); } });
    await assert.rejects(new PgSourcePreflightReader(broken, scope).preview('impact', await proposal(), scope), /invalid_intake_receipt/);
  });
  await t.test('intake impact validates task binding evidence and even the undisplayed task history', async () => {
    const brokenBinding = wrap(async (sql, _args, result) => { if (sql.startsWith('SELECT t.*')) result.rows[0].binding_sha256 = '0'.repeat(64); });
    await assert.rejects(new PgSourcePreflightReader(brokenBinding, scope).preview('impact', await proposal(), scope), /invalid_intake_task_evidence/);
    let histories = 0;
    const brokenHistory = wrap(async (sql, _args, result) => { if (sql.includes('SELECT *,lease_until')) { histories++; if (histories === 21) result.rows = []; } });
    await assert.rejects(new PgSourcePreflightReader(brokenHistory, scope).preview('impact', await proposal(), scope), /invalid_intake_task_evidence/); assert.equal(histories, 21);
  });
  await t.test('intake impact shares the baseline snapshot even when a task and receipt commit concurrently', async () => {
    await register('concurrent'); let changed = false;
    const concurrent = wrap(async sql => { if (!changed && sql.startsWith('SELECT b.*')) { changed = true; await sourceIntakeTasks(adapterPool, ports(), connector).run({ bindingId: 'concurrent', commandId: 'concurrent-task' }); } });
    const p = await proposal('concurrent'), r = await new PgSourcePreflightReader(concurrent, scope).preview('concurrent', p, scope);
    assert.equal(changed, true); assert.equal(r.intake.evidence.tasks.items.length, 0); assert.equal(r.intake.evidence.receipts.items.length, 0);
    const next = await reader.preview('concurrent', p, scope); assert.equal(next.intake.evidence.tasks.items.length, 1); assert.equal(next.intake.evidence.receipts.items.length, 1);
  });
  await t.test('intake impact reads no earlier revisions even when their scope is broader and their evidence exists', async () => {
    await register('narrowed', '1', ['outside']); await sourceIntake(adapterPool, ports(), connector).receive('narrowed'); await register('narrowed', '2');
    const narrow = { ...scope, stationIds: ['A'] }, p = await proposal('narrowed');
    const r = await new PgSourcePreflightReader(adapterPool, narrow).preview('narrowed', p, narrow);
    assert.equal(r.intake.evidence.status, 'current_revision_assessed'); assert.equal(r.intake.evidence.bindingRevision, '2');
    assert.deepEqual(r.intake.evidence.receipts, { items: [], hasMore: false }); assert.deepEqual(r.intake.evidence.tasks, { items: [], hasMore: false });
    assert.equal(r.intake.evidence.latestPosition, 'not_assessed');
  });
  await t.test('actual impact permission revoked after a successful missing stale or SQL failed preview suppresses the whole response', async () => {
    const member = randomUUID(), role = (await db.query("INSERT INTO local_authz.role(role_code,name) VALUES($1,'Impact fixture') RETURNING id", ['impact-' + ws])).rows[0].id;
    await db.query("INSERT INTO local_authz.member(id,workspace_id,sub,status) VALUES($1,$2,'fixture','active')", [member, ws]);
    await db.query("INSERT INTO local_authz.data_scope(workspace_id,member_id,scope,expires_at) VALUES($1,$2,$3,'2099-01-01Z')", [ws, member, scope]); await db.query('INSERT INTO local_authz.member_role(member_id,role_id) VALUES($1,$2)', [member, role]);
    await db.query("INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT $1,id FROM local_authz.permission WHERE perm_code='admin.sources.preflight'", [role]);
    const access = { ...ports(), readLocalGrant: s => readPgGrant(adapterPool, s.workspaceId, s.sub) };
    for (const mode of ['success', 'missing', 'stale', 'sql_failure']) {
      await db.query("INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT $1,id FROM local_authz.permission WHERE perm_code='admin.sources.intake_impact.view'", [role]);
      const service = sourcePreflight(access, { create: s => ({ workspaceId: ws, preview: async (id, p, impactScope) => { try { if (mode === 'sql_failure') throw Error(mode); return await new PgSourcePreflightReader(adapterPool, s).preview(id, p, impactScope); } finally { await db.query("DELETE FROM local_authz.role_permission WHERE role_id=$1 AND permission_id IN (SELECT id FROM local_authz.permission WHERE perm_code='admin.sources.intake_impact.view')", [role]); } } }) });
      const p = await proposal(); if (mode === 'stale') p.expected.revision = '999';
      await assert.rejects(service.preview(mode === 'missing' ? 'missing' : 'impact', p), /permission_denied/);
    }
  });
}
