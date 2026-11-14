import type { Pool, PoolClient } from "pg";
import { resolveMeasurementAccess, type AccessPorts, type MeasurementAccess } from "../access/resolve.ts";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { assertReportScope, unionReportScopes } from "../reports/rules.ts";
import { decodeJobCursor, encodeJobCursor } from "../supervision/jobs.ts";
import { bindingRow, bindingSelect, sourceIntake } from "./pg-intake.ts";
import { sourceBinding } from "./rules.ts";
import type { SourceBinding, SourceReadPort } from "./contracts.ts";
import { INTAKE_TASK_LIMITS, intakeFailure, intakeRecoveryCommand, intakeTerminationCommand, intakeTaskCommand, type IntakeRecoveryCommand, type IntakeTaskCommand } from "./intake-tasks.ts";
import { intakeListQuery, type IntakeListQuery } from "./intake-queries.ts";
import type { IntakeEvent, IntakeDetail, IntakeSummary, IntakeList, IntakeReviewCommand } from "./intake-contracts.ts";

interface Task {
  id: string; binding: SourceBinding; requestedBy: string; commandId: string; createdAt: string;
}
type Attempt = IntakeEvent;
function taskId(value: string) { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw Error("invalid_intake_task"); return value; }
export async function readIntakeTaskEvidence(c: PoolClient, workspaceId: string, id: string): Promise<Task> {
  const r = (await c.query(`SELECT t.*,b.binding,b.binding_sha256 registered_sha,
    b.database_sha256=encode(sha256(convert_to(b.binding::text,'UTF8')),'hex') valid
    FROM bsmoss_integration.source_intake_task t JOIN bsmoss_integration.source_binding_revision b
    ON (b.workspace_id,b.id,b.revision)=(t.workspace_id,t.binding_id,t.binding_revision)
    WHERE t.workspace_id=$1 AND t.id=$2`, [workspaceId, id])).rows[0];
  if (!r) throw Error("intake_task_unavailable");
  const binding = sourceBinding(r.binding);
  if (!r.valid || fingerprintOf(binding) !== r.registered_sha || r.registered_sha !== r.binding_sha256 || binding.scope.workspaceId !== workspaceId ||
      r.id !== fingerprintOf(["source-intake-task-v1", workspaceId, r.command_id]) || r.binding_id !== binding.id || r.binding_revision !== binding.revision) throw Error("invalid_intake_task_evidence");
  return { id, binding, requestedBy: r.requested_by, commandId: r.command_id, createdAt: r.created_at.toISOString() };
}
export async function readIntakeTaskHistory(c: PoolClient, workspaceId: string, id: string): Promise<Attempt[]> {
  const rows = (await c.query(`SELECT *,lease_until<=clock_timestamp() expired FROM bsmoss_integration.source_intake_task_event
    WHERE workspace_id=$1 AND task_id=$2 ORDER BY revision LIMIT 12`, [workspaceId, id])).rows;
  if (!rows.length || rows.length > 11) throw Error("invalid_intake_task_evidence");
  return rows.map((r, i) => {
    if (r.revision !== String(i + 1)) throw Error("invalid_intake_task_evidence");
    return { revision: r.revision, attempt: r.attempt, state: r.state, commandId: r.command_id, reasonRef: r.reason_ref,
      actor: r.actor, leaseUntil: r.lease_until.toISOString(), leaseExpired: r.expired, receiptId: r.receipt_id,
      inserted: r.inserted, duplicates: r.duplicates, failureCode: r.failure_code, recordedAt: r.recorded_at.toISOString() };
  });
}

