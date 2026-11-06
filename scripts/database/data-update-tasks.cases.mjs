import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { receivedDataUpdates } from '../../portals/app/app/domains/data-updates/pg-tasks.ts';
import { PgMeasurementStore } from '../../portals/app/app/domains/measurements/pg-store.ts';
import { FIRST_METRICS } from '../../portals/app/app/domains/catalog/first-metrics.ts';
import { runRegisteredInputStep, superviseRegisteredInputChange } from '../../portals/app/app/domains/aggregation/pg-registered-input.ts';
import { claimAuthorizedRefresh } from '../../portals/app/app/domains/aggregation/refresh-supervision.ts';
import { PgRefreshJobs } from '../../portals/app/app/domains/aggregation/pg-refresh-jobs.ts';
import { PgAggregateJobStore } from '../../portals/app/app/domains/supervision/pg-jobs.ts';
import { createAuthorizedAggregateJobs } from '../../portals/app/app/domains/access/aggregate-jobs.ts';

export async function dataUpdateTaskCases(t, { db, adapterPool, ports, scope, upMetric, period, draft, finishChangeJobs }) {
  const finite = { ...scope, sourceIds: ['update-src'], metricKeys: [upMetric.code + '@1'], deviceIds: [] };
  const workerPorts = { ...ports, async readLocalGrant() { return { ...await ports.readLocalGrant(), scope: finite }; } };
  const human = { ...workerPorts,
    async readVerifiedIdentity() { return { ...await ports.readVerifiedIdentity(), sub: 'update-reviewer' }; },
    async readLocalGrant() { return { ...await workerPorts.readLocalGrant(), sub: 'update-reviewer', permissions: ['metering.aggregate', 'metering.jobs.view', 'metering.jobs.recover'] }; } };
  const config = { subject: 'snapshot-worker', status: 'active', scope: finite, policy: { outputs: [upMetric], grains: ['day'] },
    seeds: [{ sourceId: 'update-src', mappingId: 'update-map', metric: upMetric, notBefore: period.start, grains: ['day'] }] };
  const register = (revision, patch = {}) => db.query(`INSERT INTO bsmoss_integration.refresh_partition_revision(workspace_id,id,revision,config,review_ref)
    VALUES ('w','update-partition',$1,$2,'fixture://reviewed-update')`, [revision, { ...config, ...patch }]);
  const api = receivedDataUpdates(adapterPool, human), writer = new PgMeasurementStore(adapterPool, finite, FIRST_METRICS);
  let evidenceRevision = 0;
  const append = name => {
    const revision = String(++evidenceRevision), previousRevision = evidenceRevision === 1 ? null : String(evidenceRevision - 1);
    return writer.append(draft('update-evidence', upMetric, { kind: 'integer_delta', value: String(100 + evidenceRevision) },
      { sourceId: 'update-src', mappingId: 'update-map', revision, previousRevision, payloadSha256: createHash('sha256').update(name + revision).digest('hex') }));
  };
  const drain = async () => {
    for (let i = 0; i < 30; i++) {
      const step = await runRegisteredInputStep(adapterPool, workerPorts, 'update-partition');
      if (step.status === 'idle') return;
      assert.equal(step.status, 'dispatched'); await finishChangeJobs(step.manifest, workerPorts);
    }
    throw Error('fixture_update_drain_bound');
  };
  let first, retryTask, changeId;
  await t.test('received update uses an immutable reviewed partition; duplicate callers share a durable handle', async () => {
    await db.query("INSERT INTO bsmoss_integration.source VALUES ('w','update-src','Update fixture','file')");
    await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,device_id,version,valid_from,valid_to)
      SELECT workspace_id,'update-map','update-src',external_type,'update-fixture',station_id,service_id,network_object_id,device_id,version,valid_from,valid_to
      FROM bsmoss_integration.source_mapping WHERE workspace_id='w' AND id='flow-cell-map'`);
    await db.query(`INSERT INTO bsmoss_integration.source_capability SELECT workspace_id,'update-cap','update-src',metric_code,metric_version,native_grain,status,validation_ref,rules,valid_from,valid_to
      FROM bsmoss_integration.source_capability WHERE workspace_id='w' AND id='flow-up-cap'`);
    await register('1'); await append('first');
    first = await api.request({ partitionId: 'update-partition' }); assert.equal(first.status, 'accepted'); assert.equal(first.progress.phase, 'dispatching');
    const again = await receivedDataUpdates(adapterPool, human).request({ partitionId: 'update-partition' }); assert.equal(again.id, first.id); assert.equal(again.status, 'duplicate');
    const saved = await api.read(first.id); assert.equal(saved.kind, 'received_evidence'); assert.equal(saved.publishesAvailability, false);
    assert.equal((await db.query('SELECT count(*)::int n FROM bsmoss_analysis.data_update_request')).rows[0].n, 1);
  });
  await t.test('leaving the requester does not cancel existing dispatch or result workers; read reconstructs real progress', async () => {
    let sawResults = false;
    for (let i = 0; i < 20; i++) {
      const step = await runRegisteredInputStep(adapterPool, workerPorts, 'update-partition'); if (step.status === 'idle') break;
      assert.equal(step.status, 'dispatched');
      const before = await api.read(first.id); if (before.progress.results.total) sawResults = true;
      await finishChangeJobs(step.manifest, workerPorts);
    }
    const saved = await receivedDataUpdates(adapterPool, human).read(first.id);
    assert.equal(saved.progress.phase, 'processed'); assert.ok(sawResults); assert.ok(saved.progress.results.succeeded > 0);
    assert.equal((await api.request({ partitionId: 'update-partition' })).status, 'current');
    assert.equal(saved.publishesAvailability, false);
    for (const sql of ['UPDATE bsmoss_analysis.data_update_request SET requested_by=\'spoof\'', 'DELETE FROM bsmoss_analysis.data_update_request', 'TRUNCATE bsmoss_analysis.data_update_request']) await assert.rejects(adapterPool.query(sql), e => e.code === '42501');
  });
  await t.test('same analysis cutoff with new received evidence creates a distinct task; concurrent requests cannot duplicate it', async () => {
    await append('second');
    const results = await Promise.allSettled([api.request({ partitionId: 'update-partition' }), api.request({ partitionId: 'update-partition' })]);
    const accepted = results.filter(x => x.status === 'fulfilled').map(x => x.value); assert.ok(accepted.length); assert.notEqual(accepted[0].id, first.id);
    assert.ok(accepted.every(x => x.id === accepted[0].id));
    for (const r of results.filter(x => x.status === 'rejected')) assert.ok(r.reason.message === 'update_request_busy' || r.reason.code === '40001');
    assert.equal((await db.query('SELECT count(*)::int n FROM bsmoss_analysis.data_update_request')).rows[0].n, 2); await drain();
  });
  await t.test('tenant/scope isolation and current permissions apply on every read and request', async () => {
    const narrow = { ...human, async readLocalGrant() { const g = await human.readLocalGrant(); return { ...g, scope: { ...g.scope, serviceIds: [] } }; } };
    await assert.rejects(receivedDataUpdates(adapterPool, narrow).read(first.id), /scope_denied/);
    await assert.rejects(receivedDataUpdates(adapterPool, narrow).request({ partitionId: 'update-partition' }), /scope_denied/);
    const foreign = { ...human,
      async readVerifiedIdentity() { return { ...await human.readVerifiedIdentity(), activeWorkspace: 'other' }; },
      async readCoverage() { return { ...await human.readCoverage(), workspaceId: 'other' }; },
      async readLocalGrant() { const g = await human.readLocalGrant(); return { ...g, workspaceId: 'other', scope: { ...g.scope, workspaceId: 'other' } }; } };
    assert.equal(await receivedDataUpdates(adapterPool, foreign).read(first.id), null);
    await assert.rejects(api.request({ partitionId: 'update-partition', workspaceId: 'other' }), /invalid_update_command/);
    // The human request never borrows the partition's worker identity.
    assert.equal((await db.query('SELECT DISTINCT requested_by FROM bsmoss_analysis.data_update_request')).rows[0].requested_by, 'update-reviewer');
  });
  await t.test('grant loss after request insertion rolls back the immutable request', async () => {
    await append('revoked'); let deny = false;
    const guarded = { ...human, async readLocalGrant() { const g = await human.readLocalGrant(); return deny ? { ...g, permissions: [] } : g; } };
    const intercepted = { async connect() { const c = await adapterPool.connect(); return { async query(sql, args) { const result = await c.query(sql, args); if (sql.includes('INSERT INTO bsmoss_analysis.data_update_request')) deny = true; return result; }, release(d) { c.release(d); } }; } };
    const before = (await db.query('SELECT count(*)::int n FROM bsmoss_analysis.data_update_request')).rows[0].n;
    await assert.rejects(receivedDataUpdates(intercepted, guarded).request({ partitionId: 'update-partition' }), /permission_denied/);
    assert.equal((await db.query('SELECT count(*)::int n FROM bsmoss_analysis.data_update_request')).rows[0].n, before);
    retryTask = await api.request({ partitionId: 'update-partition' });
    changeId = (await db.query(`SELECT c.id FROM bsmoss_metering.input_change c JOIN bsmoss_metering.measurement m ON (m.workspace_id,m.id)=(c.workspace_id,c.measurement_id)
      WHERE m.source_id='update-src' AND c.change_kind='measurement' ORDER BY c.created_at DESC LIMIT 1`)).rows[0].id;
  });
  await t.test('failed inputs remain visible; reviewed retry is idempotent and resumes the same durable task', async () => {
    const poisoned = { async connect() { const c = await adapterPool.connect(); return { async query(sql, args) { if (sql.includes('INSERT INTO bsmoss_analysis.input_refresh_receipt')) throw Error('fixture_update_failure'); return c.query(sql, args); }, release(d) { c.release(d); } }; } };
    for (let i = 0; i < 5; i++) {
      const result = await superviseRegisteredInputChange(poisoned, workerPorts, 'update-partition', changeId); assert.equal(result.status, 'failure_recorded');
      await db.query("UPDATE bsmoss_analysis.input_dispatch_event SET available_at=clock_timestamp()-interval '1 second' WHERE change_id=$1", [changeId]);
    }
    const failed = await api.read(retryTask.id); assert.equal(failed.progress.phase, 'failed');
    assert.equal(failed.progress.failures.find(x => x.id === changeId).expectedRevision, '5');
    assert.equal((await api.request({ partitionId: 'update-partition' })).id, retryTask.id);
    const command = { id: retryTask.id, changeId, expectedRevision: '5', reasonRef: 'fixture://reviewed-update-retry' };
    const noRecover = { ...human, async readLocalGrant() { return { ...await human.readLocalGrant(), permissions: ['metering.jobs.view'] }; } };
    await assert.rejects(receivedDataUpdates(adapterPool, noRecover).retryInput(command), /permission_denied/);
    await assert.rejects(api.retryInput({ ...command, expectedRevision: '4' }), /revision_conflict/);
    assert.equal((await api.retryInput(command)).status, 'reopened'); assert.equal((await api.retryInput(command)).status, 'duplicate');
    await drain(); assert.equal((await api.read(retryTask.id)).progress.phase, 'processed');
    assert.equal((await db.query("SELECT recorded_by FROM bsmoss_analysis.input_dispatch_event WHERE change_id=$1 AND state='reopened'", [changeId])).rows[0].recorded_by, 'update-reviewer');
  });
  await t.test('reviewed result recovery is reflected in the same task without rewriting its original receipt', async () => {
    await append('result-recovery'); const task = await api.request({ partitionId: 'update-partition' });
    let deadId;
    for (let n = 0; n < 5; n++) {
      const step = await runRegisteredInputStep(adapterPool, workerPorts, 'update-partition'); if (step.status === 'idle') break;
      assert.equal(step.status, 'dispatched');
      if (!deadId && step.manifest.jobs.length) {
        for (let i = 0; i < 5; i++) {
          const lease = await claimAuthorizedRefresh(adapterPool, workerPorts); assert.ok(lease);
          deadId ??= lease.id; assert.equal(lease.id, deadId);
          const queue = new PgRefreshJobs(adapterPool, { workspaceId: 'w', series: [{ sourceId: lease.job.sourceId, subjectKey: lease.job.subjectKey, metricKey: lease.job.metricKey }] });
          await queue.fail(lease, 'fixture_failure');
          await db.query("UPDATE bsmoss_analysis.refresh_job SET available_at=clock_timestamp()-interval '1 second' WHERE workspace_id='w' AND id=$1", [deadId]);
        }
      } else await finishChangeJobs(step.manifest, workerPorts);
    }
    assert.ok(deadId); assert.equal((await api.read(task.id)).progress.phase, 'failed');
    const recovery = createAuthorizedAggregateJobs(human, { create: s => new PgAggregateJobStore(adapterPool, s) }, 'interactive');
    const result = await recovery.recover({ jobId: deadId, expectedAttempt: 5, commandId: 'update-result-retry', reasonRef: 'fixture://reviewed-result-retry' });
    assert.equal((await api.read(task.id)).progress.phase, 'recomputing');
    await finishChangeJobs({ jobs: [{ id: result.record.replacementJobId }] }, workerPorts);
    assert.equal((await api.read(task.id)).progress.phase, 'processed');
    assert.equal((await db.query("SELECT status FROM bsmoss_analysis.refresh_job WHERE workspace_id='w' AND id=$1", [deadId])).rows[0].status, 'dead');
  });
  await t.test('a first request adopts work already dispatched by the registered worker instead of reporting current', async () => {
    await append('pre-dispatched'); const step = await runRegisteredInputStep(adapterPool, workerPorts, 'update-partition');
    assert.equal(step.status, 'dispatched'); assert.ok(step.manifest.jobs.length);
    const task = await api.request({ partitionId: 'update-partition' }); assert.equal(task.status, 'accepted'); assert.ok(task.progress.results.total);
    await finishChangeJobs(step.manifest, workerPorts); await drain();
    assert.equal((await api.read(task.id)).progress.phase, 'processed');
  });
  await t.test('bounded discovery fails closed instead of presenting a truncated batch or false current state', async () => {
    const before = (await db.query('SELECT count(*)::int n FROM bsmoss_analysis.data_update_request')).rows[0].n;
    for (let i = 0; i < 32; i++) await append('bound-' + i);
    await assert.rejects(api.request({ partitionId: 'update-partition' }), /update_input_bound_exceeded/);
    assert.equal((await db.query('SELECT count(*)::int n FROM bsmoss_analysis.data_update_request')).rows[0].n, before);
  });
  await t.test('changed or paused configuration is explicit and cannot silently rebind historical task evidence', async () => {
    await register('2', { status: 'paused' }); const saved = await api.read(first.id); assert.equal(saved.configurationChanged, true);
    await assert.rejects(api.request({ partitionId: 'update-partition' }), /partition_paused/);
  });
}
