import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sourceIntakeTasks, sourceIntakeTaskSupervision } from '../../portals/app/app/domains/integration/pg-intake-tasks.ts';
import { fingerprintOf } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { sourceBinding } from '../../portals/app/app/domains/integration/rules.ts';

export async function sourceIntakeTaskCases(t, { db, adapterPool, ports, scope, upMetric, period, draft }) {
  const finite = { ...scope, sourceIds: ['intake-src'], metricKeys: [upMetric.code + '@1'], deviceIds: [], allowSiteParameters: false };
  let actor = 'intake-task-operator', active = true;
  const access = { ...ports,
    async readVerifiedIdentity() { return { ...await ports.readVerifiedIdentity(), sub: actor }; },
    async readLocalGrant() { return { ...await ports.readLocalGrant(), sub: actor, active, permissions: ['metering.ingest', 'metering.jobs.view', 'metering.jobs.recover'], scope: finite }; } };
  const binding = (id, revision = '1') => sourceBinding({ id, revision, sourceId: 'intake-src', adapterVersion: 'fixture-v1', transformVersion: '1', coverageStart: period.start, scope: finite });
  async function register(b, status = 'active') {
    await db.query(`INSERT INTO bsmoss_integration.source_binding_revision(workspace_id,id,revision,source_id,status,binding,binding_sha256,review_ref)
      VALUES('w',$1,$2,'intake-src',$3,$4,$5,'fixture://intake-task-reviewed')`, [b.id, b.revision, status, b, fingerprintOf(b)]);
  }
  function source(name) {
    const { workspaceId: _w, quality: _q, ...measurement } = draft('task-' + name, upMetric, { kind: 'integer_delta', value: '129' }, {
      sourceId: 'intake-src', mappingId: 'intake-map', payloadSha256: createHash('sha256').update(name).digest('hex') });
    let heads = 0, pages = 0, hook = async () => {};
    const connector = {
      async head() { heads++; return { sourceId: 'intake-src', snapshotId: 'task-snapshot-1', dataRevision: 'v1', availableThrough: period.end, changeCursor: 'cursor-1', completionClaim: null }; },
      async page({ plan, after }) { pages++; await hook(); return { planId: plan.id, snapshotId: plan.snapshotId, after, items: [{ kind: 'window', measurement }], next: null }; },
    };
    return { connector, hook: fn => { hook = fn; }, counts: () => ({ heads, pages }) };
  }
  const wrap = (before = async () => {}, after = async () => {}) => ({ async connect() { const c = await adapterPool.connect(); return {
    async query(sql, args) { await before(sql, args); const result = await c.query(sql, args); await after(sql, args); return result; }, release(d) { c.release(d); } }; } });
  const count = async id => (await db.query(`SELECT
    (SELECT count(*)::int FROM bsmoss_integration.source_intake_receipt WHERE binding_id=$1) receipts,
    (SELECT count(*)::int FROM bsmoss_metering.measurement WHERE source_id='intake-src') facts,
    (SELECT count(*)::int FROM bsmoss_integration.source_intake_task_event WHERE task_id=$2) events`, [id, fingerprintOf(['source-intake-task-v1', 'w', id + '-command'])])).rows[0];
  const recovery = saved => ({ taskId: saved.id, expectedRevision: saved.latest.revision, commandId: saved.id + '-retry', reasonRef: 'review://intake-task-failure' });
  // Fault injection in this random owner-controlled contract DB only. No wait
  // for five real minutes and no runtime UPDATE privilege is introduced.
  async function expire(id) {
    await db.query('ALTER TABLE bsmoss_integration.source_intake_task_event DISABLE TRIGGER intake_event_guard');
    try { await db.query("UPDATE bsmoss_integration.source_intake_task_event SET lease_until=clock_timestamp()-interval '1 second' WHERE task_id=$1 AND state='started'", [id]); }
    finally { await db.query('ALTER TABLE bsmoss_integration.source_intake_task_event ENABLE TRIGGER intake_event_guard'); }
  }
  let main, completed;
  await t.test('intake task success and raw receipt commit atomically with exact command replay', async () => {
    main = binding('task-success'); await register(main); const s = source(main.id), api = sourceIntakeTasks(adapterPool, access, s.connector);
    completed = await api.run({ bindingId: main.id, commandId: main.id + '-command' });
    assert.equal(completed.latest.state, 'received'); assert.equal(completed.latest.inserted, 1); assert.equal(completed.publishesAvailability, false);
    assert.deepEqual(completed.attempts.map(e => e.state), ['started', 'received']);
    const before = s.counts(); assert.deepEqual(await api.run({ bindingId: main.id, commandId: main.id + '-command' }), completed); assert.deepEqual(s.counts(), before);
    assert.equal((await api.read(completed.id)).latest.receiptId, completed.latest.receiptId);
    assert.equal((await count(main.id)).receipts, 1);
    const next = await api.run({ bindingId: main.id, commandId: 'task-current-new-command' }); assert.equal(next.latest.state, 'current'); assert.equal(next.latest.receiptId, completed.latest.receiptId);
  });
  await t.test('intake journal is append-only and runtime cannot overwrite starts, leases, tasks or receipts', async () => {
    for (const table of ['source_intake_task', 'source_intake_task_event']) {
      for (const sql of ['UPDATE bsmoss_integration.' + table + ' SET workspace_id=workspace_id', 'DELETE FROM bsmoss_integration.' + table, 'TRUNCATE bsmoss_integration.' + table]) {
        await assert.rejects(adapterPool.query(sql), e => e.code === '42501');
        await assert.rejects(db.query(sql), /append_only|cannot truncate a table referenced in a foreign key/);
      }
    }
    await assert.rejects(db.query(`INSERT INTO bsmoss_integration.source_intake_task_event(workspace_id,task_id,revision,attempt,state,command_id,actor,lease_until)
      VALUES('w',$1,3,2,'started','bypass','intake-task-operator',clock_timestamp())`, [completed.id]), /not_recoverable/);
  });
  await t.test('adapter failure records a safe category without raw facts or input-position advancement', async () => {
    const b = binding('task-failure'); await register(b); const s = source(b.id); s.hook(async () => { throw Error('https://upstream?secret=credential'); });
    const api = sourceIntakeTasks(adapterPool, access, s.connector), before = await count(b.id);
    const failed = await api.run({ bindingId: b.id, commandId: b.id + '-command' });
    assert.equal(failed.latest.state, 'failed'); assert.equal(failed.latest.failureCode, 'intake_failed'); assert.equal((await count(b.id)).facts, before.facts); assert.equal((await count(b.id)).receipts, 0);
    assert.doesNotMatch(JSON.stringify(failed), /credential|https:\/\/upstream/);
    await assert.rejects(api.run({ bindingId: b.id, commandId: 'different-command-bypass' }), /intake_task_active/);
    const cmd = recovery(failed); await assert.rejects(api.recover({ ...cmd, expectedRevision: '1' }), /revision_conflict/);
    s.hook(async () => {}); const saved = await api.recover(cmd); assert.equal(saved.latest.state, 'received'); assert.equal(saved.latest.attempt, 2);
    assert.equal(saved.attempts[2].reasonRef, cmd.reasonRef); const calls = s.counts(); assert.deepEqual(await api.recover(cmd), saved); assert.deepEqual(s.counts(), calls);
    await assert.rejects(api.recover({ ...cmd, reasonRef: 'review://different' }), /conflicting_intake_recovery/);
  });
  await t.test('failure to append the terminal event rolls raw facts, quality, changes and receipt back', async () => {
    const b = binding('task-terminal-write-failure'); await register(b); const s = source(b.id), before = await count(b.id);
    const broken = wrap(async (sql, args) => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_task_event') && args[4] === 'received') throw Error('terminal_write_failed'); });
    const saved = await sourceIntakeTasks(broken, access, s.connector).run({ bindingId: b.id, commandId: b.id + '-command' });
    assert.equal(saved.latest.state, 'failed'); const after = await count(b.id); assert.equal(after.facts, before.facts); assert.equal(after.receipts, 0); assert.equal(after.events, 2);
  });
  await t.test('lost COMMIT acknowledgment is resolved from durable terminal success, never a false failure', async () => {
    const b = binding('task-lost-success'); await register(b); const s = source(b.id); let receiving = false, lost = false;
    const uncertain = wrap(undefined, async sql => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_receipt')) receiving = true;
      if (sql === 'COMMIT' && receiving && !lost) { lost = true; throw Error('fixture_lost_commit_ack'); } });
    const saved = await sourceIntakeTasks(uncertain, access, s.connector).run({ bindingId: b.id, commandId: b.id + '-command' });
    assert.equal(lost, true); assert.deepEqual(saved.attempts.map(e => e.state), ['started', 'received']); assert.equal((await count(b.id)).receipts, 1);
  });
  await t.test('revocation after terminal insertion rolls the intake back and cannot write a failure under stale authority', async () => {
    const b = binding('task-final-revoked'); await register(b); const s = source(b.id), before = await count(b.id);
    const denied = wrap(undefined, async (sql, args) => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_task_event') && args[4] === 'received') active = false; });
    try { await assert.rejects(sourceIntakeTasks(denied, access, s.connector).run({ bindingId: b.id, commandId: b.id + '-command' }), /permission_denied/); }
    finally { active = true; }
    const after = await count(b.id); assert.equal(after.facts, before.facts); assert.equal(after.receipts, 0); assert.equal(after.events, 1);
  });
  await t.test('cancelled reception records cancellation without committing facts, and exact replay does not restart it', async () => {
    const b = binding('task-cancel'); await register(b); const s = source(b.id), c = new AbortController(); s.hook(async () => { c.abort(Error('fixture_cancel')); });
    const api = sourceIntakeTasks(adapterPool, access, s.connector), before = await count(b.id), cmd = { bindingId: b.id, commandId: b.id + '-command' };
    const saved = await api.run(cmd, c.signal); assert.equal(saved.latest.state, 'failed'); assert.equal(saved.latest.failureCode, 'cancelled');
    assert.equal((await count(b.id)).facts, before.facts); const calls = s.counts(); await api.run(cmd); assert.deepEqual(s.counts(), calls);
  });
  await t.test('a live attempt cannot be recovered, and a new command cannot evade it', async () => {
    const b = binding('task-active'); await register(b); const s = source(b.id);
    let enter, release; const entered = new Promise(r => { enter = r; }), gate = new Promise(r => { release = r; });
    s.hook(async () => { enter(); await gate; }); const api = sourceIntakeTasks(adapterPool, access, s.connector), cmd = { bindingId: b.id, commandId: b.id + '-command' };
    const running = api.run(cmd); await entered;
    try {
      const saved = await api.run(cmd); assert.equal(saved.latest.state, 'started'); assert.equal(saved.latest.leaseExpired, false);
      await assert.rejects(api.recover(recovery(saved)), /not_recoverable/);
      await assert.rejects(api.run({ ...cmd, commandId: 'active-bypass' }), /intake_task_active/);
    } finally { release(); }
    assert.equal((await running).latest.state, 'received');
  });
  await t.test('expired attempt recovery fences a still-running predecessor and appends only one raw receipt', async () => {
    const b = binding('task-expired'); await register(b); const s = source(b.id);
    let enter, release, first = true; const entered = new Promise(r => { enter = r; }), gate = new Promise(r => { release = r; });
    s.hook(async () => { if (first) { first = false; enter(); await gate; } });
    const api = sourceIntakeTasks(adapterPool, access, s.connector), cmd = { bindingId: b.id, commandId: b.id + '-command' }, running = api.run(cmd); await entered;
    const id = fingerprintOf(['source-intake-task-v1', 'w', cmd.commandId]);
    let recovered;
    try {
      await expire(id); const saved = await api.read(id); assert.equal(saved.latest.leaseExpired, true);
      recovered = await api.recover(recovery(saved)); assert.equal(recovered.latest.state, 'received'); assert.equal(recovered.latest.attempt, 2);
    } finally { release(); }
    assert.equal((await running).latest.receiptId, recovered.latest.receiptId);
    assert.equal((await count(b.id)).receipts, 1); assert.deepEqual((await api.read(id)).attempts.map(e => e.state), ['started', 'started', 'received']);
  });
  await t.test('restart after a durable start uses reviewed expiry recovery rather than executing the original command twice', async () => {
    const b = binding('task-crash-start'); await register(b); const s = source(b.id); let crash = false;
    const crashed = wrap(undefined, async (sql, args) => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_task_event') && args[4] === 'started') crash = true;
      if (sql === 'COMMIT' && crash) { crash = false; throw Error('fixture_exit_after_start'); } });
    const cmd = { bindingId: b.id, commandId: b.id + '-command' };
    await assert.rejects(sourceIntakeTasks(crashed, access, s.connector).run(cmd), /fixture_exit_after_start/); assert.equal(s.counts().heads, 0);
    const api = sourceIntakeTasks(adapterPool, access, s.connector), saved = await api.run(cmd); assert.equal(saved.latest.state, 'started'); assert.equal(s.counts().heads, 0);
    await expire(saved.id); const finished = await api.recover(recovery(await api.read(saved.id))); assert.equal(finished.latest.state, 'received');
  });
  await t.test('reviewed recovery needs both ingest and recovery grants and does not borrow the requester identity', async () => {
    const b = binding('task-recovery-grants'); await register(b); const s = source(b.id); s.hook(async () => { throw Error('unavailable'); });
    const api = sourceIntakeTasks(adapterPool, access, s.connector), failed = await api.run({ bindingId: b.id, commandId: b.id + '-command' }), cmd = recovery(failed);
    for (const permissions of [['metering.ingest'], ['metering.jobs.recover']]) {
      const limited = { ...access, async readLocalGrant() { return { ...await access.readLocalGrant(), permissions }; } };
      await assert.rejects(sourceIntakeTasks(adapterPool, limited, s.connector).recover(cmd), /permission_denied/);
    }
    actor = 'intake-task-reviewer'; s.hook(async () => {});
    try { const saved = await api.recover(cmd); assert.equal(saved.latest.actor, actor); assert.equal(saved.latest.attempt, 2); }
    finally { actor = 'intake-task-operator'; }
  });
  await t.test('task reads recheck scope, permissions, tenant and final revocation without exposing the registration', async () => {
    const narrow = { ...access, async readLocalGrant() { const g = await access.readLocalGrant(); return { ...g, scope: { ...g.scope, serviceIds: [] } }; } };
    await assert.rejects(sourceIntakeTasks(adapterPool, narrow, {}).read(completed.id), /scope_denied/);
    const noView = { ...access, async readLocalGrant() { return { ...await access.readLocalGrant(), permissions: ['metering.ingest'] }; } };
    await assert.rejects(sourceIntakeTasks(adapterPool, noView, {}).read(completed.id), /permission_denied/);
    const foreign = { ...access,
      async readVerifiedIdentity() { return { ...await access.readVerifiedIdentity(), activeWorkspace: 'other' }; },
      async readCoverage() { return { ...await access.readCoverage(), workspaceId: 'other' }; },
      async readLocalGrant() { const g = await access.readLocalGrant(); return { ...g, workspaceId: 'other', scope: { ...g.scope, workspaceId: 'other' } }; } };
    await assert.rejects(sourceIntakeTasks(adapterPool, foreign, {}).read(completed.id), /unavailable/);
    let deny = false;
    const revoked = { ...access, async readLocalGrant() { const g = await access.readLocalGrant(); return deny ? { ...g, permissions: [] } : g; } };
    const intercepted = wrap(undefined, async sql => { if (sql.includes('ORDER BY revision LIMIT 12')) deny = true; });
    await assert.rejects(sourceIntakeTasks(intercepted, revoked, {}).read(completed.id), /permission_denied/);
    assert.equal('binding' in await sourceIntakeTasks(adapterPool, access, {}).read(completed.id), false);
  });
  await t.test('configuration changes cannot silently bind a failed task to a new source configuration', async () => {
    const b = binding('task-config-change'); await register(b); const s = source(b.id); s.hook(async () => { await register(binding(b.id, '2'), 'paused'); });
    const api = sourceIntakeTasks(adapterPool, access, s.connector), failed = await api.run({ bindingId: b.id, commandId: b.id + '-command' });
    assert.equal(failed.latest.state, 'failed'); assert.equal(failed.latest.failureCode, 'context_changed'); assert.equal(failed.bindingRevision, '1');
    const calls = s.counts(); await assert.rejects(api.recover(recovery(failed)), /paused/); assert.deepEqual(s.counts(), calls);
    assert.equal((await api.run({ bindingId: b.id, commandId: b.id + '-command' })).id, failed.id);
  });
  await t.test('five failed attempts exhaust recovery and cannot be bypassed by a fresh command', async () => {
    const b = binding('task-limit'); await register(b); const s = source(b.id); s.hook(async () => { throw Error('unavailable'); });
    const api = sourceIntakeTasks(adapterPool, access, s.connector); let saved = await api.run({ bindingId: b.id, commandId: b.id + '-command' });
    for (let n = 2; n <= 5; n++) saved = await api.recover({ ...recovery(saved), commandId: 'limit-retry-' + n });
    assert.equal(saved.latest.attempt, 5); assert.equal(saved.attempts.length, 10);
    await assert.rejects(api.recover({ ...recovery(saved), commandId: 'limit-retry-6' }), /attempt_limit/);
    await assert.rejects(api.run({ bindingId: b.id, commandId: 'limit-bypass' }), /intake_task_active/);
  });
  await t.test('machine ingestion stays disabled and commands cannot inject identity or cursor state', async () => {
    const service = { ...access, async readVerifiedIdentity() { return { kind: 'service', sub: 's2s:bsmoss', callerProduct: 'bsmoss', activeWorkspace: 'w', expiresAt: Date.now() + 60000, tokenId: 'fixture-only' }; } };
    await assert.rejects(sourceIntakeTasks(adapterPool, service, {}).run({ bindingId: main.id, commandId: 'machine-bypass' }));
    await assert.rejects(sourceIntakeTasks(adapterPool, access, {}).run({ bindingId: main.id, commandId: 'inject', cursor: 'forged' }));
  });
  await t.test('revocation after durable-start insertion rolls the entire claim back before any adapter call', async () => {
    const b = binding('task-start-revoked'); await register(b); const s = source(b.id);
    const denied = wrap(undefined, async (sql, args) => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_task_event') && args[4] === 'started') active = false; });
    try { await assert.rejects(sourceIntakeTasks(denied, access, s.connector).run({ bindingId: b.id, commandId: b.id + '-command' }), /permission_denied/); }
    finally { active = true; }
    assert.equal(s.counts().heads, 0);
    assert.equal((await db.query('SELECT count(*)::int n FROM bsmoss_integration.source_intake_task WHERE binding_id=$1', [b.id])).rows[0].n, 0);
  });
  await t.test('revoking recovery permission after the new attempt insert preserves the old failed revision', async () => {
    const b = binding('task-recover-final-revoked'); await register(b); const s = source(b.id); s.hook(async () => { throw Error('unavailable'); });
    const api = sourceIntakeTasks(adapterPool, access, s.connector), failed = await api.run({ bindingId: b.id, commandId: b.id + '-command' });
    let deny = false;
    const guarded = { ...access, async readLocalGrant() { const g = await access.readLocalGrant(); return deny ? { ...g, permissions: ['metering.ingest', 'metering.jobs.view'] } : g; } };
    const denied = wrap(undefined, async (sql, args) => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_task_event') && args[4] === 'started') deny = true; });
    const calls = s.counts(); await assert.rejects(sourceIntakeTasks(denied, guarded, s.connector).recover(recovery(failed)), /permission_denied/);
    assert.equal((await api.read(failed.id)).latest.revision, failed.latest.revision); assert.deepEqual(s.counts(), calls);
  });
  await t.test('concurrent recovery command replay starts one attempt and rejects a stale different command', async () => {
    const b = binding('task-concurrent-recover'); await register(b); const s = source(b.id); s.hook(async () => { throw Error('unavailable'); });
    const api = sourceIntakeTasks(adapterPool, access, s.connector), failed = await api.run({ bindingId: b.id, commandId: b.id + '-command' }), cmd = recovery(failed);
    let enter, release; const entered = new Promise(r => { enter = r; }), gate = new Promise(r => { release = r; }); s.hook(async () => { enter(); await gate; });
    const running = api.recover(cmd); await entered;
    try {
      const same = await api.recover(cmd); assert.equal(same.latest.state, 'started'); assert.equal(same.latest.attempt, 2);
      await assert.rejects(api.recover({ ...cmd, commandId: 'concurrent-different-retry' }), /revision_conflict/);
    } finally { release(); }
    const saved = await running; assert.equal(saved.latest.state, 'received'); assert.equal(saved.attempts.length, 4); assert.equal((await count(b.id)).receipts, 1);
  });
  await t.test('an identity switch after start cannot contact the source or acknowledge failure as the old actor', async () => {
    const b = binding('task-identity-switch'); await register(b); const s = source(b.id); let started = false;
    const switched = wrap(undefined, async (sql, args) => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_task_event') && args[4] === 'started') started = true;
      if (sql === 'COMMIT' && started) { started = false; actor = 'different-current-user'; } });
    try { await assert.rejects(sourceIntakeTasks(switched, access, s.connector).run({ bindingId: b.id, commandId: b.id + '-command' }), /access_expired/); }
    finally { actor = 'intake-task-operator'; }
    assert.equal(s.counts().heads, 0); assert.equal((await count(b.id)).events, 1);
  });
  await t.test('failure acknowledgment revocation leaves the original start without a false failed record', async () => {
    const b = binding('task-failure-revoked'); await register(b); const s = source(b.id); s.hook(async () => { throw Error('unavailable'); });
    const denied = wrap(undefined, async (sql, args) => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_task_event') && args[4] === 'failed') active = false; });
    try { await assert.rejects(sourceIntakeTasks(denied, access, s.connector).run({ bindingId: b.id, commandId: b.id + '-command' }), /permission_denied/); }
    finally { active = true; }
    assert.equal((await count(b.id)).events, 1); assert.equal((await count(b.id)).receipts, 0);
  });
  await t.test('database event guards reject foreign receipts, forged counts and unreviewed revision jumps', async () => {
    const b = binding('task-invalid-terminal'); await register(b); const s = source(b.id); let started = false;
    const crashed = wrap(undefined, async (sql, args) => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_task_event') && args[4] === 'started') started = true;
      if (sql === 'COMMIT' && started) { started = false; throw Error('fixture_start_exit'); } });
    const cmd = { bindingId: b.id, commandId: b.id + '-command' }; await assert.rejects(sourceIntakeTasks(crashed, access, s.connector).run(cmd));
    const id = fingerprintOf(['source-intake-task-v1', 'w', cmd.commandId]);
    await assert.rejects(adapterPool.query(`INSERT INTO bsmoss_integration.source_intake_task_event(workspace_id,task_id,revision,attempt,state,command_id,actor,lease_until,receipt_id,inserted)
      VALUES('w',$1,2,1,'received',$2,'intake-task-operator',clock_timestamp(),$3,1)`, [id, cmd.commandId, completed.latest.receiptId]), /invalid_intake_task_receipt/);
    await assert.rejects(adapterPool.query(`INSERT INTO bsmoss_integration.source_intake_task_event(workspace_id,task_id,revision,attempt,state,command_id,actor,lease_until)
      VALUES('w',$1,3,1,'failed',$2,'intake-task-operator',clock_timestamp())`, [id, cmd.commandId]), /revision_conflict/);
    assert.equal((await count(b.id)).events, 1);
    const countsCommand = 'task-forged-counts', countsId = fingerprintOf(['source-intake-task-v1', 'w', countsCommand]);
    await adapterPool.query(`INSERT INTO bsmoss_integration.source_intake_task(workspace_id,id,command_id,binding_id,binding_revision,binding_sha256,requested_by)
      SELECT workspace_id,$1,$2,binding_id,binding_revision,binding_sha256,requested_by FROM bsmoss_integration.source_intake_task WHERE id=$3`, [countsId, countsCommand, completed.id]);
    await adapterPool.query(`INSERT INTO bsmoss_integration.source_intake_task_event(workspace_id,task_id,revision,attempt,state,command_id,actor,lease_until)
      VALUES('w',$1,1,1,'started',$2,'intake-task-operator',clock_timestamp())`, [countsId, countsCommand]);
    await assert.rejects(adapterPool.query(`INSERT INTO bsmoss_integration.source_intake_task_event(workspace_id,task_id,revision,attempt,state,command_id,actor,lease_until,receipt_id,inserted)
      VALUES('w',$1,2,1,'received',$2,'intake-task-operator',clock_timestamp(),$3,99)`, [countsId, countsCommand, completed.latest.receiptId]), /invalid_intake_task_counts/);
  });
  const disposition = saved => ({ ...recovery(saved), commandId: saved.id + '-terminate', reasonRef: 'review://intake-disposition' });
  async function failedTask(name, b = binding(name), taskPorts = access) {
    await register(b); const s = source(name); s.hook(async () => { throw Error('unavailable'); });
    const api = sourceIntakeTasks(adapterPool, taskPorts, s.connector), saved = await api.run({ bindingId: b.id, commandId: name + '-command' });
    assert.equal(saved.latest.state, 'failed'); return { api, s, saved };
  }
  const recoveryOnly = { ...access, async readLocalGrant() { return { ...await access.readLocalGrant(), permissions: ['metering.jobs.recover'] }; } };
  await t.test('reviewed termination keeps history, exact replay and actor, and unblocks a fresh command without calling the source', async () => {
    const { api, s, saved } = await failedTask('task-terminate-failed'), cmd = disposition(saved), before = s.counts();
    const supervisor = sourceIntakeTaskSupervision(adapterPool, recoveryOnly);
    assert.deepEqual(Object.keys(supervisor).sort(), ['list', 'read', 'terminate']);
    actor = 'intake-task-reviewer'; let terminated;
    try {
      terminated = await supervisor.terminate(cmd);
      assert.deepEqual(await supervisor.terminate(cmd), terminated); assert.deepEqual(s.counts(), before);
      assert.deepEqual(terminated.attempts.map(e => e.state), ['started', 'failed', 'terminated']); assert.equal(terminated.latest.actor, actor);
      assert.equal(terminated.latest.reasonRef, cmd.reasonRef); assert.equal(terminated.latest.attempt, 1); assert.equal(terminated.latest.receiptId, null);
      await assert.rejects(supervisor.terminate({ ...cmd, reasonRef: 'review://different' }), /conflicting_intake_termination/);
    } finally { actor = 'intake-task-operator'; }
    await assert.rejects(supervisor.terminate(cmd), /conflicting_intake_termination/);
    await assert.rejects(api.recover({ ...recovery(terminated), commandId: 'recover-after-termination' }), /not_recoverable/);
    await assert.rejects(supervisor.terminate({ ...cmd, commandId: 'different-termination' }), /revision_conflict/);
    assert.equal((await api.run({ bindingId: saved.bindingId, commandId: 'task-terminate-failed-command' })).latest.state, 'terminated');
    s.hook(async () => {}); assert.equal((await api.run({ bindingId: saved.bindingId, commandId: 'fresh-after-disposition' })).latest.state, 'received');
    assert.equal((await api.read(saved.id)).latest.state, 'terminated'); assert.equal((await count(saved.bindingId)).receipts, 1);
  });
  await t.test('termination of a live attempt fences late network results and failure acknowledgment', async () => {
    const b = binding('task-terminate-live'); await register(b); const s = source(b.id);
    let enter, release; const entered = new Promise(r => { enter = r; }), gate = new Promise(r => { release = r; });
    s.hook(async () => { enter(); await gate; }); const api = sourceIntakeTasks(adapterPool, access, s.connector), cmd = { bindingId: b.id, commandId: b.id + '-command' };
    const running = api.run(cmd); await entered;
    try {
      const saved = await api.run(cmd); assert.equal(saved.latest.leaseExpired, false);
      const stopped = await api.terminate(disposition(saved)); assert.equal(stopped.latest.state, 'terminated');
      assert.equal(stopped.latest.leaseUntil, saved.latest.leaseUntil);
    } finally { release(); }
    assert.equal((await running).latest.state, 'terminated'); assert.equal((await count(b.id)).receipts, 0);
    assert.deepEqual((await api.read(fingerprintOf(['source-intake-task-v1', 'w', cmd.commandId]))).attempts.map(e => e.state), ['started', 'terminated']);
  });
  await t.test('terminal success wins over a concurrent disposition and cannot be undone', async () => {
    const api = sourceIntakeTasks(adapterPool, access, {}), before = await count(main.id);
    await assert.rejects(api.terminate(disposition(completed)), /not_terminable/);
    assert.deepEqual(await count(main.id), before); assert.equal((await api.read(completed.id)).latest.state, 'received');
  });
  await t.test('exhausted fifth failure accepts one final disposition beyond the ten attempt events', async () => {
    const id = fingerprintOf(['source-intake-task-v1', 'w', 'task-limit-command']), api = sourceIntakeTasks(adapterPool, access, {});
    const saved = await api.read(id); assert.equal(saved.attempts.length, 10);
    const terminated = await api.terminate(disposition(saved)); assert.equal(terminated.attempts.length, 11); assert.equal(terminated.latest.attempt, 5);
    assert.deepEqual(await api.read(id), terminated);
  });
  await t.test('expired start can be disposed after restart without executing a recovery', async () => {
    const id = fingerprintOf(['source-intake-task-v1', 'w', 'task-failure-revoked-command']), api = sourceIntakeTasks(adapterPool, access, {});
    await expire(id); const saved = await api.read(id); assert.equal(saved.latest.leaseExpired, true);
    assert.equal((await api.terminate(disposition(saved))).latest.state, 'terminated');
  });
  await t.test('paused and replaced bindings can be disposed under only the old scope and never inherit a prior position', async () => {
    const { api, saved } = await failedTask('task-terminate-config');
    await register(sourceBinding({ ...binding(saved.bindingId, '2'), scope: { ...finite, stationIds: ['new-scope-station'] } }), 'paused');
    const stopped = await api.terminate(disposition(saved)); assert.equal(stopped.bindingRevision, '1'); assert.equal(stopped.configurationChanged, true); assert.equal(stopped.configurationPaused, true);
    // A successful old configuration already has a position. Disposition of a
    // separate failed task must leave that immutable receipt exactly unchanged.
    const positionBinding = binding('task-position-kept'); await register(positionBinding);
    const s = source(positionBinding.id), positioned = sourceIntakeTasks(adapterPool, access, s.connector);
    assert.equal((await positioned.run({ bindingId: positionBinding.id, commandId: positionBinding.id + '-command' })).latest.state, 'received');
    await register(binding(positionBinding.id, '2'));
    const failed = await positioned.run({ bindingId: positionBinding.id, commandId: 'changed-binding-with-position' });
    assert.equal(failed.latest.failureCode, 'context_changed'); const before = await count(positionBinding.id);
    await positioned.terminate(disposition(failed)); assert.equal((await count(positionBinding.id)).receipts, before.receipts);
    const next = await positioned.run({ bindingId: positionBinding.id, commandId: 'changed-binding-still-needs-rebase' });
    assert.equal(next.latest.failureCode, 'context_changed'); assert.equal((await count(positionBinding.id)).receipts, before.receipts);
  });
  await t.test('termination rejects missing recovery permission, narrow scope and service identity', async () => {
    const { saved } = await failedTask('task-termination-scope'), cmd = disposition(saved);
    for (const patch of [{ permissions: ['metering.ingest'] }, { scope: { ...finite, serviceIds: [] } }]) {
      const limited = { ...access, async readLocalGrant() { return { ...await access.readLocalGrant(), ...patch }; } };
      await assert.rejects(sourceIntakeTaskSupervision(adapterPool, limited).terminate(cmd), /permission_denied|scope_denied/);
    }
    const service = { ...access, async readVerifiedIdentity() { return { kind: 'service', sub: 's2s:bsmoss', callerProduct: 'bsmoss', activeWorkspace: 'w', expiresAt: Date.now() + 60000, tokenId: 'fixture-only' }; } };
    await assert.rejects(sourceIntakeTaskSupervision(adapterPool, service).terminate(cmd), /permission_denied/);
  });
  await t.test('final revocation or identity switch rolls disposition back without changing the failed task', async () => {
    const { api, saved } = await failedTask('task-termination-final'), cmd = disposition(saved);
    const denied = wrap(undefined, async (sql, args) => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_task_event') && args[4] === 'terminated') active = false; });
    try { await assert.rejects(sourceIntakeTaskSupervision(denied, access).terminate(cmd), /permission_denied/); } finally { active = true; }
    assert.equal((await api.read(saved.id)).latest.revision, saved.latest.revision);
    const switched = wrap(undefined, async (sql, args) => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_task_event') && args[4] === 'terminated') actor = 'different-reviewer'; });
    try { await assert.rejects(sourceIntakeTaskSupervision(switched, access).terminate(cmd), /access_expired/); } finally { actor = 'intake-task-operator'; }
    assert.equal((await api.read(saved.id)).latest.revision, saved.latest.revision);
    assert.equal((await api.terminate(cmd)).latest.state, 'terminated');
  });
  await t.test('lost termination COMMIT acknowledgment is resolved by exact command replay after reopening', async () => {
    const { api, saved } = await failedTask('task-termination-uncertain'); let terminal = false;
    const uncertain = wrap(undefined, async (sql, args) => { if (sql.includes('INSERT INTO bsmoss_integration.source_intake_task_event') && args[4] === 'terminated') terminal = true;
      if (sql === 'COMMIT' && terminal) { terminal = false; throw Error('fixture_lost_disposition_ack'); } });
    const cmd = disposition(saved); await assert.rejects(sourceIntakeTaskSupervision(uncertain, access).terminate(cmd), /fixture_lost_disposition_ack/);
    const read = await api.read(saved.id), replay = await sourceIntakeTaskSupervision(adapterPool, recoveryOnly).terminate(cmd);
    assert.deepEqual(replay, read); assert.equal(replay.attempts.length, 3);
  });
  await t.test('concurrent disposition and reviewed recovery serialize on the exact event revision', async () => {
    const { api, saved } = await failedTask('task-termination-race');
    const results = await Promise.allSettled([api.terminate(disposition(saved)), api.recover(recovery(saved))]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.match(results.find(r => r.status === 'rejected').reason.message, /intake_task_busy|revision_conflict/);
    const read = await api.read(saved.id); assert.ok(['failed', 'terminated'].includes(read.latest.state));
    assert.ok(read.attempts.length === 3 || read.attempts.length === 4);
  });
  await t.test('database disallows missing disposition reasons, command reuse, forged receipts and post-terminal writes', async () => {
    const { api, saved } = await failedTask('task-termination-sql');
    const insert = (cmd, reason = null, receipt = null, attempt = 1) => adapterPool.query(`INSERT INTO bsmoss_integration.source_intake_task_event(workspace_id,task_id,revision,attempt,state,command_id,reason_ref,actor,lease_until,receipt_id)
      VALUES('w',$1,3,$2,'terminated',$3,$4,'intake-task-reviewer',clock_timestamp(),$5)`, [saved.id, attempt, cmd, reason, receipt]);
    await assert.rejects(insert('missing-reason'), /not_terminable/);
    await assert.rejects(insert('task-termination-sql-command', 'review://reuse'), /not_terminable/);
    await assert.rejects(insert('wrong-attempt', 'review://attempt', null, 2), /not_terminable/);
    await assert.rejects(insert('forged-receipt', 'review://receipt', completed.latest.receiptId), e => e.code === '23514');
    const stopped = await api.terminate(disposition(saved));
    await assert.rejects(adapterPool.query(`INSERT INTO bsmoss_integration.source_intake_task_event(workspace_id,task_id,revision,attempt,state,command_id,reason_ref,actor,lease_until)
      VALUES('w',$1,4,2,'started','illegal-restart','review://restart','intake-task-reviewer',clock_timestamp())`, [saved.id]), /not_recoverable/);
    assert.equal((await api.read(saved.id)).latest.revision, stopped.latest.revision);
  });
  const listScope = { ...finite, stationIds: ['task-list-station'], serviceIds: [], deviceIds: [], allowSiteParameters: false };
  const listAccess = { ...access, async readLocalGrant() { return { ...await access.readLocalGrant(), scope: listScope }; } };
  let listTasks;
  await t.test('intake list filters full original scope before limit and has stable microsecond keyset pagination', async () => {
    listTasks = [];
    for (let n = 0; n < 3; n++) listTasks.push(await failedTask('task-list-' + n, sourceBinding({ ...binding('task-list-' + n), scope: listScope }), listAccess));
    const wide = { ...listScope, serviceIds: ['hidden-service'] }, hiddenAccess = { ...listAccess, async readLocalGrant() { return { ...await listAccess.readLocalGrant(), scope: wide }; } };
    await failedTask('task-list-hidden', sourceBinding({ ...binding('task-list-hidden'), scope: wide }), hiddenAccess);
    // Give all three authorized tasks sub-millisecond timestamps in the same
    // millisecond. The random contract DB owner alone may inject these dates.
    await db.query('ALTER TABLE bsmoss_integration.source_intake_task DISABLE TRIGGER intake_task_guard');
    try { for (let i = 0; i < listTasks.length; i++) await db.query("UPDATE bsmoss_integration.source_intake_task SET created_at=$2::timestamptz WHERE id=$1", [listTasks[i].saved.id, '2026-11-06T01:02:03.12300' + i + 'Z']); }
    finally { await db.query('ALTER TABLE bsmoss_integration.source_intake_task ENABLE TRIGGER intake_task_guard'); }
    const supervisor = sourceIntakeTaskSupervision(adapterPool, listAccess), ids = []; let after;
    do { const page = await supervisor.list({ limit: 1, ...(after ? { after } : {}) }); assert.equal(page.items.length, 1);
      const item = page.items[0]; assert.equal(item.kind, 'source_intake'); assert.equal('attempts' in item, false); assert.equal('binding' in item, false);
      ids.push(item.id); after = page.next; assert.ok(ids.length <= 3);
    } while (after);
    assert.deepEqual(ids, listTasks.map(r => r.saved.id).reverse());
    const empty = { ...listAccess, async readLocalGrant() { return { ...await listAccess.readLocalGrant(), scope: { ...listScope, stationIds: [] } }; } };
    assert.deepEqual(await sourceIntakeTaskSupervision(adapterPool, empty).list({ limit: 1 }), { items: [], next: null });
  });
  await t.test('list uses one snapshot even if a selected task is disposed during the read', async () => {
    const target = listTasks[2], cmd = disposition(target.saved); let changed = false;
    const intercepted = wrap(undefined, async sql => { if (sql.includes('SELECT t.id,to_char') && !changed) { changed = true; await target.api.terminate(cmd); } });
    const page = await sourceIntakeTaskSupervision(intercepted, listAccess).list({ limit: 1 }); assert.equal(changed, true);
    assert.equal(page.items[0].id, target.saved.id); assert.equal(page.items[0].latest.state, 'failed');
    assert.equal((await target.api.read(target.saved.id)).latest.state, 'terminated');
  });
  await t.test('list checks final union including lookahead, empty pages, permissions and tenant isolation', async () => {
    for (const mutate of ['revoke', 'scope', 'actor']) {
      let queried = false;
      const guarded = { ...listAccess,
        async readVerifiedIdentity() { const i = await listAccess.readVerifiedIdentity(); return queried && mutate === 'actor' ? { ...i, sub: 'another-user' } : i; },
        async readLocalGrant() { const g = await listAccess.readLocalGrant(); return queried ? { ...g, ...(mutate === 'revoke' ? { permissions: [] } : mutate === 'scope' ? { scope: { ...listScope, stationIds: [] } } : {}) } : g; } };
      const intercepted = wrap(undefined, async sql => { if (sql.includes('FROM bsmoss_integration.source_binding_head h')) queried = true; });
      await assert.rejects(sourceIntakeTaskSupervision(intercepted, guarded).list({ limit: 1 }), /permission_denied|scope_denied|access_expired/);
    }
    let queried = false;
    const empty = { ...listAccess, async readLocalGrant() { return { ...await listAccess.readLocalGrant(), permissions: queried ? [] : ['metering.jobs.view'], scope: { ...listScope, stationIds: [] } }; } };
    const intercepted = wrap(undefined, async sql => { if (sql.includes('SELECT t.id,to_char')) queried = true; });
    await assert.rejects(sourceIntakeTaskSupervision(intercepted, empty).list({ limit: 1 }), /permission_denied/);
    const foreign = { ...listAccess,
      async readVerifiedIdentity() { return { ...await listAccess.readVerifiedIdentity(), activeWorkspace: 'other' }; },
      async readCoverage() { return { ...await listAccess.readCoverage(), workspaceId: 'other' }; },
      async readLocalGrant() { const g = await listAccess.readLocalGrant(); return { ...g, workspaceId: 'other', scope: { ...g.scope, workspaceId: 'other' } }; } };
    assert.deepEqual(await sourceIntakeTaskSupervision(adapterPool, foreign).list({ limit: 1 }), { items: [], next: null });
    await assert.rejects(sourceIntakeTaskSupervision(adapterPool, foreign).terminate(disposition(listTasks[0].saved)), /unavailable/);
  });
}
