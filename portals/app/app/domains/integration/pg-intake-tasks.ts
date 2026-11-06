import type { Pool, PoolClient } from "pg";
import { resolveMeasurementAccess, type AccessPorts, type MeasurementAccess } from "../access/resolve.ts";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { assertReportScope } from "../reports/rules.ts";
import { bindingRow, bindingSelect, sourceIntake, type IntakeResult } from "./pg-intake.ts";
import { sourceBinding } from "./rules.ts";
import type { SourceBinding, SourceReadPort } from "./contracts.ts";
import { INTAKE_TASK_LIMITS, intakeFailure, intakeRecoveryCommand, intakeTaskCommand, type IntakeRecoveryCommand, type IntakeTaskCommand } from "./intake-tasks.ts";

interface Task {
  id: string; binding: SourceBinding; requestedBy: string; commandId: string; createdAt: string;
}
interface Attempt {
  revision: string; attempt: number; state: "started" | IntakeResult["status"] | "failed";
  commandId: string; reasonRef: string | null; actor: string; leaseUntil: string; leaseExpired: boolean;
  receiptId: string | null; inserted: number; duplicates: number; failureCode: string | null; recordedAt: string;
}
function taskId(value: string) { if (!/^[a-f0-9]{64}$/.test(value)) throw Error("invalid_intake_task"); return value; }
// No worker identity, production adapter or browser write route is activated.
// The internal caller starts one bounded attempt; the journal survives its exit.
export function sourceIntakeTasks(pool: Pool, ports: AccessPorts, connector: SourceReadPort) {
  const now = ports.now ?? Date.now;
  async function check(first: MeasurementAccess, binding: SourceBinding, operation: "ingest" | "job_view" | "job_recover" = "ingest") {
    const current = await resolveMeasurementAccess(ports, operation, operation === "ingest" ? "data" : "interactive");
    if (first.expiresAt <= now() || current.context.workspaceId !== first.context.workspaceId || current.context.sub !== first.context.sub) throw Error("access_expired");
    assertReportScope(current.scope, binding.scope);
  }
  async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
    const c = await pool.connect(); let discard = false;
    try {
      await c.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      await c.query("SET LOCAL statement_timeout='15s'"); await c.query("SET LOCAL lock_timeout='5s'");
      const result = await work(c); await c.query("COMMIT"); return result;
    } catch (e) { try { await c.query("ROLLBACK"); } catch { discard = true; } throw e; }
    finally { c.release(discard); }
  }
  async function load(c: PoolClient, workspaceId: string, id: string): Promise<Task> {
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
  async function history(c: PoolClient, workspaceId: string, id: string): Promise<Attempt[]> {
    const rows = (await c.query(`SELECT *,lease_until<=clock_timestamp() expired FROM bsmoss_integration.source_intake_task_event
      WHERE workspace_id=$1 AND task_id=$2 ORDER BY revision LIMIT 11`, [workspaceId, id])).rows;
    if (!rows.length || rows.length > 10) throw Error("invalid_intake_task_evidence");
    return rows.map((r, i) => {
      if (r.revision !== String(i + 1)) throw Error("invalid_intake_task_evidence");
      return { revision: r.revision, attempt: r.attempt, state: r.state, commandId: r.command_id, reasonRef: r.reason_ref,
        actor: r.actor, leaseUntil: r.lease_until.toISOString(), leaseExpired: r.expired, receiptId: r.receipt_id,
        inserted: r.inserted, duplicates: r.duplicates, failureCode: r.failure_code, recordedAt: r.recorded_at.toISOString() };
    });
  }
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
  const view = (t: Task, events: Attempt[]) => ({ id: t.id, bindingId: t.binding.id, bindingRevision: t.binding.revision, createdAt: t.createdAt,
    latest: events.at(-1)!, attempts: events, publishesAvailability: false as const });
  async function fence(c: PoolClient, first: MeasurementAccess, t: Task, expected: Attempt, terminal = false) {
    const e = (await history(c, first.context.workspaceId, t.id)).at(-1)!;
    if (e.revision !== (terminal ? String(BigInt(expected.revision) + 1n) : expected.revision) || e.attempt !== expected.attempt ||
        e.commandId !== expected.commandId || e.actor !== first.context.sub || e.leaseExpired || (!terminal && e.state !== "started")) throw Error("intake_task_lease_lost");
    return e;
  }
  async function execute(first: MeasurementAccess, t: Task, attempt: Attempt, parent?: AbortSignal) {
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
    return transaction(async c => { const events = await history(c, first.context.workspaceId, t.id); await check(first, t.binding); return view(t, events); });
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
          assertReportScope(first.scope, t.binding.scope); const events = await history(c, workspaceId, id); await check(first, t.binding);
          return { t, events, execute: false };
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
        const events = await history(c, workspaceId, id); await check(first, b); return { t, events, execute: true };
      });
      return claim.execute ? execute(first, claim.t, claim.events.at(-1)!, signal) : view(claim.t, claim.events);
    },
    async read(id: string) {
      taskId(id); const first = await resolveMeasurementAccess(ports, "job_view", "interactive");
      return transaction(async c => {
        const t = await load(c, first.context.workspaceId, id); assertReportScope(first.scope, t.binding.scope);
        const events = await history(c, first.context.workspaceId, id); await check(first, t.binding, "job_view"); return view(t, events);
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
          await check(first, b); await check(first, b, "job_recover"); return { t, events, execute: false };
        }
        if (current.revision !== command.expectedRevision) throw Error("intake_task_revision_conflict");
        if (current.state !== "failed" && !(current.state === "started" && current.leaseExpired)) throw Error("intake_task_not_recoverable");
        if (current.attempt >= INTAKE_TASK_LIMITS.attempts) throw Error("intake_task_attempt_limit");
        await append(c, first, t, { ...current, revision: String(BigInt(current.revision) + 1n), attempt: current.attempt + 1, state: "started", commandId: command.commandId,
          reasonRef: command.reasonRef, actor: first.context.sub, receiptId: null, inserted: 0, duplicates: 0, failureCode: null });
        const next = await history(c, workspaceId, t.id);
        await check(first, b); await check(first, b, "job_recover");
        return { t, events: next, execute: true };
      });
      return claim.execute ? execute(first, claim.t, claim.events.at(-1)!, signal) : view(claim.t, claim.events);
    },
  });
}
