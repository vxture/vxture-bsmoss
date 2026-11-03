import assert from 'node:assert/strict';
import { randomUUID, generateKeyPairSync, sign } from 'node:crypto';
import { getOidcConfig } from '../../portals/app/app/auth/lib/config.ts';
import { createWorkerIdentityProvider } from '../../portals/app/app/platform/worker-identity.ts';
import { workerAccessPorts } from '../../portals/app/app/domains/access/worker-access.ts';
import { resolveMeasurementAccess } from '../../portals/app/app/domains/access/resolve.ts';
import { createAggregateWorker } from '../../portals/app/app/domains/workers/aggregate-worker.ts';
import { createReportWorker } from '../../portals/app/app/domains/workers/report-worker.ts';
import { bucketFor } from '../../portals/app/app/domains/aggregation/periods.ts';
import { readRefreshSnapshot } from '../../portals/app/app/domains/aggregation/refresh-snapshot.ts';
import { planRefreshJob } from '../../portals/app/app/domains/aggregation/refresh-jobs.ts';
import { PgRefreshJobs } from '../../portals/app/app/domains/aggregation/pg-refresh-jobs.ts';
import { fingerprintOf, aggregateIntervals, mappingSetFingerprint } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { PgMeasurementStore } from '../../portals/app/app/domains/measurements/pg-store.ts';
import { FIRST_METRICS } from '../../portals/app/app/domains/catalog/first-metrics.ts';
import { PgAggregateStore } from '../../portals/app/app/domains/aggregation/pg-store.ts';
import { PgReportStore } from '../../portals/app/app/domains/reports/pg-store.ts';
import { createAuthorizedReports } from '../../portals/app/app/domains/access/reports.ts';
import { createAuthorizedReportPublication } from '../../portals/app/app/domains/access/report-publication.ts';
import { PgReportPublicationStore } from '../../portals/app/app/domains/reports/pg-publication.ts';
import { createAuthorizedReportExports } from '../../portals/app/app/domains/access/report-exports.ts';
import { PgReportExportStore } from '../../portals/app/app/domains/reports/pg-exports.ts';
import { TIERS } from '../../portals/app/app/entitlement/types.ts';

