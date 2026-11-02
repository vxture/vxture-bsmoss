import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { FIRST_METRICS } from '../../portals/app/app/domains/catalog/first-metrics.ts';
import { PgMeasurementStore } from '../../portals/app/app/domains/measurements/pg-store.ts';
import { readRefreshSnapshot } from '../../portals/app/app/domains/aggregation/refresh-snapshot.ts';
import { aggregateStatePeriod } from '../../portals/app/app/domains/aggregation/state-period.ts';
import { aggregateGaugePeriod } from '../../portals/app/app/domains/aggregation/gauge-period.ts';
import { PgStateAggregateStore } from '../../portals/app/app/domains/aggregation/pg-state-store.ts';
import { PgGaugeAggregateStore } from '../../portals/app/app/domains/aggregation/pg-gauge-store.ts';
import { atomKey } from '../../portals/app/app/domains/aggregation/object-rollup.ts';
import { fingerprintOf, mappingSetFingerprint } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { PgObjectRollupReader } from '../../portals/app/app/domains/aggregation/pg-object-rollup.ts';
import { createAuthorizedObjectRollup } from '../../portals/app/app/domains/access/object-rollup.ts';
import { PgReportStore } from '../../portals/app/app/domains/reports/pg-store.ts';
import { createAuthorizedReports } from '../../portals/app/app/domains/access/reports.ts';
import { PgAnalysisStore } from '../../portals/app/app/domains/views/pg-analysis.ts';
import { createAuthorizedAnalysis } from '../../portals/app/app/domains/access/analysis.ts';
import { PgReportPublicationStore } from '../../portals/app/app/domains/reports/pg-publication.ts';
import { createAuthorizedReportPublication } from '../../portals/app/app/domains/access/report-publication.ts';
import { PgReportExportStore } from '../../portals/app/app/domains/reports/pg-exports.ts';
import { createAuthorizedReportExports } from '../../portals/app/app/domains/access/report-exports.ts';

