import type { Pool, PoolClient } from "pg";
import { resolveMeasurementAccess, type AccessPorts, type MeasurementAccess } from "../access/resolve.ts";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { INPUT_REFRESH_VERSION } from "../aggregation/input-refresh.ts";
import { pendingInputChangesInTransaction } from "../aggregation/pg-input-refresh.ts";
import { loadRegisteredPartition } from "../aggregation/pg-registered-partition.ts";
import { jobIdentity, validateRefreshJob } from "../aggregation/refresh-jobs.ts";
import { jobScope, decodeJobCursor, encodeJobCursor } from "../supervision/jobs.ts";
import { assertReportScope, unionReportScopes } from "../reports/rules.ts";
import { updateKey, updateManifest, updateProgress, type UpdateManifest, type ResultProgress } from "./tasks.ts";
import { updateListQuery, type UpdateListQuery } from "./queries.ts";
import type { UpdateSummary, UpdateList, UpdateNotification, UpdateNotifications } from "./contracts.ts";

type Operation = "aggregate" | "job_view" | "job_recover";
// A request records already-received evidence for an approved worker partition.
// It does not impersonate that worker, assert upstream completeness, or publish
// a new usable version. The existing independent worker consumes its own queue.
export function receivedDataUpdates(pool: Pool, ports: AccessPorts) {
  const now = ports.now ?? Date.now;
  async function transaction<T>(operation: Operation, work: (client: PoolClient, access: MeasurementAccess, check: (scope: UpdateManifest["scope"]) => Promise<void>) => Promise<T>) {
    const access = await resolveMeasurementAccess(ports, operation, "interactive"), client = await pool.connect(); let discard = false;
    const check = async (scope: UpdateManifest["scope"]) => {
      const current = await resolveMeasurementAccess(ports, operation, "interactive");
      if (access.expiresAt <= now() || current.expiresAt <= now()) throw Error("access_expired");
      if (current.context.workspaceId !== access.context.workspaceId || current.context.sub !== access.context.sub) throw Error("permission_denied");
      assertReportScope(current.scope, scope);
    };
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      const result = await work(client, access, check); await client.query("COMMIT"); return result;
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
  function manifest(row: Record<string, any>) {
    const m = updateManifest(row.manifest);
    if (m.scope.workspaceId !== row.workspace_id || updateKey(row.workspace_id, m) !== row.id || fingerprintOf(row.manifest) !== row.manifest_sha256 ||
        m.partitionId !== row.partition_id || m.partitionRevision !== row.partition_revision || row.valid !== true) throw Error("invalid_update_evidence");
    return m;
  }
  const select = `SELECT *,database_sha256=encode(sha256(convert_to(manifest::text,'UTF8')),'hex') valid FROM bsmoss_analysis.data_update_request`;
  async function progress(client: PoolClient, workspaceId: string, m: UpdateManifest) {
    const rows = (await client.query(`SELECT c.id,r.manifest,r.manifest_sha256,e.state,e.failure_code,e.revision,e.available_at FROM bsmoss_metering.input_change c
      LEFT JOIN bsmoss_analysis.input_refresh_receipt r ON (r.workspace_id,r.change_id,r.subscription_sha256)=(c.workspace_id,c.id,$3)
      LEFT JOIN LATERAL (SELECT state,failure_code,revision,available_at FROM bsmoss_analysis.input_dispatch_event
        WHERE workspace_id=c.workspace_id AND change_id=c.id AND subscription_sha256=$3 ORDER BY revision DESC LIMIT 1) e ON true
      WHERE c.workspace_id=$1 AND c.id=ANY($2::text[])`, [workspaceId, m.changeIds, m.subscriptionSha256])).rows;
    if (rows.length !== m.changeIds.length) throw Error("invalid_update_evidence");
    const ids = new Set<string>();
    for (const row of rows) if (row.manifest) {
      const receipt = row.manifest;
      if (fingerprintOf(receipt) !== row.manifest_sha256 || receipt.version !== INPUT_REFRESH_VERSION || receipt.changeId !== row.id ||
          receipt.subscriptionSha256 !== m.subscriptionSha256 || receipt.registration?.partitionId !== m.partitionId || receipt.registration?.revision !== m.partitionRevision ||
          !Array.isArray(receipt.jobs) || receipt.jobs.length > 64) throw Error("invalid_update_evidence");
      for (const job of receipt.jobs) { jobIdentity(job.id); ids.add(job.id); }
    }
    // Follow reviewed job recoveries rather than counting a replaced dead job
    // forever. Bound the chain; corruption or overflow never means completion.
    let frontier = [...ids]; const seen = new Set<string>(), jobs: ResultProgress[] = [];
    for (let depth = 0; frontier.length && depth < 9; depth++) {
      const records = (await client.query(`SELECT j.*,j.lease_until<=clock_timestamp() AS lease_expired,r.replacement_job_id,a.failure_code FROM bsmoss_analysis.refresh_job j
        LEFT JOIN bsmoss_analysis.refresh_recovery r ON (r.workspace_id,r.original_job_id)=(j.workspace_id,j.id)
        LEFT JOIN bsmoss_analysis.refresh_attempt a ON (a.workspace_id,a.job_id,a.attempt)=(j.workspace_id,j.id,j.attempt)
        WHERE j.workspace_id=$1 AND j.id=ANY($2::text[])`, [workspaceId, frontier])).rows;
      if (records.length !== frontier.length) throw Error("invalid_update_evidence");
      frontier = [];
      for (const row of records) {
        if (seen.has(row.id)) throw Error("invalid_update_evidence"); seen.add(row.id);
        const job = validateRefreshJob({ workspaceId, sourceId: row.source_id, subjectKey: row.subject_key, metricKey: row.metric_key, target: row.target, triggerRef: row.trigger_ref, dedupeKey: row.dedupe_key });
        assertReportScope(m.scope, jobScope(job));
        if (row.replacement_job_id) {
          if (row.status !== "dead") throw Error("invalid_update_evidence");
          jobIdentity(row.replacement_job_id); frontier.push(row.replacement_job_id);
        } else jobs.push({ id: row.id, status: row.status, failureCode: row.failure_code, attempt: Number(row.attempt), leaseExpired: row.lease_expired === true });
      }
    }
    if (frontier.length) throw Error("update_recovery_bound_exceeded");
    return updateProgress(rows.map(row => ({ id: row.id, dispatched: !!row.manifest, state: row.state ?? null, failureCode: row.failure_code ?? null,
      revision: row.revision, retryAt: row.available_at?.toISOString() ?? null })), jobs);
  }
  async function page(raw: UpdateListQuery, includeProgress: false): Promise<UpdateList>;
  async function page(raw: UpdateListQuery, includeProgress: true): Promise<UpdateNotifications>;
  async function page(raw: UpdateListQuery, includeProgress: boolean): Promise<UpdateList | UpdateNotifications> {
      const q = updateListQuery(raw), cursor = q.after ? decodeJobCursor(q.after) : null;
      return transaction("job_view", async (client, access, check) => {
        const s = access.scope;
        const rows = (await client.query(`SELECT *,database_sha256=encode(sha256(convert_to(manifest::text,'UTF8')),'hex') valid,
          to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') created_cursor
          FROM bsmoss_analysis.data_update_request WHERE workspace_id=$1
          AND manifest->'scope'->'sourceIds' <@ to_jsonb($2::text[]) AND manifest->'scope'->'stationIds' <@ to_jsonb($3::text[])
          AND manifest->'scope'->'serviceIds' <@ to_jsonb($4::text[]) AND manifest->'scope'->'deviceIds' <@ to_jsonb($5::text[])
          AND manifest->'scope'->'metricKeys' <@ to_jsonb($6::text[])
          AND (manifest->'scope'->>'allowSiteParameters'='false' OR $7::boolean)
          AND ($8::timestamptz IS NULL OR created_at<$8 OR (created_at=$8 AND id COLLATE "C"<$9))
          ORDER BY created_at DESC,id COLLATE "C" DESC LIMIT $10`,
        [s.workspaceId, s.sourceIds, s.stationIds, s.serviceIds, s.deviceIds, s.metricKeys, s.allowSiteParameters, cursor?.createdAt ?? null, cursor?.jobId ?? null, q.limit + 1])).rows;
        const manifests = rows.map(row => { const m = manifest(row); assertReportScope(s, m.scope); return m; });
        const items: UpdateSummary[] = rows.slice(0, q.limit).map(row => ({ id: row.id, kind: "received_evidence", partitionId: row.partition_id, partitionRevision: row.partition_revision, createdAt: row.created_at.toISOString() }));
        const last = rows[q.limit - 1], next = rows.length > q.limit ? encodeJobCursor({ createdAt: last.created_cursor, jobId: last.id, status: "all" }) : null;
        const notifications: UpdateNotification[] = [];
        if (includeProgress) for (let i = 0; i < items.length; i++) {
          const item = items[i], m = manifests[i], state = await progress(client, s.workspaceId, m);
          const head = (await client.query("SELECT revision FROM bsmoss_integration.refresh_partition_head WHERE workspace_id=$1 AND id=$2", [s.workspaceId, m.partitionId])).rows[0];
          notifications.push({ ...item, phase: state.phase, inputs: state.inputs, results: state.results,
            configurationChanged: head?.revision !== m.partitionRevision, publishesAvailability: false });
        }
        // One snapshot and a final union-scope check cover the whole response.
        await check(unionReportScopes(s.workspaceId, manifests.map(m => m.scope)));
        return includeProgress ? { items: notifications, next } : { items, next };
      });
  }
  return Object.freeze({
    list: (raw: UpdateListQuery) => page(raw, false),
    notifications: (raw: UpdateListQuery) => page(raw, true),
    async request(raw: { partitionId: string }) {
      if (!raw || Object.keys(raw).join() !== "partitionId") throw Error("invalid_update_command");
      const { partitionId } = raw;
      try { jobIdentity(partitionId); } catch { throw Error("invalid_update_command"); }
      return transaction("aggregate", async (client, access, check) => {
        const workspaceId = access.context.workspaceId, binding = await loadRegisteredPartition(client, workspaceId, partitionId), p = binding.partition;
        assertReportScope(access.scope, p.scope);
        if (p.status !== "active") throw Error("registered_partition_paused");
        // A distinct request lock serializes callers, not the independent worker.
        const locked = (await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) acquired", [JSON.stringify(["received-data-update-v1", workspaceId, partitionId])])).rows[0].acquired;
        if (!locked) throw Error("update_request_busy");
        const prior = (await client.query(select + " WHERE workspace_id=$1 AND partition_id=$2 AND partition_revision=$3 ORDER BY created_at DESC,id DESC LIMIT 1", [workspaceId, partitionId, p.revision])).rows[0];
        if (prior) {
          const m = manifest(prior); assertReportScope(access.scope, m.scope);
          const state = await progress(client, workspaceId, m);
          if (state.phase !== "processed") { await check(m.scope); return { status: "duplicate" as const, id: prior.id as string, progress: state }; }
        }
        // Discovery is bounded. Do not call a truncated prefix a complete update.
        const pending = await pendingInputChangesInTransaction(client, { ...access, scope: p.scope }, p.policy, binding.registration, true);
        // The worker may already have dispatched evidence before the first
        // manual request. Adopt its unfinished jobs instead of reporting current.
        const adopted = (await client.query(`SELECT DISTINCT r.change_id FROM bsmoss_analysis.input_refresh_receipt r
          CROSS JOIN LATERAL jsonb_array_elements(r.manifest->'jobs') member
          LEFT JOIN bsmoss_analysis.refresh_job j ON j.workspace_id=r.workspace_id AND j.id=member->>'id'
          WHERE r.workspace_id=$1 AND r.subscription_sha256=$2 AND (j.id IS NULL OR j.status<>'succeeded') LIMIT 65`, [workspaceId, pending.subscriptionSha256])).rows;
        if (pending.changeIds.length === 64 || adopted.length > 64) throw Error("update_input_bound_exceeded");
        const changeIds = new Set(pending.changeIds);
        for (const row of adopted) {
          const candidate = updateManifest({ version: "received-data-update-v1", partitionId, partitionRevision: p.revision, subscriptionSha256: pending.subscriptionSha256, scope: p.scope, changeIds: [row.change_id] });
          if ((await progress(client, workspaceId, candidate)).phase !== "processed") changeIds.add(row.change_id);
        }
        if (changeIds.size > 64) throw Error("update_input_bound_exceeded");
        if (!changeIds.size) { await check(p.scope); return { status: "current" as const }; }
        const m = updateManifest({ version: "received-data-update-v1", partitionId, partitionRevision: p.revision, subscriptionSha256: pending.subscriptionSha256, scope: p.scope, changeIds: [...changeIds] });
        const id = updateKey(workspaceId, m), sha = fingerprintOf(m);
        await client.query(`INSERT INTO bsmoss_analysis.data_update_request(workspace_id,id,partition_id,partition_revision,manifest,manifest_sha256,database_sha256,requested_by)
          VALUES($1,$2,$3,$4,$5,$6,encode(sha256(convert_to($5::jsonb::text,'UTF8')),'hex'),$7) ON CONFLICT(workspace_id,id) DO NOTHING`, [workspaceId, id, partitionId, p.revision, m, sha, access.context.sub]);
        const state = await progress(client, workspaceId, m);
        await check(p.scope); return { status: "accepted" as const, id, progress: state };
      });
    },
    async read(id: string) {
      if (!/^[a-f0-9]{64}$/.test(id)) throw Error("invalid_update_id");
      return transaction("job_view", async (client, access, check) => {
        const row = (await client.query(select + " WHERE workspace_id=$1 AND id=$2", [access.context.workspaceId, id])).rows[0];
        if (!row) { await check({ ...access.scope, sourceIds: [], stationIds: [], serviceIds: [], deviceIds: [], metricKeys: [], allowSiteParameters: false }); return null; }
        const m = manifest(row); assertReportScope(access.scope, m.scope);
        const state = await progress(client, access.context.workspaceId, m);
        const head = (await client.query("SELECT revision FROM bsmoss_integration.refresh_partition_head WHERE workspace_id=$1 AND id=$2", [access.context.workspaceId, m.partitionId])).rows[0];
        await check(m.scope);
        return { id, kind: "received_evidence" as const, partitionId: m.partitionId, partitionRevision: m.partitionRevision, configurationChanged: head?.revision !== m.partitionRevision,
          createdAt: row.created_at.toISOString() as string, progress: state, publishesAvailability: false as const };
      });
    },
    async retryInput(raw: { id: string; changeId: string; expectedRevision: string; reasonRef: string }) {
      const c = structuredClone(raw);
      if (!c || Object.keys(c).sort().join() !== "changeId,expectedRevision,id,reasonRef" || !/^[a-f0-9]{64}$/.test(c.id)) throw Error("invalid_update_command");
      try { jobIdentity(c.changeId); jobIdentity(c.reasonRef); positiveRevision(c.expectedRevision); } catch { throw Error("invalid_update_command"); }
      return transaction("job_recover", async (client, access, check) => {
        const row = (await client.query(select + " WHERE workspace_id=$1 AND id=$2", [access.context.workspaceId, c.id])).rows[0];
        if (!row) throw Error("update_unavailable");
        const m = manifest(row); assertReportScope(access.scope, m.scope);
        if (!m.changeIds.includes(c.changeId)) throw Error("update_unavailable");
        const binding = await loadRegisteredPartition(client, access.context.workspaceId, m.partitionId);
        if (binding.partition.revision !== m.partitionRevision || binding.partition.status !== "active") throw Error("update_configuration_changed");
        const args = [access.context.workspaceId, c.changeId, m.subscriptionSha256];
        const locked = (await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) acquired", [JSON.stringify([INPUT_REFRESH_VERSION, ...args])])).rows[0].acquired;
        if (!locked) throw Error("update_request_busy");
        const previous = (await client.query(`SELECT revision,recorded_by FROM bsmoss_analysis.input_dispatch_event
          WHERE workspace_id=$1 AND change_id=$2 AND subscription_sha256=$3 AND reason_ref=$4`, [...args, c.reasonRef])).rows[0];
        if (previous) {
          if (previous.revision !== (BigInt(c.expectedRevision) + 1n).toString() || previous.recorded_by !== access.context.sub) throw Error("conflicting_input_reopen_replay");
          await check(m.scope); return { status: "duplicate" as const };
        }
        if ((await client.query("SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE workspace_id=$1 AND change_id=$2 AND subscription_sha256=$3", args)).rowCount) throw Error("input_already_dispatched");
        const last = (await client.query(`SELECT revision,state FROM bsmoss_analysis.input_dispatch_event
          WHERE workspace_id=$1 AND change_id=$2 AND subscription_sha256=$3 ORDER BY revision DESC LIMIT 1`, args)).rows[0];
        if (!last || last.revision !== c.expectedRevision || last.state !== "quarantined") throw Error("input_dispatch_revision_conflict");
        const revision = (BigInt(c.expectedRevision) + 1n).toString(); positiveRevision(revision);
        await client.query(`INSERT INTO bsmoss_analysis.input_dispatch_event(workspace_id,change_id,subscription_sha256,revision,attempt,state,reason_ref,available_at,recorded_by,partition_id,partition_revision)
          VALUES($1,$2,$3,$4,0,'reopened',$5,clock_timestamp(),$6,$7,$8)`, [...args, revision, c.reasonRef, access.context.sub, m.partitionId, m.partitionRevision]);
        await check(m.scope); return { status: "reopened" as const };
      });
    },
  });
}