// Entirely synthetic signed IdP and explicit DBA-reviewed fixture ACL. No live account.
export async function workerIdentityCases(t, { db, adapterPool }) {
  const ws = randomUUID(), subject = 's2s:bsmoss', metric = { code: 'service.data.uplink_bytes', version: 1 };
  const scope = { workspaceId: ws, sourceIds: ['src'], stationIds: ['st'], serviceIds: ['svc'], deviceIds: [], metricKeys: [metric.code + '@1'], allowSiteParameters: false };
  const oidc = { ...getOidcConfig(), issuer: 'https://worker-idp.example', jwksUrl: 'https://worker-idp.example/jwks' };
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  let exchanges = 0;
  const provider = createWorkerIdentityProvider(ws, {
    oidc, keyResolver: publicKey,
    s2s: { tokenUrl: 'https://worker-idp.example/token', clientId: 'bsmoss', clientSecret: 'fixture-only', productCode: 'bsmoss', enabled: true },
    fetchImpl: async () => {
      exchanges++;
      const iat = Math.floor(Date.now() / 1000);
      const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
      const data = encoded({ alg: 'RS256', kid: 'fixture' }) + '.' + encoded({ iss: oidc.issuer, aud: 'bsmoss', mode: 'service', act: { sub: 'bsmoss' }, workspace_id: ws, scope: 'tool:bsmoss', iat, exp: iat + 300, jti: randomUUID() });
      return Response.json({ access_token: data + '.' + sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url'), token_type: 'Bearer', expires_in: 300 });
    },
  });
  const dependencies = { pool: () => adapterPool, coverage: async () => ({ tier: null, bundled: true }), meteringEnabled: () => true };
  const ports = workerAccessPorts(ws, provider, dependencies);
  let member, role;
  await t.test('verified machine proof needs an explicit current PostgreSQL ACL and C3 provision, with no automatic membership', async () => {
    await db.query("INSERT INTO vx_provision.app_instance(workspace_id,product_code,status) VALUES($1,'bsmoss','provisioned')", [ws]);
    await assert.rejects(resolveMeasurementAccess(ports, 'aggregate', 'data'), /permission_denied/);
    assert.equal((await db.query('SELECT 1 FROM local_authz.member WHERE workspace_id=$1', [ws])).rowCount, 0);
    member = (await db.query('INSERT INTO local_authz.member(workspace_id,sub) VALUES($1,$2) RETURNING id', [ws, subject])).rows[0].id;
    role = (await db.query("INSERT INTO local_authz.role(role_code,name) VALUES($1,'Synthetic worker') RETURNING id", ['worker-' + ws])).rows[0].id;
    await db.query('INSERT INTO local_authz.data_scope(workspace_id,member_id,scope,expires_at) VALUES($1,$2,$3,now()+interval \'1 hour\')', [ws, member, scope]);
    await db.query('INSERT INTO local_authz.member_role(member_id,role_id) VALUES($1,$2)', [member, role]);
    await db.query("INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT $1,id FROM local_authz.permission WHERE perm_code=ANY($2::text[])", [role, ['metering.aggregate', 'reports.generate', 'reports.export.execute']]);
    assert.equal((await resolveMeasurementAccess(ports, 'aggregate', 'data')).context.sub, subject);
    assert.equal(exchanges, 1);
    await db.query("UPDATE local_authz.member SET status='inactive' WHERE id=$1", [member]);
    await assert.rejects(resolveMeasurementAccess(ports, 'aggregate', 'data'), /permission_denied/);
    await db.query("UPDATE local_authz.member SET status='active' WHERE id=$1", [member]);
    await db.query("UPDATE vx_provision.app_instance SET status='deprovisioned' WHERE workspace_id=$1", [ws]);
    await assert.rejects(resolveMeasurementAccess(ports, 'aggregate', 'data'), /feature_denied/);
    await db.query("UPDATE vx_provision.app_instance SET status='provisioned' WHERE workspace_id=$1", [ws]);
    for (const sql of ["UPDATE local_authz.member SET status='active'", 'DELETE FROM local_authz.data_scope'])
      await assert.rejects(adapterPool.query(sql), e => e.code === '42501');
  });
  const period = bucketFor(new Date(Date.now() - 86400000).toISOString(), 'day');
  await db.query("INSERT INTO bsmoss_resource.station VALUES($1,'st','Synthetic worker station','tower','610000','610100')", [ws]);
  await db.query("INSERT INTO bsmoss_resource.operator_entity VALUES($1,'op','mobile','Synthetic operator')", [ws]);
  await db.query("INSERT INTO bsmoss_resource.station_service VALUES($1,'svc','st','op','2026-01-01Z','2027-01-01Z')", [ws]);
  await db.query("INSERT INTO bsmoss_resource.network_object VALUES($1,'cell','st','svc','cell')", [ws]);
  await db.query("INSERT INTO bsmoss_integration.source VALUES($1,'src','Synthetic source','file')", [ws]);
  await db.query("INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to) VALUES($1,'map','src','cell','cell','st','svc','cell',1,'2026-01-01Z','2027-01-01Z')", [ws]);
  await db.query("INSERT INTO bsmoss_integration.source_capability VALUES($1,'cap','src',$2,1,'day','active','fixture://reviewed',$3,'2026-01-01Z','2027-01-01Z')", [ws, metric.code, { intervalAggregation: { version: 1, inputMode: 'direct', authorityRef: 'fixture://worker' } }]);
  const target = { sourceId: 'src', mappingId: 'map', metric, grain: 'day', at: period.start };
  async function enqueue() {
    const snapshot = await readRefreshSnapshot(adapterPool, scope, target), plan = planRefreshJob(snapshot, target, 'service-worker:' + randomUUID());
    return new PgRefreshJobs(adapterPool, { workspaceId: ws, series: [{ sourceId: 'src', subjectKey: plan.subjectKey, metricKey: metric.code + '@1' }] }).enqueue(plan, 5);
  }
  const row = async id => (await db.query('SELECT * FROM bsmoss_analysis.refresh_job WHERE id=$1', [id])).rows[0];
  const counts = async () => (await db.query(`SELECT
    (SELECT count(*) FROM bsmoss_analysis.aggregate_revision WHERE workspace_id=$1) revisions,
    (SELECT count(*) FROM bsmoss_analysis.aggregate_outbox WHERE workspace_id=$1) outbox,
    (SELECT count(*) FROM bsmoss_analysis.refresh_attempt WHERE workspace_id=$1) attempts`, [ws])).rows[0];
  const config = { workspaceId: ws, subject, partitionIds: [], executeResults: true, maxStepsPerTick: 1, pollMilliseconds: 1000 };
  let reportRegistration;
  const intercept = callback => ({ async connect() { const client = await adapterPool.connect(); return { query: (sql, args) => callback(client, sql, args), release: discard => client.release(discard) }; }, query: (...args) => adapterPool.query(...args) });
  await t.test('signed service identity runs the real scoped aggregate loop and records the service ACL key without inventing missing usage', async () => {
    const job = await enqueue(), cycle = await createAggregateWorker(adapterPool, ports, config).tick();
    assert.equal(cycle.events[0].status, 'succeeded'); assert.equal((await row(job.id)).status, 'succeeded');
    const revision = (await db.query('SELECT * FROM bsmoss_analysis.aggregate_revision WHERE workspace_id=$1', [ws])).rows[0];
    assert.equal(revision.published_by, subject); assert.equal(revision.completeness, 'missing'); assert.equal(revision.integer_value, null);
    assert.equal(exchanges, 1);
  });
  await t.test('real database grant revocation and provider failure after aggregate writes roll back result and receipt while retaining the durable lease', async () => {
    for (const mode of ['grant', 'provider']) {
      const job = await enqueue(), before = await counts(); let changed = false;
      const current = mode === 'provider' ? { ...ports, async readVerifiedIdentity() { if (changed) throw Error('worker_identity_unavailable'); return ports.readVerifiedIdentity(); } } : ports;
      const pool = intercept(async (client, sql, args) => {
        const result = await client.query(sql, args);
        if (sql.includes("SET status='succeeded',lease_token=NULL")) {
          changed = true;
          if (mode === 'grant') await db.query("UPDATE local_authz.member SET status='inactive' WHERE id=$1", [member]);
        }
        return result;
      });
      const cycle = await createAggregateWorker(pool, current, config).tick();
      assert.equal(changed, true); assert.equal(cycle.events[0].failure, 'authorization_denied');
      assert.deepEqual(await counts(), before); assert.equal((await row(job.id)).status, 'leased');
      await db.query("UPDATE local_authz.member SET status='active' WHERE id=$1", [member]);
      await db.query("UPDATE bsmoss_analysis.refresh_job SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [job.id]);
      assert.equal((await createAggregateWorker(adapterPool, ports, config).tick()).events[0].status, 'succeeded');
    }
  });
  await t.test('service report calendar uses the same verified principal and cannot publish templates or reports', async () => {
    const definition = { schema: 'periodic-report-template-v1', title: 'Synthetic worker report', grain: 'day',
      panels: [{ id: 'usage', metricRef: metric, category: 'business_service', view: 'card', grain: 'day', displayUnit: 'B', precision: 0, order: 0, visible: true }],
      bindings: [{ panelId: 'usage', kind: 'aggregate', sourceId: 'src', mappingId: 'map' }] };
    await db.query("INSERT INTO bsmoss_views.template_version(workspace_id,code,version,template_kind,definition,published_by) VALUES($1,'worker',1,'report',$2,'fixture-reviewer')", [ws, definition]);
    const registration = { subject, status: 'active', scope, templateCode: 'worker', templateVersion: 1, templateSha256: fingerprintOf(definition), grain: 'day', notBefore: period.start, delayMinutes: 0, lookbackHours: 72 };
    reportRegistration = registration;
    await db.query("INSERT INTO bsmoss_integration.report_schedule_revision(workspace_id,id,revision,config,review_ref) VALUES($1,'worker',1,$2,'fixture://worker-review')", [ws, registration]);
    const options = { workspaceId: ws, subject, scheduleIds: ['worker'], executeExports: false, maxStepsPerTick: 1, pollMilliseconds: 1000 };
    const cycle = await createReportWorker(adapterPool, ports, options).tick();
    assert.equal(cycle.events[0].status, 'succeeded');
    const generated = (await db.query('SELECT * FROM bsmoss_analysis.report_revision WHERE workspace_id=$1', [ws])).rows[0];
    assert.equal(generated.generated_by, subject);
    assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.report_publication_event WHERE workspace_id=$1', [ws])).rowCount, 0);
    for (const operation of ['report_publish', 'template_publish', 'report_jobs_recover'])
      await assert.rejects(resolveMeasurementAccess(ports, operation, 'data'), /permission_denied/);
    const other = { ...options, subject: 'human' };
    assert.equal((await createReportWorker(adapterPool, ports, other).tick()).events[0].failure, 'authorization_denied');
  });
  await t.test('service generation final database revocation rolls back the report and attempt without consuming pending work', async () => {
    await db.query("INSERT INTO bsmoss_views.template_version(workspace_id,code,version,template_kind,definition,published_by) SELECT workspace_id,'worker-revoke',1,template_kind,definition,published_by FROM bsmoss_views.template_version WHERE workspace_id=$1 AND code='worker'", [ws]);
    await db.query("INSERT INTO bsmoss_integration.report_schedule_revision(workspace_id,id,revision,config,review_ref) VALUES($1,'worker-revoke',1,$2,'fixture://worker-review')", [ws, { ...reportRegistration, templateCode: 'worker-revoke' }]);
    const options = { workspaceId: ws, subject, scheduleIds: ['worker-revoke'], executeExports: false, maxStepsPerTick: 1, pollMilliseconds: 1000 };
    let revoked = false;
    const pool = intercept(async (client, sql, args) => {
      const result = await client.query(sql, args);
      if (sql.includes('INSERT INTO bsmoss_analysis.report_generation_attempt')) {
        revoked = true; await db.query("UPDATE local_authz.member SET status='inactive' WHERE id=$1", [member]);
      }
      return result;
    });
    const count = async () => (await db.query(`SELECT
      (SELECT count(*) FROM bsmoss_analysis.report_revision WHERE workspace_id=$1) reports,
      (SELECT count(*) FROM bsmoss_analysis.report_generation_attempt WHERE workspace_id=$1) attempts`, [ws])).rows[0];
    const before = await count(), cycle = await createReportWorker(pool, ports, options).tick();
    assert.equal(revoked, true); assert.equal(cycle.events[0].failure, 'authorization_denied'); assert.deepEqual(await count(), before);
    assert.equal((await db.query("SELECT status FROM bsmoss_analysis.report_generation_job WHERE workspace_id=$1 AND schedule_id='worker-revoke'", [ws])).rows[0].status, 'pending');
    await db.query("UPDATE local_authz.member SET status='active' WHERE id=$1", [member]);
    assert.equal((await createReportWorker(adapterPool, ports, options).tick()).events[0].status, 'succeeded');
    assert.equal(Number((await count()).reports), Number(before.reports) + 1);
  });
  await t.test('service executes a human-reviewed export and final ACL revocation rolls back artifact and receipt without granting download or publication', async () => {
    const writer = new PgMeasurementStore(adapterPool, scope, FIRST_METRICS);
    await writer.append({ workspaceId: ws, sourceId: 'src', eventId: 'usage', revision: '1', previousRevision: null,
      payloadSha256: 'b'.repeat(64), payloadUri: 'fixture://worker-usage', occurredAt: period.end, metric, componentKey: 'value',
      stationId: 'st', mappingId: 'map', transformVersion: 'fixture-v1', periodStart: period.start, periodEnd: period.end,
      value: { kind: 'integer_delta', value: '100' }, quality: { status: 'verified', ruleVersion: 'fixture-v1', reason: 'Synthetic reviewed sample', decidedBy: 'fixture-reviewer' } });
    const snapshot = await readRefreshSnapshot(adapterPool, scope, target), plan = { ...snapshot.plan, sourceComplete: false, watermark: period.start };
    delete plan.completionEvidence;
    const base = aggregateIntervals(plan, snapshot.inputs);
    await db.query(`INSERT INTO bsmoss_integration.source_completion_set(workspace_id,id,source_id,station_id,service_id,network_object_id,device_id,metric_code,metric_version,grain,period_start,period_end,revision,status,input_fingerprint,mapping_manifest_sha256,watermark,evidence_ref,evidence_sha256,recorded_by)
      VALUES($1,$2,'src','st','svc','cell',NULL,$3,1,'day',$4,$5,1,'confirmed',$6,$7,$5,'fixture://worker-complete',$8,'fixture-reviewer')`,
    [ws, randomUUID(), metric.code, period.start, period.end, base.inputFingerprint, mappingSetFingerprint(base.mappingWindows), 'a'.repeat(64)]);
    const complete = await readRefreshSnapshot(adapterPool, scope, target), aggregate = new PgAggregateStore(adapterPool, { workspaceId: ws, series: [{ sourceId: 'src', subjectKey: complete.plan.subjectKey, metricKey: metric.code + '@1' }] });
    const head = await aggregate.current(complete.plan);
    await aggregate.publish(complete.plan, complete.inputs, head.revision, subject);
    // Human fixture ports are separate from the service provider; no machine claim is rewritten into a user token.
    const human = { ...ports, async readVerifiedIdentity() { return { sub: 'fixture-reviewer', activeWorkspace: ws, accountStatus: 'active', governanceRoles: [], expiresAt: Date.now() + 300000 }; },
      async readCoverage() { return { workspaceId: ws, product: 'bsmoss', tier: TIERS[0], bundled: false, expiresAt: Date.now() + 300000 }; },
      async readLocalGrant() { return { workspaceId: ws, sub: 'fixture-reviewer', active: true, scope, permissions: ['reports.generate', 'reports.publish', 'reports.export'], expiresAt: Date.now() + 300000 }; } };
    const api = createAuthorizedReports(human, { create: s => new PgReportStore(adapterPool, s) }, 'interactive');
    const old = (await db.query("SELECT * FROM bsmoss_analysis.report_series WHERE workspace_id=$1 AND template_code='worker' AND period_start=$2", [ws, period.start])).rows[0];
    const record = (await api.generate({ templateCode: 'worker', templateVersion: 1, at: period.start, expectedRevision: old.current_revision })).record;
    assert.equal(record.manifest.dataCompleteness, 'complete');
    const pub = createAuthorizedReportPublication(human, { create: s => new PgReportPublicationStore(adapterPool, s) }, 'interactive');
    const event = (await pub.execute({ reportId: record.reportId, reportRevision: record.revision, manifestSha256: record.manifestSha256, expectedEventRevision: null, commandId: randomUUID(), action: 'published', reasonRef: 'fixture://human-review' })).event;
    const exports = createAuthorizedReportExports(human, { create: s => new PgReportExportStore(adapterPool, s) }, 'interactive');
    const job = (await exports.request({ reportId: record.reportId, publicationRevision: event.eventRevision, commandId: randomUUID() })).job;
    const options = { workspaceId: ws, subject, scheduleIds: [], executeExports: true, maxStepsPerTick: 1, pollMilliseconds: 1000 };
    let revoked = false;
    const pool = intercept(async (client, sql, args) => {
      const result = await client.query(sql, args);
      if (sql.includes('INSERT INTO bsmoss_analysis.report_export_attempt')) {
        revoked = true; await db.query("UPDATE local_authz.member SET status='inactive' WHERE id=$1", [member]);
      }
      return result;
    });
    assert.equal((await createReportWorker(pool, ports, options).tick()).events[0].failure, 'authorization_denied'); assert.equal(revoked, true);
    for (const table of ['report_export_artifact', 'report_export_attempt']) assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.' + table + ' WHERE job_id=$1', [job.jobId])).rowCount, 0);
    assert.equal((await db.query('SELECT status FROM bsmoss_analysis.report_export_job WHERE id=$1', [job.jobId])).rows[0].status, 'pending');
    await db.query("UPDATE local_authz.member SET status='active' WHERE id=$1", [member]);
    assert.equal((await createReportWorker(adapterPool, ports, options).tick()).events[0].status, 'succeeded');
    const artifact = (await db.query('SELECT * FROM bsmoss_analysis.report_export_artifact WHERE job_id=$1', [job.jobId])).rows[0];
    assert.equal(artifact.created_by, subject); assert.ok(artifact.html.includes('100'));
    assert.equal((await exports.download({ jobId: job.jobId })).sha256, artifact.content_sha256);
    const machineExports = createAuthorizedReportExports(ports, { create: s => new PgReportExportStore(adapterPool, s) }, 'data');
    await assert.rejects(machineExports.download({ jobId: job.jobId }), /permission_denied/);
  });
}
