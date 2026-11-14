import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sourceIntake } from '../../portals/app/app/domains/integration/pg-intake.ts';
import { fingerprintOf } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { sourceBinding } from '../../portals/app/app/domains/integration/rules.ts';
import { receivedDataUpdates } from '../../portals/app/app/domains/data-updates/pg-tasks.ts';
import { runRegisteredInputStep } from '../../portals/app/app/domains/aggregation/pg-registered-input.ts';

// This runs only inside contract.test.mjs's random empty local database.
export async function sourceIntakeCases(t, { db, adapterPool, ports, scope, upMetric, period, draft, finishChangeJobs }) {
  const finite = { ...scope, sourceIds: ['intake-src'], metricKeys: [upMetric.code + '@1'], deviceIds: [], allowSiteParameters: false };
  let actor = 'intake-receiver', active = true;
  const intakePorts = { ...ports,
    async readVerifiedIdentity() { return { ...await ports.readVerifiedIdentity(), sub: actor }; },
    async readLocalGrant() { return { ...await ports.readLocalGrant(), sub: actor, active, permissions: ['metering.ingest', 'metering.aggregate', 'metering.jobs.view'], scope: finite }; } };
  const binding = (id, revision = '1', patch = {}) => sourceBinding({ id, revision, sourceId: 'intake-src', adapterVersion: 'fixture-v1', transformVersion: '1', coverageStart: period.start, scope: finite, ...patch });
  const register = async (b, status = 'active') => db.query(`INSERT INTO bsmoss_integration.source_binding_revision(workspace_id,id,revision,source_id,status,binding,binding_sha256,review_ref)
    VALUES($1,$2,$3,$4,$5,$6,$7,'fixture://reviewed-intake')`, ['w', b.id, b.revision, b.sourceId, status, b, fingerprintOf(b)]);
  function item(name, revision = '1', previousRevision = null, patch = {}) {
    const { workspaceId: _workspace, quality: _quality, ...measurement } = draft('intake-' + name, upMetric, { kind: 'integer_delta', value: '9007199254740993' }, {
      sourceId: 'intake-src', mappingId: 'intake-map', revision, previousRevision,
      payloadSha256: createHash('sha256').update(name + ':' + revision).digest('hex'), payloadUri: 'fixture://intake/' + name + '/' + revision,
      ...patch,
    });
    return { kind: 'window', measurement };
  }
  function source(items = [item('first')]) {
    const h = { sourceId: 'intake-src', snapshotId: 'snapshot-1', dataRevision: 'v1', availableThrough: period.end, changeCursor: 'cursor-1', completionClaim: null };
    let pages = 0, onHead = async () => {}, onPage = async () => {};
    const connector = { async head() { await onHead(); return structuredClone(h); }, async page({ plan, after }) { pages++; await onPage();
      return { planId: plan.id, snapshotId: plan.snapshotId, after, items: structuredClone(items), next: null }; } };
    return { h, connector, items, pages: () => pages, headHook: fn => { onHead = fn; }, pageHook: fn => { onPage = fn; } };
  }
  const counts = async id => (await db.query(`SELECT
    (SELECT count(*)::int FROM bsmoss_metering.measurement WHERE source_id='intake-src') AS measurements,
    (SELECT count(*)::int FROM bsmoss_integration.raw_event WHERE source_id='intake-src') AS raw,
    (SELECT count(*)::int FROM bsmoss_metering.quality_decision q JOIN bsmoss_metering.measurement m ON (m.workspace_id,m.id)=(q.workspace_id,q.measurement_id) WHERE m.source_id='intake-src') AS quality,
    (SELECT count(*)::int FROM bsmoss_metering.input_change c JOIN bsmoss_metering.measurement m ON (m.workspace_id,m.id)=(c.workspace_id,c.measurement_id) WHERE m.source_id='intake-src') AS changes,
    (SELECT count(*)::int FROM bsmoss_integration.source_intake_receipt WHERE binding_id=$1) AS receipts`, [id])).rows[0];
  function intercept(onQuery, pool = adapterPool) { return { async connect() { const c = await pool.connect(); return {
    async query(sql, args) { const result = await c.query(sql, args); await onQuery(sql, args, result); return result; }, release(discard) { c.release(discard); } }; } }; }
  const main = binding('intake-main'), upstream = source([item('first'), item('second')]); let first, second;
  await t.test('source intake registry is owner reviewed, append-only, tenant bound and runtime read-only', async () => {
    await db.query(`INSERT INTO bsmoss_integration.source VALUES ('w','intake-src','Intake fixture','fixture');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
      SELECT workspace_id,'intake-map','intake-src',external_type,'intake-cell',station_id,service_id,network_object_id,version,valid_from,valid_to FROM bsmoss_integration.source_mapping WHERE workspace_id='w' AND id='flow-cell-map';
      INSERT INTO bsmoss_integration.source_capability
      SELECT workspace_id,'intake-cap','intake-src',metric_code,metric_version,native_grain,status,validation_ref,rules,valid_from,valid_to
      FROM bsmoss_integration.source_capability WHERE workspace_id='w' AND id='flow-up-cap'`);
    await register(main);
    await assert.rejects(register(binding('intake-main', '3')), /source_binding_revision_conflict/);
    for (const sql of ["UPDATE bsmoss_integration.source_binding_revision SET status='paused'", 'DELETE FROM bsmoss_integration.source_binding_revision', 'TRUNCATE bsmoss_integration.source_binding_revision']) await assert.rejects(db.query(sql), /source_binding_append_only|cannot truncate a table referenced in a foreign key/);
    for (const sql of ["INSERT INTO bsmoss_integration.source_binding_revision SELECT * FROM bsmoss_integration.source_binding_revision", "UPDATE bsmoss_integration.source_binding_head SET revision=2", "INSERT INTO bsmoss_integration.source_completion SELECT * FROM bsmoss_integration.source_completion"])
      await assert.rejects(adapterPool.query(sql), e => e.code === '42501');
    const bad = binding('intake-cross'); bad.scope.workspaceId = 'other';
    await assert.rejects(db.query(`INSERT INTO bsmoss_integration.source_binding_revision(workspace_id,id,revision,source_id,status,binding,binding_sha256,review_ref) VALUES('w','intake-cross',1,'intake-src','active',$1,$2,'fixture://review')`, [bad, fingerprintOf(bad)]), e => e.code === '23514');
  });
  await t.test('raw measurements, pending quality, input changes and receipt position commit together', async () => {
    first = await sourceIntake(adapterPool, intakePorts, upstream.connector).receive(main.id);
    assert.equal(first.status, 'received'); assert.equal(first.inserted, 2); assert.equal(first.publishesAvailability, false);
    assert.deepEqual(await counts(main.id), { measurements: 2, raw: 2, quality: 2, changes: 4, receipts: 1 });
    const row = (await db.query('SELECT * FROM bsmoss_integration.source_intake_receipt WHERE id=$1', [first.receiptId])).rows[0];
    assert.equal(row.sequence, '1'); assert.equal(row.previous_id, null); assert.equal(row.manifest.position.through, period.end);
    assert.equal(row.received_by, actor); assert.equal(row.manifest.records.length, 2);
    const values = await db.query(`SELECT m.integer_value,q.quality,q.decided_by FROM bsmoss_metering.measurement m JOIN bsmoss_metering.quality_decision q ON (m.workspace_id,m.id)=(q.workspace_id,q.measurement_id) WHERE m.source_id='intake-src'`);
    assert.ok(values.rows.every(r => r.integer_value === '9007199254740993' && r.quality === 'pending' && r.decided_by === actor));
    assert.equal((await db.query("SELECT count(*)::int n FROM bsmoss_integration.source_completion WHERE source_id='intake-src'")).rows[0].n, 0);
  });
  await t.test('restart and lost-success-response retry recover the database cursor without new receipts or pages', async () => {
    const pages = upstream.pages(), before = await counts(main.id);
    const result = await sourceIntake(adapterPool, intakePorts, upstream.connector).receive(main.id);
    assert.equal(result.status, 'current'); assert.equal(result.receiptId, first.receiptId); assert.equal(upstream.pages(), pages);
    assert.deepEqual(await counts(main.id), before);
  });
  await t.test('same-through revisions append a new receipt and another actor preserves original pending attribution', async () => {
    actor = 'intake-receiver-2'; upstream.h.dataRevision = 'v2'; upstream.h.snapshotId = 'snapshot-2'; upstream.h.changeCursor = 'cursor-2';
    upstream.items.push(item('first', '2', '1', { value: { kind: 'integer_delta', value: '9007199254740994' } }));
    second = await sourceIntake(adapterPool, intakePorts, upstream.connector).receive(main.id);
    assert.equal(second.inserted, 1); assert.equal(second.duplicates, 2); assert.notEqual(second.receiptId, first.receiptId);
    const row = (await db.query('SELECT * FROM bsmoss_integration.source_intake_receipt WHERE id=$1', [second.receiptId])).rows[0];
    assert.equal(row.sequence, '2'); assert.equal(row.previous_id, first.receiptId); assert.equal(row.manifest.position.through, period.end);
    assert.equal(row.manifest.inputPosition.changeCursor, 'cursor-1');
    const authors = await db.query(`SELECT m.event_revision,q.decided_by FROM bsmoss_metering.measurement m JOIN bsmoss_metering.quality_decision q ON (m.workspace_id,m.id)=(q.workspace_id,q.measurement_id) WHERE m.source_id='intake-src'`);
    assert.equal(authors.rows.find(r => r.event_revision === '1').decided_by, 'intake-receiver');
    assert.equal(authors.rows.find(r => r.event_revision === '2').decided_by, actor);
  });
  await t.test('out-of-order source revisions are inserted after their predecessors and missing predecessors roll back', async () => {
    const b = binding('intake-revision-order'); await register(b);
    const s = source([item('order', '2', '1'), item('order')]);
    const result = await sourceIntake(adapterPool, intakePorts, s.connector).receive(b.id); assert.equal(result.inserted, 2);
    const bad = binding('intake-revision-missing'); await register(bad); const before = await counts(bad.id);
    await assert.rejects(sourceIntake(adapterPool, intakePorts, source([item('missing', '2', '1')]).connector).receive(bad.id), e => e.code === '23503');
    assert.deepEqual(await counts(bad.id), before);
  });
  await t.test('mapping failure rolls back all new raw rows, decisions, input changes and the cursor', async () => {
    const b = binding('intake-bad-map'); await register(b);
    const s = source([item('mapping-first'), item('mapping-invalid', '1', null, { mappingId: 'missing-map' })]);
    const before = await counts(b.id);
    await assert.rejects(sourceIntake(adapterPool, intakePorts, s.connector).receive(b.id), /mapping_not_effective/);
    assert.deepEqual(await counts(b.id), before);
  });
  await t.test('mid-transaction scope loss after a measurement write rolls every ledger back', async () => {
    const b = binding('intake-revoked'); await register(b); const s = source([item('revoked')]);
    let deny = false; const guarded = { ...intakePorts, async readLocalGrant() { const g = await intakePorts.readLocalGrant(); return deny ? { ...g, scope: { ...g.scope, serviceIds: [] } } : g; } };
    const wrapped = intercept(async sql => { if (sql.includes('INSERT INTO bsmoss_metering.measurement')) deny = true; });
    const before = await counts(b.id);
    await assert.rejects(sourceIntake(wrapped, guarded, s.connector).receive(b.id), /report_scope_denied/);
    assert.deepEqual(await counts(b.id), before);
  });
  await t.test('last permission check after receipt insertion still rolls back the full intake', async () => {
    const b = binding('intake-final-revoked'); await register(b); const s = source([item('final-revoked')]), before = await counts(b.id);
    const wrapped = intercept(async sql => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_receipt')) active = false; });
    await assert.rejects(sourceIntake(wrapped, intakePorts, s.connector).receive(b.id), /permission_denied/); active = true;
    assert.deepEqual(await counts(b.id), before);
    assert.equal((await sourceIntake(adapterPool, intakePorts, s.connector).receive(b.id)).status, 'received');
  });
  await t.test('receipt insert failure is retryable from the same position with no partial measurements', async () => {
    const b = binding('intake-insert-failed'); await register(b); const s = source([item('insert-failed')]), before = await counts(b.id);
    const broken = intercept(async sql => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_receipt')) throw Error('fixture_receipt_failure'); });
    await assert.rejects(sourceIntake(broken, intakePorts, s.connector).receive(b.id), /fixture_receipt_failure/);
    assert.deepEqual(await counts(b.id), before);
    assert.equal((await sourceIntake(adapterPool, intakePorts, s.connector).receive(b.id)).inserted, 1);
  });
  await t.test('cancellation before commit rolls back and does not cancel a separately committed receipt', async () => {
    const b = binding('intake-cancel'); await register(b); const s = source([item('cancel')]), before = await counts(b.id), controller = new AbortController();
    const wrapped = intercept(async sql => { if (sql.includes('INSERT INTO bsmoss_metering.measurement')) controller.abort(Error('fixture_cancel')); });
    await assert.rejects(sourceIntake(wrapped, intakePorts, s.connector).receive(b.id, controller.signal), /fixture_cancel/);
    assert.deepEqual(await counts(b.id), before);
    const result = await sourceIntake(adapterPool, intakePorts, s.connector).receive(b.id); controller.abort();
    assert.equal((await counts(b.id)).receipts, 1); assert.equal(result.status, 'received');
  });
  await t.test('source registration changes while pulling reject stale preparation before any DB write', async () => {
    const b = binding('intake-config-change'); await register(b); const s = source([item('config-change')]), before = await counts(b.id);
    s.pageHook(async () => { await register(binding(b.id, '2'), 'paused'); });
    await assert.rejects(sourceIntake(adapterPool, intakePorts, s.connector).receive(b.id), /source_configuration_changed/);
    assert.deepEqual(await counts(b.id), before);
    s.pageHook(async () => {}); let contacted = false; s.headHook(async () => { contacted = true; });
    await assert.rejects(sourceIntake(adapterPool, intakePorts, s.connector).receive(b.id), /source_binding_paused/); assert.equal(contacted, false);
  });
  await t.test('a reviewed pause during commit waits for the shared registration lock then advances after the receipt', async () => {
    const b = binding('intake-config-lock'); await register(b); const s = source([item('config-lock')]);
    const ownerPid = (await db.query('SELECT pg_backend_pid() pid')).rows[0].pid; let registration, sawBlocked = false;
    const wrapped = intercept(async sql => {
      if (!sql.includes('INSERT INTO bsmoss_integration.source_intake_receipt')) return;
      registration = register(binding(b.id, '2'), 'paused');
      for (let i = 0; i < 20; i++) {
        const blockers = (await adapterPool.query('SELECT pg_blocking_pids($1) blockers', [ownerPid])).rows[0].blockers;
        if (blockers.length) { sawBlocked = true; break; }
      }
      assert.equal(sawBlocked, true);
    });
    const received = await sourceIntake(wrapped, intakePorts, s.connector).receive(b.id); await registration;
    assert.equal(received.status, 'received');
    assert.equal((await db.query('SELECT binding_revision FROM bsmoss_integration.source_intake_receipt WHERE id=$1', [received.receiptId])).rows[0].binding_revision, '1');
    assert.equal((await db.query('SELECT revision FROM bsmoss_integration.source_binding_head WHERE id=$1', [b.id])).rows[0].revision, '2');
  });
  await t.test('full source, station, metric, service and device scope is required before adapter contact', async () => {
    for (const key of ['sourceIds', 'stationIds', 'metricKeys', 'serviceIds']) {
      const narrow = { ...intakePorts, async readLocalGrant() { const g = await intakePorts.readLocalGrant(); return { ...g, scope: { ...g.scope, [key]: [] } }; } };
      let called = false; const s = source(); s.headHook(async () => { called = true; });
      await assert.rejects(sourceIntake(adapterPool, narrow, s.connector).receive(main.id), /report_scope_denied/); assert.equal(called, false);
    }
    const b = binding('intake-device-scope', '1', { scope: { ...finite, deviceIds: ['flow-dev'] } }); await register(b);
    await assert.rejects(sourceIntake(adapterPool, intakePorts, source().connector).receive(b.id), /report_scope_denied/);
  });
  await t.test('tenant isolation hides other registrations and machine ingest stays denied', async () => {
    const foreign = { ...intakePorts, async readVerifiedIdentity() { return { ...await intakePorts.readVerifiedIdentity(), activeWorkspace: 'other' }; },
      async readCoverage() { return { ...await intakePorts.readCoverage(), workspaceId: 'other' }; },
      async readLocalGrant() { const g = await intakePorts.readLocalGrant(); return { ...g, workspaceId: 'other', scope: { ...g.scope, workspaceId: 'other' } }; } };
    await assert.rejects(sourceIntake(adapterPool, foreign, source().connector).receive(main.id), /source_binding_unavailable/);
    const machine = { ...intakePorts, async readVerifiedIdentity() { return { kind: 'service', sub: 's2s:bsmoss', callerProduct: 'bsmoss', activeWorkspace: 'w', tokenId: 'fixture', expiresAt: Date.now() + 60000 }; } };
    await assert.rejects(sourceIntake(adapterPool, machine, source().connector).receive(main.id), /permission_denied/);
  });
  await t.test('simultaneous preparations reuse one committed receipt instead of advancing twice', async () => {
    const b = binding('intake-concurrent'); await register(b); const s = source([item('concurrent')]);
    let release; const barrier = new Promise(resolve => { release = resolve; }); let heads = 0;
    s.headHook(async () => { if (++heads === 2) release(); await barrier; });
    const api = sourceIntake(adapterPool, intakePorts, s.connector);
    const results = await Promise.allSettled([api.receive(b.id), api.receive(b.id)]);
    const successes = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    assert.ok(successes.length); assert.equal(new Set(successes.map(r => r.receiptId)).size, 1);
    for (const failure of results.filter(r => r.status === 'rejected')) assert.match(failure.reason.message, /source_intake_busy/);
    assert.equal((await counts(b.id)).receipts, 1);
    s.headHook(async () => {}); assert.equal((await api.receive(b.id)).status, 'current');
  });
  await t.test('a concurrently committed identical plan replays its exact receipt even after a lost acknowledgement', async () => {
    const b = binding('intake-plan-replay'); await register(b); const a = source([item('plan-replay')]), winner = source([item('plan-replay')]); let committed;
    a.pageHook(async () => { committed = await sourceIntake(adapterPool, intakePorts, winner.connector).receive(b.id); });
    const duplicate = await sourceIntake(adapterPool, intakePorts, a.connector).receive(b.id);
    assert.equal(duplicate.status, 'duplicate'); assert.equal(duplicate.receiptId, committed.receiptId); assert.equal((await counts(b.id)).receipts, 1);
  });
  await t.test('stale different-head preparation fails CAS after a newer intake commits', async () => {
    const b = binding('intake-cas'); await register(b); const old = source([item('cas-old')]), recent = source([item('cas-new')]);
    recent.h.dataRevision = 'v2'; recent.h.snapshotId = 'snapshot-2'; recent.h.changeCursor = 'cursor-2';
    old.pageHook(async () => { await sourceIntake(adapterPool, intakePorts, recent.connector).receive(b.id); });
    await assert.rejects(sourceIntake(adapterPool, intakePorts, old.connector).receive(b.id), /source_position_changed/);
    assert.equal((await counts(b.id)).receipts, 1);
    assert.equal((await db.query("SELECT count(*)::int n FROM bsmoss_integration.raw_event WHERE event_id LIKE '%intake-cas-old%'")).rows[0].n, 0);
  });
  await t.test('overlap conflicting replay and mapping-object scope failure preserve the prior cursor', async () => {
    const s = source([item('first', '1', null, { value: { kind: 'integer_delta', value: '11' } })]);
    s.h.dataRevision = 'v3'; s.h.snapshotId = 'snapshot-3'; s.h.changeCursor = 'cursor-3';
    const before = await counts(main.id);
    await assert.rejects(sourceIntake(adapterPool, intakePorts, s.connector).receive(main.id), /conflicting_replay/);
    assert.deepEqual(await counts(main.id), before);
    const b = binding('intake-object-scope', '1', { scope: { ...finite, serviceIds: [] } }); await register(b);
    await assert.rejects(sourceIntake(adapterPool, intakePorts, source([item('object-scope')]).connector).receive(b.id), /object_scope_denied/);
    assert.equal((await counts(b.id)).receipts, 0);
  });
  await t.test('source completeness is retained as unverified evidence and an empty complete scan may advance only input position', async () => {
    const b = binding('intake-empty'); await register(b); const s = source([]);
    s.h.completionClaim = { status: 'confirmed', through: period.end, evidenceRef: 'fixture://unverified-claim', evidenceSha256: 'c'.repeat(64) };
    const result = await sourceIntake(adapterPool, intakePorts, s.connector).receive(b.id);
    assert.equal(result.inserted, 0); assert.equal(result.publishesAvailability, false);
    const row = (await db.query('SELECT manifest FROM bsmoss_integration.source_intake_receipt WHERE id=$1', [result.receiptId])).rows[0];
    assert.deepEqual(row.manifest.unverifiedCompletionClaim, s.h.completionClaim);
    assert.equal((await db.query("SELECT count(*)::int n FROM bsmoss_integration.source_completion WHERE source_id='intake-src'")).rows[0].n, 0);
    assert.equal((await sourceIntake(adapterPool, intakePorts, s.connector).receive(b.id)).status, 'current');
  });
  await t.test('runtime cannot mutate receipts, binding revisions or source completion', async () => {
    for (const table of ['source_intake_receipt', 'source_binding_revision', 'source_binding_head']) {
      for (const sql of [`DELETE FROM bsmoss_integration.${table}`, `TRUNCATE bsmoss_integration.${table}`]) await assert.rejects(adapterPool.query(sql), e => e.code === '42501');
    }
    await assert.rejects(adapterPool.query("UPDATE bsmoss_integration.source_intake_receipt SET received_by='forged'"), e => e.code === '42501');
  });
  await t.test('committed intake changes are picked up by the existing registered dispatcher and task monitor', async () => {
    // Other cases deliberately contain overlapping pending evidence. Use a
    // separate valid source for the successful downstream chain, not invented
    // independent events claiming the same authoritative metric/day slot.
    const chainScope = { ...finite, sourceIds: ['intake-chain-src'] };
    await db.query(`INSERT INTO bsmoss_integration.source VALUES ('w','intake-chain-src','Chain fixture','fixture');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
      SELECT workspace_id,'intake-chain-map','intake-chain-src',external_type,'intake-chain-cell',station_id,service_id,network_object_id,version,valid_from,valid_to FROM bsmoss_integration.source_mapping WHERE workspace_id='w' AND id='flow-cell-map';
      INSERT INTO bsmoss_integration.source_capability
      SELECT workspace_id,'intake-chain-cap','intake-chain-src',metric_code,metric_version,native_grain,status,validation_ref,rules,valid_from,valid_to
      FROM bsmoss_integration.source_capability WHERE workspace_id='w' AND id='flow-up-cap'`);
    const b = binding('intake-chain', '1', { sourceId: 'intake-chain-src', scope: chainScope }); await register(b);
    const s = source([item('chain', '1', null, { sourceId: 'intake-chain-src', mappingId: 'intake-chain-map' })]); s.h.sourceId = 'intake-chain-src';
    const chainPorts = { ...intakePorts, async readLocalGrant() { return { ...await intakePorts.readLocalGrant(), scope: chainScope }; } };
    const received = await sourceIntake(adapterPool, chainPorts, s.connector).receive(b.id); assert.equal(received.inserted, 1);
    const config = { subject: 'snapshot-worker', status: 'active', scope: chainScope, policy: { outputs: [upMetric], grains: ['day'] },
      seeds: [{ sourceId: 'intake-chain-src', mappingId: 'intake-chain-map', metric: upMetric, notBefore: period.start, grains: ['day'] }] };
    await db.query(`INSERT INTO bsmoss_integration.refresh_partition_revision(workspace_id,id,revision,config,review_ref) VALUES('w','intake-worker',1,$1,'fixture://reviewed-intake-worker')`, [config]);
    const worker = { ...ports, async readLocalGrant() { return { ...await ports.readLocalGrant(), scope: chainScope }; } };
    const monitor = receivedDataUpdates(adapterPool, chainPorts), request = await monitor.request({ partitionId: 'intake-worker' });
    assert.equal(request.status, 'accepted'); assert.equal(request.progress.phase, 'dispatching'); let jobs = 0;
    for (let i = 0; i < 64; i++) {
      const step = await runRegisteredInputStep(adapterPool, worker, 'intake-worker'); if (step.status === 'idle') break;
      assert.equal(step.status, 'dispatched', JSON.stringify(step)); jobs += step.manifest.jobs.length; await finishChangeJobs(step.manifest, worker);
    }
    assert.ok(jobs > 0); const result = await monitor.read(request.id); assert.equal(result.progress.phase, 'processed'); assert.equal(result.publishesAvailability, false);
    assert.equal((await db.query("SELECT count(*)::int n FROM bsmoss_integration.source_completion WHERE source_id='intake-src'")).rows[0].n, 0);
  });
}