export async function deviceDistributionCases(t, { db, adapterPool, access, period, putTemplate, intercept }) {
  const state = { code: 'runtime.device.state', version: 1 }, gauge = { code: 'runtime.environment.temperature_c', version: 1 };
  const validPeriod = { start: '2026-01-01T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z' }, sourceId = 'dist-src';
  const atoms = ['dist-a', 'dist-b', 'dist-c'].map((deviceId, i) => ({ stationId: i === 2 ? 'dist-st2' : 'st', serviceId: null, networkObjectId: null, deviceId }));
  const scope = { workspaceId: 'w', sourceIds: [sourceId], stationIds: ['st', 'dist-st2'], serviceIds: [], deviceIds: atoms.map(a => a.deviceId), metricKeys: [state, gauge].map(m => m.code + '@1'), allowSiteParameters: false };
  const ports = { ...access, async readLocalGrant(s) { return { ...await access.readLocalGrant(s), scope, permissions: ['metering.view', 'reports.generate', 'reports.publish', 'reports.export', 'reports.export.execute'] }; } };
  const rollup = (p = ports, pool = adapterPool) => createAuthorizedObjectRollup(p, { create: s => new PgObjectRollupReader(pool, s) }, 'interactive');
  const reports = (p = ports, pool = adapterPool) => createAuthorizedReports(p, { create: s => new PgReportStore(pool, s) }, 'interactive');
  const analysis = (p = ports, pool = adapterPool) => createAuthorizedAnalysis(p, { create: (s, sub) => new PgAnalysisStore(pool, s, sub) }, 'interactive');
  const publication = createAuthorizedReportPublication(ports, { create: s => new PgReportPublicationStore(adapterPool, s) }, 'interactive');
  const exports = (p = ports) => createAuthorizedReportExports(p, { create: s => new PgReportExportStore(adapterPool, s) }, 'interactive');
  const q = id => ({ rollupId: id, grain: 'day', at: period.start });
  const target = (m, i) => ({ sourceId, mappingId: atoms[i].deviceId + '-map', metric: m, grain: 'day', at: period.start });
  await db.query(`INSERT INTO bsmoss_integration.source VALUES ('w','dist-src','Device distribution fixture','file');
    INSERT INTO bsmoss_resource.station VALUES ('w','dist-st2','Distribution station 2','tower','610000','610100')`);
  for (const a of atoms) {
    await db.query(`INSERT INTO bsmoss_resource.device VALUES ('w',$1,$2,'sensor','tower')`, [a.deviceId, a.stationId]);
    await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,device_id,version,valid_from,valid_to)
      VALUES ('w',$1,$2,'device',$3,$4,$3,1,'2026-01-01Z','2027-01-01Z')`, [a.deviceId + '-map', sourceId, a.deviceId, a.stationId]);
  }
  for (const m of [state, gauge]) {
    const def = FIRST_METRICS.get(m); await db.query(`INSERT INTO bsmoss_catalog.metric_version VALUES ($1,1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [m.code, def.category, def.semantic, def.unit, def]);
    const rules = m === state ? { stateAggregation: { version: 1, authorityRef: 'fixture://dist-state', maxHoldMilliseconds: 86400000 } }
      : { gaugeAggregation: { version: 1, authorityRef: 'fixture://dist-gauge', mode: 'sample_mean', scale: 3 } };
    await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w',$1,$2,$3,1,$4,'active','fixture://dist-reviewed',$5,'2026-01-01Z','2027-01-01Z')`, ['dist-cap-' + m.code, sourceId, m.code, m === state ? 'event' : 'day', rules]);
  }
  const writer = new PgMeasurementStore(adapterPool, scope, FIRST_METRICS), versions = new Map();
  async function write(m, i, value) {
    const eventId = 'dist:' + i + ':' + m.code, previous = versions.get(eventId) ?? 0, revision = String(previous + 1); versions.set(eventId, previous + 1);
    await writer.append({ workspaceId: 'w', sourceId, eventId, revision, previousRevision: previous ? String(previous) : null, payloadSha256: createHash('sha256').update(eventId + revision).digest('hex'), payloadUri: 'fixture://distribution',
      occurredAt: period.end, metric: m, componentKey: 'value', stationId: atoms[i].stationId, mappingId: target(m, i).mappingId, transformVersion: 'dist-v1', periodStart: period.start, periodEnd: value.kind === 'state_event' ? value.validUntil : period.end, value,
      quality: { status: 'verified', ruleVersion: 'fixture-v1', reason: 'Reviewed fixture', decidedBy: 'fixture-reviewer' } });
  }
  async function publish(m, i, confirmed = false) {
    const load = () => readRefreshSnapshot(adapterPool, scope, target(m, i)); let snapshot = await load();
    if (confirmed) {
      const plan = { ...snapshot.plan, sourceComplete: false, watermark: period.start }; delete plan.completionEvidence;
      const base = (m === state ? aggregateStatePeriod : aggregateGaugePeriod)(plan, snapshot.inputs);
      const revision = (await db.query(`SELECT coalesce(max(revision),0)+1 r FROM bsmoss_integration.source_completion_set WHERE workspace_id='w' AND source_id=$1 AND device_id=$2 AND metric_code=$3 AND grain='day' AND period_start=$4`, [sourceId, atoms[i].deviceId, m.code, period.start])).rows[0].r;
      await db.query(`INSERT INTO bsmoss_integration.source_completion_set(workspace_id,id,source_id,station_id,device_id,metric_code,metric_version,grain,period_start,period_end,revision,status,input_fingerprint,mapping_manifest_sha256,watermark,evidence_ref,evidence_sha256,recorded_by)
        VALUES ('w',$1,$2,$3,$4,$5,1,'day',$6,$7,$8,'confirmed',$9,$10,$7,'fixture://dist-completion',$11,'fixture-reviewer')`, [randomUUID(), sourceId, atoms[i].stationId, atoms[i].deviceId, m.code, period.start, period.end, revision, base.inputFingerprint, mappingSetFingerprint(base.mappingWindows), 'a'.repeat(64)]);
      snapshot = await load();
    }
    const s = { workspaceId: 'w', series: [{ sourceId, subjectKey: snapshot.plan.subjectKey, metricKey: m.code + '@1' }] }, store = m === state ? new PgStateAggregateStore(adapterPool, s) : new PgGaugeAggregateStore(adapterPool, s), head = await store.current(snapshot.plan);
    return store.publish(snapshot.plan, snapshot.inputs, head?.revision ?? null, 'fixture-worker');
  }
  async function config(m, population = atoms, indices = [0, 1]) {
    const members = [];
    for (const i of indices) { const snap = await readRefreshSnapshot(adapterPool, scope, target(m, i)); members.push({ id: 'member-' + i, sourceId, mappingId: target(m, i).mappingId, authorityVersion: snap.plan.authorityVersion, atomKeys: [atomKey(atoms[i])], coverageRef: 'fixture://dist-population' }); }
    return { status: 'active', metric: m, validPeriod, basis: m === state ? null : { kind: 'device_mean_bins', ref: 'fixture://dist-thresholds', mode: 'sample_mean', scale: 3, thresholds: ['0', '30000', '45000'] }, atoms: population, members };
  }
  const register = (id, c, revision = '1') => db.query(`INSERT INTO bsmoss_integration.object_rollup_revision(workspace_id,id,revision,config,review_ref) VALUES ('w',$1,$2,$3,'fixture://dist-review')`, [id, revision, c]);
  const panel = (id, m, grain = 'day') => ({ id, metricRef: m, category: 'runtime_parameter', view: 'table', grain, displayUnit: m === state ? 'device_count' : 'degC', precision: 2, order: m === state ? 0 : 1, visible: true });
  const template = (grain = 'day', prefix = 'dist-full') => ({ schema: 'periodic-report-template-v1', title: 'Device distributions', grain, panels: [panel('states', state, grain), panel('temperature', gauge, grain)], bindings: [{ panelId: 'states', kind: 'rollup', rollupId: prefix + '-state' }, { panelId: 'temperature', kind: 'rollup', rollupId: prefix + '-gauge' }] });
  for (const m of [state, gauge]) for (const i of [0, 1]) {
    await write(m, i, m === state ? { kind: 'state_event', state: i === 0 ? 'running' : 'fault', validUntil: i === 0 ? period.end : new Date(Date.parse(period.start) + 43200000).toISOString() }
      : { kind: 'fixed_point', unscaled: i === 0 ? '-10000' : '30000', scale: 3 }); await publish(m, i);
  }
  const stateConfig = await config(state), gaugeConfig = await config(gauge);
  await register('dist-full-state', stateConfig); await register('dist-full-gauge', gaugeConfig);
  await t.test('reviewed device populations conserve counts and duration and retain exact temperature bins without site-parameter privileges', async () => {
    const s = await rollup().read(q('dist-full-state')), g = await rollup().read(q('dist-full-gauge'));
    assert.equal(s.version, 'device-distribution-v1'); assert.equal(s.physicalStationCount, 2); assert.equal(s.serviceCount, 0); assert.equal(s.applicableServiceCount, 0);
    assert.deepEqual(s.distribution.endCounts, { running: '1', standby: '0', fault: '0', offline: '0', maintenance: '0', unknown: '2' });
    assert.equal(s.distribution.deviceMilliseconds.fault, '43200000'); assert.equal(s.distribution.deviceMilliseconds.unknown, '129600000'); assert.equal(s.distribution.expectedDeviceMilliseconds, '259200000');
    assert.equal(s.coverage.knownMembers, 2); assert.equal(s.completeness, 'partial'); assert.equal(s.value, null); assert.equal(g.knownValue, null);
    assert.deepEqual(g.distribution.bins.map(b => b.deviceCount), ['1', '0', '1', '0']); assert.equal(g.distribution.unknownDevices, '1');
    assert.ok(s.members.every(m => m.deviceValue && m.publication.authorityRevisions.length)); const { fingerprint, ...body } = g; assert.equal(fingerprint, fingerprintOf(body));
  });
  await t.test('full physical-device scope includes uncovered devices and cannot be granted through operator service or the station parameter switch', async () => {
    for (const patch of [{ deviceIds: ['dist-a', 'dist-b'] }, { deviceIds: [], allowSiteParameters: true }, { stationIds: ['st'] }, { sourceIds: [] }, { metricKeys: [] }]) {
      const p = { ...ports, async readLocalGrant(s) { return { ...await ports.readLocalGrant(s), scope: { ...scope, ...patch } }; } };
      await assert.rejects(rollup(p).read(q('dist-full-state')), /scope_denied/);
    }
    assert.equal(await new PgObjectRollupReader(adapterPool, { ...scope, workspaceId: 'other' }).read(q('dist-full-state')), null);
    let reads = 0; const revoked = { ...ports, async readLocalGrant(s) { const g = await ports.readLocalGrant(s); return ++reads > 1 ? { ...g, scope: { ...scope, deviceIds: [] } } : g; } };
    await assert.rejects(rollup(revoked).read(q('dist-full-state')), /denied/);
  });
  await t.test('reviewed coverage rejects duplicate devices, multiple sources and mismatched current mapping rather than silently changing the population', async () => {
    for (const [id, c] of [['dist-duplicate', { ...stateConfig, atoms: [...atoms, { ...atoms[0], stationId: 'dist-st2' }] }],
      ['dist-overlap', { ...stateConfig, members: [...stateConfig.members, { ...stateConfig.members[0], id: 'alt' }] }],
      ['dist-mapping', { ...stateConfig, members: [{ ...stateConfig.members[0], mappingId: 'dist-b-map' }] }]]) {
      await register(id, c); await assert.rejects(rollup().read(q(id)), /invalid_rollup_device_atom|duplicate_rollup_member|rollup_mapping_coverage_mismatch/);
    }
    await register('dist-policy', { ...gaugeConfig, basis: { ...gaugeConfig.basis, mode: 'time_weighted' } }); await assert.rejects(rollup().read(q('dist-policy')), /gauge_basis_mismatch/);
    const empty = await config(gauge, [atoms[2]], [2]);
    await register('dist-empty-policy', { ...empty, basis: { ...empty.basis, mode: 'time_weighted' } });
    await assert.rejects(rollup().read(q('dist-empty-policy')), /gauge_basis_mismatch/);
  });
  let completeRecord, exportJob;
  await t.test('complete device distributions generate publish and export with full historical device scope and explicit distribution text', async () => {
    for (const [m, suffix] of [[state, 'state'], [gauge, 'gauge']]) { await publish(m, 0, true); await register('dist-ready-' + suffix, await config(m, [atoms[0]], [0])); }
    await putTemplate('dist-ready-report', template('day', 'dist-ready'));
    completeRecord = (await reports().generate({ templateCode: 'dist-ready-report', templateVersion: 1, at: period.start, expectedRevision: null })).record;
    assert.equal(completeRecord.manifest.dataCompleteness, 'complete'); assert.deepEqual(completeRecord.manifest.requiredScope.deviceIds, ['dist-a']); assert.equal(completeRecord.manifest.requiredScope.allowSiteParameters, false);
    const event = (await publication.execute({ reportId: completeRecord.reportId, reportRevision: completeRecord.revision, manifestSha256: completeRecord.manifestSha256, action: 'published', expectedEventRevision: null, commandId: randomUUID(), reasonRef: 'fixture://dist-publish' })).event;
    exportJob = (await exports().request({ reportId: completeRecord.reportId, publicationRevision: event.eventRevision, commandId: randomUUID() })).job;
    assert.equal((await exports().run({ jobId: exportJob.jobId })).status, 'succeeded');
    const file = await exports().download({ jobId: exportJob.jobId }); assert.ok(file.html.includes('\u671f\u672b\u8bbe\u5907\u5206\u5e03')); assert.ok(file.html.includes('\u8bbe\u5907\u6837\u672c\u5747\u6e29\u5206\u5e03')); assert.ok(file.html.includes('deviceMilliseconds')); assert.ok(!file.html.includes('<script>'));
    const restricted = { ...ports, async readLocalGrant(s) { return { ...await ports.readLocalGrant(s), scope: { ...scope, deviceIds: [] } }; } };
    await assert.rejects(reports(restricted).read({ reportId: completeRecord.reportId }), /scope_denied/); await assert.rejects(exports(restricted).download({ jobId: exportJob.jobId }), /scope_denied/);
  });
  await t.test('analysis resolves distributions and authorizes hidden population without reading measurements, including the expected uncovered device', async () => {
    const t = template(), page = { schema: 'analysis-template-v1', title: 'Device distributions', panels: t.panels.map(p => ({ ...p, view: 'card', displayUnit: p.id === 'states' ? 'state' : p.displayUnit })), bindings: t.bindings };
    await putTemplate('dist-page', page, 1, 'page');
    const prior = (await db.query("SELECT * FROM bsmoss_views.template_selection WHERE workspace_id='w' AND scope_key='analysis:default'")).rows[0];
    await db.query(`INSERT INTO bsmoss_views.template_selection VALUES ('w','analysis:default','dist-page',1,'fixture',now()) ON CONFLICT(workspace_id,scope_key) DO UPDATE SET template_code='dist-page',template_version=1`);
    try {
      const r = await analysis().read({ at: period.start }); assert.equal(r.panels.length, 2); assert.equal(r.panels[0].points[0].data.result.distribution.kind, 'device_states');
      const c = { commandId: randomUUID(), templateCode: 'dist-page', templateVersion: 1, templateSha256: fingerprintOf(page), expectedRevision: null, preferences: page.panels.map(p => ({ id: p.id, visible: false })) };
      await analysis().save(c);
      const broken = intercept((client, sql, args) => sql.includes('SELECT m.*,n.kind') ? client.query('SELECT * FROM dist_forbidden_timeseries') : client.query(sql, args));
      assert.ok((await analysis(ports, broken).read({ at: period.start })).panels.every(p => p.points.length === 0));
      const restricted = { ...ports, async readLocalGrant(s) { return { ...await ports.readLocalGrant(s), scope: { ...scope, deviceIds: ['dist-a', 'dist-b'] } }; } };
      assert.deepEqual((await analysis(restricted).read({ at: period.start })).panels, []);
    } finally { if (prior) await db.query(`UPDATE bsmoss_views.template_selection SET template_code=$1,template_version=$2 WHERE workspace_id='w' AND scope_key='analysis:default'`, [prior.template_code, prior.template_version]); }
  });
  await t.test('reports pin device distributions for every natural day in weekly and monthly manifests without manufacturing complete coverage', async () => {
    for (const grain of ['week', 'month']) {
      const code = 'dist-' + grain; await putTemplate(code, template(grain, 'dist-ready'));
      const record = (await reports().generate({ templateCode: code, templateVersion: 1, at: period.start, expectedRevision: null })).record;
      assert.equal(record.manifest.dataCompleteness, 'incomplete'); assert.deepEqual(record.manifest.requiredScope.deviceIds, ['dist-a']);
      const days = record.manifest.items[0].dailyDependencies; assert.ok(days.length >= 7); assert.ok(days.some(d => d.status === 'missing')); assert.ok(days.some(d => d.status === 'complete'));
      assert.equal((await reports().read({ reportId: record.reportId })).freshness, 'current');
    }
  });
  await t.test('device report writes recheck actual device scope at commit and database failures remain errors', async () => {
    await putTemplate('dist-rollback-report', template('day', 'dist-ready')); let denied = false;
    const p = { ...ports, async readLocalGrant(s) { const g = await ports.readLocalGrant(s); return denied ? { ...g, scope: { ...scope, deviceIds: [] } } : g; } };
    const pool = intercept(async (client, sql, args) => { const r = await client.query(sql, args); if (sql.includes('INSERT INTO bsmoss_analysis.report_outbox')) denied = true; return r; });
    await assert.rejects(reports(p, pool).generate({ templateCode: 'dist-rollback-report', templateVersion: 1, at: period.start, expectedRevision: null }), /scope_denied/);
    assert.equal((await db.query("SELECT count(*)::int n FROM bsmoss_analysis.report_series WHERE template_code='dist-rollback-report'")).rows[0].n, 0);
    const broken = intercept((client, sql, args) => sql.includes('SELECT m.*,n.kind') ? client.query('SELECT * FROM dist_sql_failure') : client.query(sql, args));
    await assert.rejects(rollup(ports, broken).read(q('dist-full-state')), e => e.code === '42P01');
  });
  await t.test('a device correction preserves old report bytes, blocks stale downloads and a single repeatable-read never mixes concurrent corrections', async () => {
    const before = await rollup().read(q('dist-full-state')); let corrected = false;
    const pool = intercept(async (client, sql, args) => { const result = await client.query(sql, args); if (!corrected && sql.includes('SELECT m.*,n.kind') && args?.includes('dist-b-map')) {
      corrected = true; await write(state, 0, { kind: 'state_event', state: 'maintenance', validUntil: period.end }); await publish(state, 0, true);
    } return result; });
    const concurrent = await rollup(ports, pool).read(q('dist-full-state')); assert.equal(corrected, true); assert.equal(concurrent.fingerprint, before.fingerprint);
    const after = await rollup().read(q('dist-full-state')); assert.equal(after.distribution.endCounts.running, '0'); assert.equal(after.distribution.endCounts.maintenance, '1');
    const old = await reports().read({ reportId: completeRecord.reportId }); assert.equal(old.freshness, 'stale'); assert.equal(old.manifestSha256, completeRecord.manifestSha256); assert.equal(old.manifest.items[0].data.result.distribution.endCounts.running, '1');
    await assert.rejects(exports().download({ jobId: exportJob.jobId }), /stale|not_active|incomplete/);
    await db.query("UPDATE bsmoss_integration.source_capability SET status='retired' WHERE id=$1", ['dist-cap-' + gauge.code]);
    const lost = await rollup().read(q('dist-full-gauge')); assert.equal(lost.freshness, 'stale'); assert.equal(lost.distribution.unknownDevices, '3'); assert.equal(lost.completeness, 'missing');
    await db.query("UPDATE bsmoss_integration.source_capability SET status='active' WHERE id=$1", ['dist-cap-' + gauge.code]);
    for (const i of [0, 1]) await publish(gauge, i);
    const restored = await rollup().read(q('dist-full-gauge')); assert.equal(restored.freshness, 'stale'); assert.equal(restored.distribution.unknownDevices, '3');
    await register('dist-full-gauge', await config(gauge), '2');
    const reviewed = await rollup().read(q('dist-full-gauge')); assert.equal(reviewed.freshness, 'current'); assert.equal(reviewed.distribution.unknownDevices, '1'); assert.equal(reviewed.configRevision, '2');
  });
}