// No worker identity, production adapter or browser execution route is activated.
// The internal caller starts one bounded attempt; the journal survives its exit.
export function sourceIntakeTasks(pool: Pool, ports: AccessPorts, connector: SourceReadPort) {
  return intakeTaskStore(pool, ports, connector);
}
// Formal session composition deliberately exposes no adapter execution methods.
export function sourceIntakeTaskSupervision(pool: Pool, ports: AccessPorts) {
  const { read, list, terminate } = intakeTaskStore(pool, ports);
  return Object.freeze({ read, list, terminate });
}
function intakeTaskStore(pool: Pool, ports: AccessPorts, connector?: SourceReadPort) {
  const now = ports.now ?? Date.now;
  async function check(first: MeasurementAccess, binding: Pick<SourceBinding, "scope">, operation: "ingest" | "job_view" | "job_recover" = "ingest") {
    const current = await resolveMeasurementAccess(ports, operation, operation === "ingest" ? "data" : "interactive");
    if (first.expiresAt <= now() || current.context.workspaceId !== first.context.workspaceId || current.context.sub !== first.context.sub) throw Error("access_expired");
    assertReportScope(current.scope, binding.scope);
  }
  async function transaction<T>(work: (client: PoolClient) => Promise<T>, repeatable = false) {
    const c = await pool.connect(); let discard = false;
    try {
      await c.query(repeatable ? "BEGIN ISOLATION LEVEL REPEATABLE READ" : "BEGIN ISOLATION LEVEL READ COMMITTED");
      await c.query("SET LOCAL statement_timeout='15s'"); await c.query("SET LOCAL lock_timeout='5s'");
      const result = await work(c); await c.query("COMMIT"); return result;
    } catch (e) { try { await c.query("ROLLBACK"); } catch { discard = true; } throw e; }
    finally { c.release(discard); }
  }
  const load = readIntakeTaskEvidence, history = readIntakeTaskHistory;
  async function lock(c: PoolClient, workspaceId: string, id: string) {
    if (!(await c.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) acquired", [JSON.stringify(["source-intake-task-v1", workspaceId, id])])).rows[0].acquired) throw Error("intake_task_busy");
    await c.query("SELECT bsmoss_integration.lock_intake_task($1,$2)", [workspaceId, id]);
  }
  async function currentBinding(c: PoolClient, workspaceId: string, id: string) {
    const revision = (await c.query("SELECT bsmoss_integration.lock_source_binding($1,$2) revision", [workspaceId, id])).rows[0].revision;
    return bindingRow((await c.query(bindingSelect + " WHERE b.workspace_id=$1 AND b.id=$2 AND b.revision=$3", [workspaceId, id, revision])).rows[0]);
  }
  async function append(c: PoolClient, first: MeasurementAccess, t: Task, event: Omit<Attempt, "leaseExpired" | "recordedAt">) {
    positiveRevision(event.revision);
    await c.query(`INSERT INTO bsmoss_integration.source_intake_task_event(workspace_id,task_id,revision,attempt,state,command_id,reason_ref,actor,lease_until,receipt_id,inserted,duplicates,failure_code)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [first.context.workspaceId, t.id, event.revision, event.attempt, event.state, event.commandId,
      event.reasonRef, event.actor, event.leaseUntil, event.receiptId, event.inserted, event.duplicates, event.failureCode]);
  }
  const view = async (c: PoolClient, workspaceId: string, t: Task, events: Attempt[]): Promise<IntakeDetail> => {
    const head = (await c.query(`SELECT h.revision,b.status FROM bsmoss_integration.source_binding_head h
      JOIN bsmoss_integration.source_binding_revision b ON (b.workspace_id,b.id,b.revision)=(h.workspace_id,h.id,h.revision)
      WHERE h.workspace_id=$1 AND h.id=$2`, [workspaceId, t.binding.id])).rows[0];
    return { id: t.id, kind: "source_intake", bindingId: t.binding.id, bindingRevision: t.binding.revision, createdAt: t.createdAt,
      configurationChanged: head?.revision !== t.binding.revision, configurationPaused: head?.status !== "active",
      latest: events.at(-1)!, attempts: events, publishesAvailability: false };
  };
  async function fence(c: PoolClient, first: MeasurementAccess, t: Task, expected: Attempt, terminal = false) {
    const e = (await history(c, first.context.workspaceId, t.id)).at(-1)!;
    if (e.revision !== (terminal ? String(BigInt(expected.revision) + 1n) : expected.revision) || e.attempt !== expected.attempt ||
        e.commandId !== expected.commandId || e.actor !== first.context.sub || e.leaseExpired || (!terminal && e.state !== "started")) throw Error("intake_task_lease_lost");
    return e;
  }
  async function execute(first: MeasurementAccess, t: Task, attempt: Attempt, parent?: AbortSignal) {
    if (!connector) throw Error("source_adapter_unavailable");
    const signal = AbortSignal.any([AbortSignal.timeout(INTAKE_TASK_LIMITS.runMs), ...(parent ? [parent] : [])]);
    const pinnedPorts: AccessPorts = { ...ports, async readVerifiedIdentity() {
      const identity = await ports.readVerifiedIdentity();
      if (!identity || first.expiresAt <= now() || identity.sub !== first.context.sub || identity.activeWorkspace !== first.context.workspaceId) throw Error("access_expired");
      return identity;
    } };
    try {
      await sourceIntake(pool, pinnedPorts, connector).receive(t.binding.id, signal, {
        bindingSha256: fingerprintOf(t.binding),
        async beforeWrite(c) { await lock(c, first.context.workspaceId, t.id); await fence(c, first, t, attempt); await check(first, t.binding); },
        async complete(c, result) {
          await fence(c, first, t, attempt); await check(first, t.binding);
          await append(c, first, t, { ...attempt, revision: String(BigInt(attempt.revision) + 1n), state: result.status,
            receiptId: result.receiptId, inserted: result.inserted, duplicates: result.duplicates, failureCode: null });
          await check(first, t.binding);
        },
        async verify(c) { await fence(c, first, t, attempt, true); await check(first, t.binding); await fence(c, first, t, attempt, true); },
      });
    } catch (error) {
      // COMMIT can succeed even when its acknowledgment is lost. Re-read under
      // the same fence before recording a failure; a durable success wins.
      await transaction(async c => {
        await lock(c, first.context.workspaceId, t.id); await check(first, t.binding);
        const current = (await history(c, first.context.workspaceId, t.id)).at(-1)!;
        if (current.revision !== attempt.revision || current.state !== "started" || current.leaseExpired) return;
        await fence(c, first, t, attempt);
        await append(c, first, t, { ...attempt, revision: String(BigInt(attempt.revision) + 1n), state: "failed", receiptId: null,
          inserted: 0, duplicates: 0, failureCode: intakeFailure(error, signal.aborted) });
        await check(first, t.binding);
      });
    }
    return transaction(async c => { const events = await history(c, first.context.workspaceId, t.id), result = await view(c, first.context.workspaceId, t, events); await check(first, t.binding); return result; }, true);
  }
  return Object.freeze({
    async run(raw: IntakeTaskCommand, signal?: AbortSignal) {
      const command = intakeTaskCommand(raw); signal?.throwIfAborted();
      const first = await resolveMeasurementAccess(ports, "ingest", "data"), workspaceId = first.context.workspaceId;
      const id = fingerprintOf(["source-intake-task-v1", workspaceId, command.commandId]);
      const claim = await transaction(async c => {
        // Serialize creation per binding; a new command cannot bypass an
        // unresolved failed/expired attempt. Exact command replay is read-only.
        const acquired = (await c.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) acquired", [JSON.stringify(["source-intake-task-binding-v1", workspaceId, command.bindingId])])).rows[0].acquired;
        if (!acquired) throw Error("intake_task_busy");
        if ((await c.query("SELECT 1 FROM bsmoss_integration.source_intake_task WHERE workspace_id=$1 AND id=$2", [workspaceId, id])).rowCount) {
          const t = await load(c, workspaceId, id);
          if (t.binding.id !== command.bindingId || t.requestedBy !== first.context.sub) throw Error("conflicting_intake_command");
          assertReportScope(first.scope, t.binding.scope); const events = await history(c, workspaceId, id), saved = await view(c, workspaceId, t, events); await check(first, t.binding);
          return { t, events, execute: false, saved };
        }
        const b = await currentBinding(c, workspaceId, command.bindingId); assertReportScope(first.scope, b.scope);
        const unresolved = await c.query(`SELECT 1 FROM bsmoss_integration.source_intake_task t JOIN LATERAL
          (SELECT state FROM bsmoss_integration.source_intake_task_event WHERE workspace_id=t.workspace_id AND task_id=t.id ORDER BY revision DESC LIMIT 1) e ON true
          WHERE t.workspace_id=$1 AND t.binding_id=$2 AND e.state IN ('started','failed') LIMIT 1`, [workspaceId, b.id]);
        if (unresolved.rowCount) throw Error("intake_task_active");
        await c.query(`INSERT INTO bsmoss_integration.source_intake_task(workspace_id,id,command_id,binding_id,binding_revision,binding_sha256,requested_by)
          VALUES($1,$2,$3,$4,$5,$6,$7)`, [workspaceId, id, command.commandId, b.id, b.revision, fingerprintOf(b), first.context.sub]);
        const t = await load(c, workspaceId, id);
        await append(c, first, t, { revision: "1", attempt: 1, state: "started", commandId: command.commandId, reasonRef: null,
          actor: first.context.sub, leaseUntil: new Date(now()).toISOString(), receiptId: null, inserted: 0, duplicates: 0, failureCode: null });
        const events = await history(c, workspaceId, id); await check(first, b); return { t, events, execute: true, saved: null };
      });
      return claim.execute ? execute(first, claim.t, claim.events.at(-1)!, signal) : claim.saved!;
    },
    async read(id: string) {
      taskId(id); const first = await resolveMeasurementAccess(ports, "job_view", "interactive");
      return transaction(async c => {
        const t = await load(c, first.context.workspaceId, id); assertReportScope(first.scope, t.binding.scope);
        const events = await history(c, first.context.workspaceId, id), result = await view(c, first.context.workspaceId, t, events);
        await check(first, t.binding, "job_view"); return result;
      }, true);
    },
    async list(raw: IntakeListQuery): Promise<IntakeList> {
      const q = intakeListQuery(raw), cursor = q.after ? decodeJobCursor(q.after) : null;
      const first = await resolveMeasurementAccess(ports, "job_view", "interactive"), s = first.scope;
      return transaction(async c => {
        // Filter the entire immutable original scope before LIMIT, including
        // the lookahead row. A narrow grant must not observe partial tasks.
        const rows = (await c.query(`SELECT t.id,to_char(t.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') created_cursor
          FROM bsmoss_integration.source_intake_task t JOIN bsmoss_integration.source_binding_revision b
          ON (b.workspace_id,b.id,b.revision)=(t.workspace_id,t.binding_id,t.binding_revision)
          WHERE t.workspace_id=$1 AND b.binding->'scope'->'sourceIds' <@ to_jsonb($2::text[])
          AND b.binding->'scope'->'stationIds' <@ to_jsonb($3::text[]) AND b.binding->'scope'->'serviceIds' <@ to_jsonb($4::text[])
          AND b.binding->'scope'->'deviceIds' <@ to_jsonb($5::text[]) AND b.binding->'scope'->'metricKeys' <@ to_jsonb($6::text[])
          AND (b.binding->'scope'->>'allowSiteParameters'='false' OR $7::boolean)
          AND ($8::timestamptz IS NULL OR t.created_at<$8 OR (t.created_at=$8 AND t.id COLLATE "C"<$9))
          ORDER BY t.created_at DESC,t.id COLLATE "C" DESC LIMIT $10`,
        [s.workspaceId, s.sourceIds, s.stationIds, s.serviceIds, s.deviceIds, s.metricKeys, s.allowSiteParameters, cursor?.createdAt ?? null, cursor?.jobId ?? null, q.limit + 1])).rows;
        const tasks: Task[] = [], items: IntakeSummary[] = [];
        for (const row of rows) {
          const t = await load(c, s.workspaceId, row.id); assertReportScope(s, t.binding.scope); tasks.push(t);
          const events = await history(c, s.workspaceId, t.id), { attempts: _history, ...item } = await view(c, s.workspaceId, t, events);
          if (items.length < q.limit) items.push(item);
        }
        const last = rows[q.limit - 1], next = rows.length > q.limit ? encodeJobCursor({ createdAt: last.created_cursor, jobId: last.id, status: "all" }) : null;
        await check(first, { scope: unionReportScopes(s.workspaceId, tasks.map(t => t.binding.scope)) }, "job_view");
        return { items, next };
      }, true);
    },
    async terminate(raw: IntakeReviewCommand) {
      const command = intakeTerminationCommand(raw), first = await resolveMeasurementAccess(ports, "job_recover", "interactive"), workspaceId = first.context.workspaceId;
      return transaction(async c => {
        const t = await load(c, workspaceId, command.taskId); assertReportScope(first.scope, t.binding.scope);
        // Only the original scope is affected. A paused/replaced registration
        // must remain disposable without granting access to its replacement.
        await lock(c, workspaceId, t.id);
        const events = await history(c, workspaceId, t.id), current = events.at(-1)!;
        const prior = events.find(e => e.commandId === command.commandId);
        if (prior) {
          if (prior.state !== "terminated" || prior.revision !== String(BigInt(command.expectedRevision) + 1n) || prior.reasonRef !== command.reasonRef || prior.actor !== first.context.sub) throw Error("conflicting_intake_termination");
        } else {
          if (current.revision !== command.expectedRevision) throw Error("intake_task_revision_conflict");
          if (!["started", "failed"].includes(current.state)) throw Error("intake_task_not_terminable");
          await append(c, first, t, { ...current, revision: String(BigInt(current.revision) + 1n), state: "terminated",
            commandId: command.commandId, reasonRef: command.reasonRef, actor: first.context.sub, receiptId: null, inserted: 0, duplicates: 0, failureCode: null });
        }
        const result = await view(c, workspaceId, t, await history(c, workspaceId, t.id));
        await check(first, t.binding, "job_recover"); return result;
      });
    },
    async recover(raw: IntakeRecoveryCommand, signal?: AbortSignal) {
      const command = intakeRecoveryCommand(raw); signal?.throwIfAborted();
      const first = await resolveMeasurementAccess(ports, "ingest", "data"), workspaceId = first.context.workspaceId;
      const claim = await transaction(async c => {
        const t = await load(c, workspaceId, command.taskId); assertReportScope(first.scope, t.binding.scope);
        await check(first, t.binding, "job_recover");
        const b = await currentBinding(c, workspaceId, t.binding.id);
        if (fingerprintOf(b) !== fingerprintOf(t.binding)) throw Error("source_configuration_changed");
        await lock(c, workspaceId, t.id);
        const events = await history(c, workspaceId, t.id), current = events.at(-1)!;
        const prior = events.find(e => e.state === "started" && e.commandId === command.commandId);
        if (prior) {
          if (prior.revision !== String(BigInt(command.expectedRevision) + 1n) || prior.reasonRef !== command.reasonRef || prior.actor !== first.context.sub) throw Error("conflicting_intake_recovery");
          const saved = await view(c, workspaceId, t, events);
          await check(first, b); await check(first, b, "job_recover"); return { t, events, execute: false, saved };
        }
        if (current.revision !== command.expectedRevision) throw Error("intake_task_revision_conflict");
        if (current.state !== "failed" && !(current.state === "started" && current.leaseExpired)) throw Error("intake_task_not_recoverable");
        if (current.attempt >= INTAKE_TASK_LIMITS.attempts) throw Error("intake_task_attempt_limit");
        await append(c, first, t, { ...current, revision: String(BigInt(current.revision) + 1n), attempt: current.attempt + 1, state: "started", commandId: command.commandId,
          reasonRef: command.reasonRef, actor: first.context.sub, receiptId: null, inserted: 0, duplicates: 0, failureCode: null });
        const next = await history(c, workspaceId, t.id);
        await check(first, b); await check(first, b, "job_recover");
        return { t, events: next, execute: true, saved: null };
      });
      return claim.execute ? execute(first, claim.t, claim.events.at(-1)!, signal) : claim.saved!;
    },
  });
}
