import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PgMappingReader } from '../../portals/app/app/domains/management/mapping-reader.ts';
import { PgMappingPreflightReader } from '../../portals/app/app/domains/management/preflight-reader.ts';
import { mappingPreflight } from '../../portals/app/app/domains/management/preflight-service.ts';
import { readMappingImpacts } from '../../portals/app/app/domains/management/mapping-impact-reader.ts';
import { mappingSubject } from '../../portals/app/app/domains/management/mapping-impact-rules.ts';
import { PgAggregateStore } from '../../portals/app/app/domains/aggregation/pg-store.ts';
import { PgStateAggregateStore } from '../../portals/app/app/domains/aggregation/pg-state-store.ts';
import { PgGaugeAggregateStore } from '../../portals/app/app/domains/aggregation/pg-gauge-store.ts';
import { aggregateIntervals, fingerprintOf } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { aggregateObjectRollup, atomKey } from '../../portals/app/app/domains/aggregation/object-rollup.ts';
import { bucketFor, nativeWindows } from '../../portals/app/app/domains/aggregation/periods.ts';
import { reportManifest } from '../../portals/app/app/domains/reports/rules.ts';
import { FIRST_METRICS } from '../../portals/app/app/domains/catalog/first-metrics.ts';
import { readPgGrant } from '../../portals/app/app/domains/access/pg-grants.ts';

export async function mappingImpactCases(t, { db, adapterPool }) {
  const ws = randomUUID(), foreign = randomUUID(), up = { code: 'service.data.uplink_bytes', version: 1 }, hash = 'a'.repeat(64);
  const scope = { workspaceId: ws, sourceIds: ['src'], stationIds: ['st'], serviceIds: ['svc'], deviceIds: ['dev'], metricKeys: FIRST_METRICS.list().map(m => m.code + '@' + m.version), allowSiteParameters: true };
  for (const w of [ws, foreign]) {
    await db.query("INSERT INTO bsmoss_integration.source VALUES($1,'src','Dependency fixture','fixture')", [w]);
    for (const id of ['st', 'outside']) await db.query("INSERT INTO bsmoss_resource.station VALUES($1,$2,$2,'tower','610000','610100')", [w, id]);
    await db.query("INSERT INTO bsmoss_resource.operator_entity VALUES($1,'op','mobile','Fixture operator')", [w]);
    await db.query("INSERT INTO bsmoss_resource.station_service VALUES($1,'svc','st','op','2026-01-01Z','2027-01-01Z')", [w]);
    await db.query("INSERT INTO bsmoss_resource.network_object VALUES($1,'cell','st','svc','cell')", [w]);
    await db.query("INSERT INTO bsmoss_resource.device VALUES($1,'dev','st','sensor','tower')", [w]);
    for (const id of ['map', 'peer']) await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
      VALUES($1,$2,'src','cell',$2,'st','svc','cell',1,'2026-01-01Z','2027-01-01Z')`, [w, id]);
    await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,device_id,version,valid_from,valid_to)
      VALUES($1,'device-map','src','device','dev','st','dev',1,'2026-01-01Z','2027-01-01Z')`, [w]);
  }
  const mappings = new PgMappingReader(adapterPool, scope), reader = new PgMappingPreflightReader(adapterPool, scope), map = await mappings.read('map');
  const day = i => bucketFor(new Date(Date.parse('2026-02-01T00:00:00+08:00') + i * 86400000).toISOString(), 'day');
  function plan(period, r = map, metric = up, workspaceId = ws) {
    return { workspaceId, sourceId: 'src', subjectKey: mappingSubject(r), metric, grain: 'day', nativeGrain: 'day', period, authorityVersion: hash,
      inputMode: 'direct', mappingWindows: [{ mappingId: r.id, mappingVersion: '1', period }], sourceComplete: false, watermark: period.start };
  }
  const definition = (code, grain = 'day', kind = 'aggregate') => ({ schema: 'periodic-report-template-v1', title: code, grain,
    panels: [{ id: 'usage', category: 'business_service', metricRef: up, view: 'card', grain, displayUnit: 'B', precision: 2, order: 0, visible: true }],
    bindings: [{ panelId: 'usage', kind, ...(kind === 'aggregate' ? { sourceId: 'src', mappingId: 'peer' } : { rollupId: 'fixture-rollup' }) }] });
  function publication(period, r = map, workspaceId = ws) {
    const result = aggregateIntervals(plan(period, r, up, workspaceId), []);
    return { seriesId: 'fixture-series', revision: '1', currentRevision: '1', publishedBy: 'fixture', createdAt: period.end, selection: 'current', freshness: 'current', currentInputFingerprint: result.inputFingerprint, reasons: [], result };
  }
  const data = (period, r = map, workspaceId = ws) => ({ kind: 'aggregate', query: { sourceId: 'src', mappingId: 'peer', metric: up, grain: 'day', at: period.start }, authorityVersion: hash, publication: publication(period, r, workspaceId) });
  async function report(code, period, input = data(period), requiredScope = scope, dailyDependencies = []) {
    const w = requiredScope.workspaceId, d = definition(code, input.kind === 'rollup' ? input.query.grain : input.query.grain, input.kind), id = randomUUID();
    await db.query("INSERT INTO bsmoss_views.template_version(workspace_id,code,version,template_kind,definition,published_by) VALUES($1,$2,1,'report',$3,'fixture') ON CONFLICT DO NOTHING", [w, code, d]);
    const m = reportManifest(w, code, 1, d, period.start, [{ panelId: 'usage', data: input, dailyDependencies, requiredScope }]);
    await db.query(`INSERT INTO bsmoss_analysis.report_series(workspace_id,id,template_code,template_version,grain,period_start,period_end)
      VALUES($1,$2,$3,1,$4,$5,$6)`, [w, id, code, m.grain, m.period.start, m.period.end]);
    await db.query("INSERT INTO bsmoss_analysis.report_revision(workspace_id,report_id,revision,manifest_sha256,manifest,generated_by) VALUES($1,$2,1,$3,$4,'fixture')", [w, id, fingerprintOf(m), m]);
    await db.query('UPDATE bsmoss_analysis.report_series SET current_revision=1 WHERE workspace_id=$1 AND id=$2', [w, id]);
    return { id, manifest: m };
  }
  const p = () => ({ expected: { version: map.version, validFrom: map.validFrom, validTo: map.validTo }, proposed: { version: '2', validFrom: map.validFrom, validTo: '2026-12-31T00:00:00.000000Z' }, basis: { reference: 'fixture:not-approval', sha256: hash } });
  const scopes = { aggregates: scope, reports: scope }, wrap = hook => ({ connect: async () => { const c = await adapterPool.connect(); return { query: async (sql, args) => { const result = await c.query(sql, args); await hook(sql, args, result); return result; }, release: () => c.release() }; } });
  const inspect = async (sc = scopes, pool = adapterPool) => new PgMappingPreflightReader(pool, scope).preview('map', p(), sc);
  const counts = async () => (await db.query(`SELECT (SELECT count(*) FROM bsmoss_analysis.aggregate_revision) aggregates,
    (SELECT count(*) FROM bsmoss_analysis.report_revision) reports,(SELECT count(*) FROM bsmoss_integration.authority_change) authority,
    (SELECT count(*) FROM bsmoss_metering.input_change) inputs,(SELECT count(*) FROM bsmoss_analysis.refresh_job) jobs`)).rows[0];
  await t.test('mapping dependency permissions are independently seeded without assigning roles', async () => {
    assert.equal((await db.query("SELECT id FROM local_authz.permission p WHERE perm_code IN ('admin.mappings.aggregate_impact.view','admin.mappings.report_impact.view') AND NOT EXISTS(SELECT 1 FROM local_authz.role_permission rp WHERE rp.permission_id=p.id)")).rowCount, 2);
    for (let i = 0; i < 21; i++) {
      const pl = plan(day(i)), store = new PgAggregateStore(adapterPool, { workspaceId: ws, series: [{ sourceId: 'src', subjectKey: pl.subjectKey, metricKey: up.code + '@1' }] });
      await store.publish(pl, [], null, 'fixture'); await report('mapping-impact', day(i));
    }
    const pl = plan(day(21), map, up, foreign), store = new PgAggregateStore(adapterPool, { workspaceId: foreign, series: [{ sourceId: 'src', subjectKey: pl.subjectKey, metricKey: up.code + '@1' }] });
    await store.publish(pl, [], null, 'fixture'); await report('foreign-dependency', day(21), data(day(21), map, foreign), { ...scope, workspaceId: foreign });
  });
  await t.test('mapping preview reads real aggregate manifests and report snapshots without changing any evidence or jobs', async () => {
    const before = await counts(), r = await inspect(), e = r.dependencyEvidence;
    assert.equal(e.aggregates.status, 'authorized_current_heads'); assert.equal(e.reports.status, 'authorized_current_heads');
    assert.equal(e.aggregates.items.length, 20); assert.equal(e.aggregates.hasMore, true); assert.equal(e.reports.items.length, 20); assert.equal(e.reports.hasMore, true);
    assert.equal(e.aggregates.items[0].period.start, day(20).start); assert.equal(r.assessment, 'needs_review');
    assert.ok(e.aggregates.items.every(a => a.period.end < r.proposed.validTo)); // Full prior interval, not only the December time difference.
    assert.doesNotMatch(JSON.stringify(e), /input_manifest|publishedBy|generatedBy|foreign-dependency|inputFingerprint|payloadSha/); assert.deepEqual(await counts(), before);
  });
  await t.test('optional dependency scopes do not query the other lane and absent rights reveal no counts', async () => {
    let aggregateQueries = 0, reportQueries = 0;
    const pool = wrap(async sql => { if (sql.includes('FROM bsmoss_analysis.aggregate_series')) aggregateQueries++; if (sql.includes('FROM bsmoss_analysis.report_series')) reportQueries++; });
    const absent = await inspect({}, pool); assert.equal(absent.dependencyEvidence.aggregates.status, 'not_authorized'); assert.equal(absent.dependencyEvidence.reports.status, 'not_authorized'); assert.equal(aggregateQueries + reportQueries, 0);
    await inspect({ reports: scope }, pool); assert.equal(aggregateQueries, 0); assert.ok(reportQueries > 0);
    reportQueries = 0; await inspect({ aggregates: scope }, pool); assert.equal(reportQueries, 0);
    const denied = await inspect({ aggregates: { ...scope, serviceIds: [] }, reports: { ...scope, stationIds: [] } }, pool); assert.equal(denied.dependencyEvidence.reports.status, 'not_authorized');
  });
  await t.test('corrupted aggregate and report lookahead fail the whole preview instead of partial success', async () => {
    const badAggregate = wrap(async (sql, _args, result) => { if (sql.startsWith('SELECT s.*,a.*')) { assert.equal(result.rows.length, 21); result.rows[20].result_payload.inputFingerprint = '0'.repeat(64); } });
    await assert.rejects(inspect(scopes, badAggregate), /invalid_mapping_aggregate_evidence/);
    let reportReads = 0;
    const badReport = wrap(async (sql, _args, result) => { if (sql.startsWith('SELECT s.*,r.*')) { reportReads++; if (reportReads === 21) result.rows[0].manifest_sha256 = '0'.repeat(64); } });
    await assert.rejects(inspect(scopes, badReport), /invalid_report_record/); assert.equal(reportReads, 21);
  });
  await t.test('full report scopes filter before LIMIT so many newer hidden records cannot hide authorized dependencies', async () => {
    for (let i = 0; i < 22; i++) await report('hidden-impact', day(50 + i), data(day(50 + i)), { ...scope, stationIds: ['st', 'outside'] });
    const r = await inspect(); assert.equal(r.dependencyEvidence.reports.items.length, 20); assert.equal(r.dependencyEvidence.reports.hasMore, true);
    assert.ok(r.dependencyEvidence.reports.items.every(r => r.title === 'mapping-impact'));
    const none = await inspect({ aggregates: { ...scope, metricKeys: [] }, reports: { ...scope, metricKeys: [] } });
    assert.deepEqual(none.dependencyEvidence.reports, { status: 'authorized_current_heads', items: [], hasMore: false }); assert.equal(none.dependencyEvidence.aggregates.items.length, 0);
  });
  await t.test('dependency-input metrics must all be authorized even if an aggregate has no selected input rows', async () => {
    const metric = { code: 'service.data.total_bytes', version: 1 }, pl = { ...plan(day(30), map, metric), inputMode: 'dependencies' };
    await new PgAggregateStore(adapterPool, { workspaceId: ws, series: [{ sourceId: 'src', subjectKey: pl.subjectKey, metricKey: metric.code + '@1' }] }).publish(pl, [], null, 'fixture');
    const narrow = { ...scope, metricKeys: [metric.code + '@1'] }, r = await inspect({ aggregates: narrow });
    assert.deepEqual(r.dependencyEvidence.aggregates, { status: 'authorized_current_heads', items: [], hasMore: false });
    const full = await inspect(); assert.equal(full.dependencyEvidence.aggregates.items[0].metricKey, metric.code + '@1');
  });
  await t.test('report daily dependencies and rollup members are found even when the main query uses a peer mapping', async () => {
    const week = bucketFor(day(90).start, 'week'), main = { kind: 'aggregate', query: { sourceId: 'src', mappingId: 'peer', metric: up, grain: 'week', at: week.start }, authorityVersion: hash, publication: null };
    const daily = nativeWindows(week, 'day').map(period => data(period)); await report('daily-dependency', week, main, scope, daily);
    const period = day(100), atom = { stationId: 'st', serviceId: 'svc', networkObjectId: 'cell' }, member = { id: 'one', sourceId: 'src', mappingId: 'map', authorityVersion: hash, atomKeys: [atomKey(atom)], coverageRef: 'fixture' };
    const rollup = aggregateObjectRollup({ status: 'active', metric: up, validPeriod: period, basis: null, atoms: [atom], members: [member] }, 'day', period.start, [{ memberId: 'one', currentAuthorityVersion: hash, publication: publication(period), unavailable: false }]);
    const result = { ...rollup, workspaceId: ws, rollupId: 'fixture-rollup', configRevision: '1', configSha256: hash, semanticSha256: hash, reviewRef: 'fixture', applicableServiceCount: 1, calculationFingerprint: hash, requiredMetricKeys: [up.code + '@1'], attribution: [{ ...atom, key: atomKey(atom), operatorEntityId: 'op', serviceApplicable: true }] };
    await report('rollup-dependency', period, { kind: 'rollup', query: { rollupId: 'fixture-rollup', grain: 'day', at: period.start }, result });
    const r = await inspect(); assert.ok(r.dependencyEvidence.reports.items.some(r => r.title === 'daily-dependency')); assert.ok(r.dependencyEvidence.reports.items.some(r => r.title === 'rollup-dependency'));
  });
  await t.test('state and gauge aggregate stored plans replay under the same device mapping scope', async () => {
    const r = await mappings.read('device-map'), period = day(110);
    for (const [code, Store, extra] of [['runtime.device.state', PgStateAggregateStore, { semantic: 'state', nativeGrain: 'event', maxHoldMilliseconds: 60000 }], ['runtime.environment.temperature_c', PgGaugeAggregateStore, { semantic: 'gauge', policy: { version: 1, authorityRef: 'fixture', mode: 'sample_mean', scale: 3 } }]]) {
      const metric = { code, version: 1 }, { inputMode: _i, mappingWindows: _m, ...pl } = plan(period, r, metric);
      const p = { ...pl, ...extra, mappingPeriods: [{ mappingId: r.id, mappingVersion: '1', period }] };
      await new Store(adapterPool, { workspaceId: ws, series: [{ sourceId: 'src', subjectKey: p.subjectKey, metricKey: code + '@1' }] }).publish(p, [], null, 'fixture');
    }
    const c = await adapterPool.connect(); try { const e = await readMappingImpacts(c, r, ws, scopes); assert.equal(e.aggregates.items.length, 2); } finally { c.release(); }
  });
  await t.test('baseline and dependency heads stay in one repeatable read view during a concurrent new publication', async () => {
    let changed = false, committedId;
    const pool = wrap(async sql => { if (!changed && sql.startsWith('SELECT m.workspace_id')) { changed = true; committedId = (await report('concurrent-impact', day(120))).id; } });
    const old = await inspect(scopes, pool); assert.equal(changed, true); assert.ok(!old.dependencyEvidence.reports.items.some(r => r.id === committedId));
    const next = await inspect(); assert.ok(next.dependencyEvidence.reports.items.some(r => r.id === committedId));
  });
  await t.test('an old dependency is not revived when current aggregate and report heads no longer reference this mapping', async () => {
    const period = day(140), peer = await mappings.read('peer'), original = plan(period), replacement = plan(period, peer);
    const store = new PgAggregateStore(adapterPool, { workspaceId: ws, series: [{ sourceId: 'src', subjectKey: original.subjectKey, metricKey: up.code + '@1' }] });
    const old = await store.publish(original, [], null, 'fixture'); await store.publish(replacement, [], '1', 'fixture');
    const oldReport = await report('historical-only-impact', period), m = reportManifest(ws, 'historical-only-impact', 1, definition('historical-only-impact'), period.start,
      [{ panelId: 'usage', data: data(period, peer), dailyDependencies: [], requiredScope: scope }]);
    await db.query("INSERT INTO bsmoss_analysis.report_revision(workspace_id,report_id,revision,manifest_sha256,manifest,generated_by) VALUES($1,$2,2,$3,$4,'fixture')", [ws, oldReport.id, fingerprintOf(m), m]);
    await db.query('UPDATE bsmoss_analysis.report_series SET current_revision=2 WHERE workspace_id=$1 AND id=$2', [ws, oldReport.id]);
    const r = await inspect(); assert.ok(!r.dependencyEvidence.aggregates.items.some(r => r.id === old.seriesId)); assert.ok(!r.dependencyEvidence.reports.items.some(r => r.id === oldReport.id));
    assert.equal((await db.query('SELECT count(*)::int n FROM bsmoss_analysis.report_revision WHERE workspace_id=$1 AND report_id=$2', [ws, oldReport.id])).rows[0].n, 2);
  });
  await t.test('actual dependency permission revocation suppresses success missing stale and failed reads independently', async () => {
    const member = randomUUID(), role = (await db.query("INSERT INTO local_authz.role(role_code,name) VALUES($1,'Mapping impact') RETURNING id", ['mapping-impact-' + ws])).rows[0].id;
    await db.query("INSERT INTO local_authz.member(id,workspace_id,sub,status) VALUES($1,$2,'impact','active')", [member, ws]);
    await db.query("INSERT INTO local_authz.data_scope(workspace_id,member_id,scope,expires_at) VALUES($1,$2,$3,'2099-01-01Z')", [ws, member, scope]); await db.query('INSERT INTO local_authz.member_role(member_id,role_id) VALUES($1,$2)', [member, role]);
    const ports = { readVerifiedIdentity: async () => ({ sub: 'impact', activeWorkspace: ws, accountStatus: 'active', governanceRoles: [], expiresAt: Date.now() + 60000 }), readCoverage: async () => ({ workspaceId: ws, product: 'bsmoss', tier: 'test', bundled: false, expiresAt: Date.now() + 60000 }), readLocalGrant: s => readPgGrant(adapterPool, s.workspaceId, s.sub), featuresFor: () => ['metering'] };
    for (const perm of ['admin.mappings.aggregate_impact.view', 'admin.mappings.report_impact.view']) for (const mode of ['success', 'missing', 'stale', 'sql_failure']) {
      await db.query("INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT $1,id FROM local_authz.permission WHERE perm_code IN ('admin.mappings.preflight','admin.mappings.aggregate_impact.view','admin.mappings.report_impact.view') ON CONFLICT DO NOTHING", [role]);
      const api = mappingPreflight(ports, { create: s => ({ workspaceId: ws, preview: async (id, p, scopes) => { try { if (mode === 'sql_failure') throw Error(mode); return await new PgMappingPreflightReader(adapterPool, s).preview(id, p, scopes); } finally { await db.query('DELETE FROM local_authz.role_permission WHERE role_id=$1 AND permission_id IN (SELECT id FROM local_authz.permission WHERE perm_code=$2)', [role, perm]); } } }) });
      const draft = p(); if (mode === 'stale') draft.expected.version = '999';
      await assert.rejects(api.preview(mode === 'missing' ? 'missing' : 'map', draft), /permission_denied/);
    }
  });
}
