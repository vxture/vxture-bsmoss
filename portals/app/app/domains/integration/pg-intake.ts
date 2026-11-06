import type { Pool, PoolClient } from "pg";
import { resolveMeasurementAccess, type AccessPorts, type MeasurementAccess } from "../access/resolve.ts";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { PgMeasurementStore } from "../measurements/pg-store.ts";
import { assertReportScope } from "../reports/rules.ts";
import type { PullPlan, SourceBinding, SourcePosition, SourceReadPort, SourceClaim } from "./contracts.ts";
import { exactFields, planSourcePull, sourceBinding, sourceHead, sourcePosition } from "./rules.ts";
import { prepareSourceUpdate } from "./service.ts";

export interface IntakeResult {
  status: "received" | "duplicate" | "current"; receiptId: string | null; inserted: number; duplicates: number;
  publishesAvailability: false;
}
// Internal transaction participant, never accepted from a browser or adapter.
export interface IntakeLifecycle {
  bindingSha256: string;
  beforeWrite(client: PoolClient): Promise<void>;
  complete(client: PoolClient, result: IntakeResult): Promise<void>;
  verify(client: PoolClient): Promise<void>;
}
interface IntakeManifest {
  version: "source-intake-v1"; plan: PullPlan; previousId: string | null;
  inputPosition: SourcePosition | null; position: SourcePosition;
  recordsSha256: string; records: { id: string; sha256: string }[];
  inserted: number; duplicates: number; unverifiedCompletionClaim: SourceClaim | null;
}
export const bindingSelect = `SELECT b.*,b.database_sha256=encode(sha256(convert_to(b.binding::text,'UTF8')),'hex') AS valid
  FROM bsmoss_integration.source_binding_revision b`;
const receiptSelect = `SELECT r.*,r.database_sha256=encode(sha256(convert_to(r.manifest::text,'UTF8')),'hex') AS valid,
  b.binding AS registered_binding,b.binding_sha256 AS registered_sha256,
  b.database_sha256=encode(sha256(convert_to(b.binding::text,'UTF8')),'hex') AS binding_valid
  FROM bsmoss_integration.source_intake_receipt r JOIN bsmoss_integration.source_binding_revision b
    ON (b.workspace_id,b.id,b.revision)=(r.workspace_id,r.binding_id,r.binding_revision)`;
export function bindingRow(row: Record<string, any> | undefined): SourceBinding {
  if (!row) throw Error("source_binding_unavailable");
  const b = sourceBinding(row.binding);
  if (row.valid !== true || fingerprintOf(b) !== row.binding_sha256 || b.id !== row.id || b.revision !== row.revision || b.sourceId !== row.source_id || b.scope.workspaceId !== row.workspace_id) throw Error("invalid_source_registration");
  if (row.status !== "active") throw Error("source_binding_paused");
  return b;
}
function receiptRow(row: Record<string, any>) {
  const b = sourceBinding(row.registered_binding), m = row.manifest as IntakeManifest;
  exactFields(m, ["version", "plan", "previousId", "inputPosition", "position", "recordsSha256", "records", "inserted", "duplicates", "unverifiedCompletionClaim"]);
  positiveRevision(row.sequence);
  if (row.valid !== true || row.binding_valid !== true || fingerprintOf(b) !== row.registered_sha256 || m.version !== "source-intake-v1" ||
      fingerprintOf(m) !== row.manifest_sha256 || m.previousId !== row.previous_id || b.id !== row.binding_id || b.revision !== row.binding_revision || b.scope.workspaceId !== row.workspace_id ||
      !/^[a-f0-9]{64}$/.test(m.recordsSha256) || !Array.isArray(m.records) || m.records.length > 4096 ||
      !Number.isSafeInteger(m.inserted) || m.inserted < 0 || !Number.isSafeInteger(m.duplicates) || m.duplicates < 0 || m.inserted + m.duplicates !== m.records.length) throw Error("invalid_intake_receipt");
  for (const record of m.records) {
    exactFields(record, ["id", "sha256"]);
    if (!/^[a-f0-9-]{36}$/.test(record.id) || !/^[a-f0-9]{64}$/.test(record.sha256)) throw Error("invalid_intake_receipt");
  }
  if (new Set(m.records.map(r => r.id)).size !== m.records.length) throw Error("invalid_intake_receipt");
  const h = sourceHead({ sourceId: b.sourceId, snapshotId: m.plan.snapshotId, dataRevision: m.plan.dataRevision,
    availableThrough: m.plan.to, changeCursor: m.plan.changesThrough, completionClaim: null });
  const p = planSourcePull(b, h, m.inputPosition, Date.parse(m.plan.to));
  const position = sourcePosition(m.position);
  if (m.unverifiedCompletionClaim !== null) {
    // The original claim may include the still-open part of an hour, so keep
    // its exact source boundary while retaining only the closed input cursor.
    sourceHead({ ...h, availableThrough: m.unverifiedCompletionClaim.through > h.availableThrough! ? m.unverifiedCompletionClaim.through : h.availableThrough,
      completionClaim: m.unverifiedCompletionClaim });
  }
  if (p.state !== "pull" || fingerprintOf(p) !== fingerprintOf(m.plan) ||
      fingerprintOf(position) !== fingerprintOf({ bindingSha256: p.bindingSha256, through: p.to, dataRevision: p.dataRevision, changeCursor: p.changesThrough }) ||
      row.id !== fingerprintOf(["source-intake-v1", row.workspace_id, row.binding_id, p.id])) throw Error("invalid_intake_receipt");
  // A source claim remains opaque evidence, never a completion authorization.
  return { id: row.id as string, sequence: row.sequence as string, manifest: m, binding: b };
}

/** Internal server composition. No browser route or autonomous machine ingest
 * is enabled. Network preparation happens outside the bounded DB transaction. */
export function sourceIntake(pool: Pool, ports: AccessPorts, connector: SourceReadPort) {
  const now = ports.now ?? Date.now;
  async function check(first: MeasurementAccess, binding: SourceBinding) {
    const current = await resolveMeasurementAccess(ports, "ingest", "data");
    if (first.expiresAt <= now() || current.context.sub !== first.context.sub || current.context.workspaceId !== first.context.workspaceId) throw Error("access_expired");
    assertReportScope(current.scope, binding.scope);
  }
  async function latest(client: PoolClient, workspaceId: string, id: string) {
    const row = (await client.query(receiptSelect + " WHERE r.workspace_id=$1 AND r.binding_id=$2 ORDER BY r.sequence DESC LIMIT 1", [workspaceId, id])).rows[0];
    return row ? receiptRow(row) : null;
  }
  return Object.freeze({ async receive(bindingId: string, signal?: AbortSignal, lifecycle?: IntakeLifecycle) {
    jobIdentity(bindingId); signal?.throwIfAborted();
    const first = await resolveMeasurementAccess(ports, "ingest", "data"), workspaceId = first.context.workspaceId;
    const reader = await pool.connect(); let binding: SourceBinding, prior: Awaited<ReturnType<typeof latest>>;
    try {
      binding = bindingRow((await reader.query(bindingSelect + " JOIN bsmoss_integration.source_binding_head h ON (h.workspace_id,h.id,h.revision)=(b.workspace_id,b.id,b.revision) WHERE b.workspace_id=$1 AND b.id=$2", [workspaceId, bindingId])).rows[0]);
      if (lifecycle && fingerprintOf(binding) !== lifecycle.bindingSha256) throw Error("source_configuration_changed");
      assertReportScope(first.scope, binding.scope); prior = await latest(reader, workspaceId, bindingId);
      // Permission to a new/narrower configuration never exposes old receipts.
      if (prior) assertReportScope(first.scope, prior.binding.scope);
      await check(first, binding);
    } finally { reader.release(); }
    const prepared = await prepareSourceUpdate(ports, connector, binding, prior?.manifest.position ?? null, signal);
    await check(first, binding); signal?.throwIfAborted();
    const client = await pool.connect(); let discard = false;
    const commitStarted = performance.now();
    const assertLive = () => {
      signal?.throwIfAborted();
      if (first.expiresAt <= now()) throw Error("access_expired");
      if (performance.now() - commitStarted > 60000) throw Error("source_commit_timeout");
    };
    try {
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      await client.query("SET LOCAL statement_timeout='15s'");
      await client.query("SET LOCAL lock_timeout='5s'");
      const locked = (await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) acquired", [JSON.stringify(["source-intake-v1", workspaceId, bindingId])])).rows[0].acquired;
      if (!locked) throw Error("source_intake_busy");
      const revision = (await client.query("SELECT bsmoss_integration.lock_source_binding($1,$2) revision", [workspaceId, bindingId])).rows[0].revision;
      if (revision !== binding.revision) throw Error("source_configuration_changed");
      const currentBinding = bindingRow((await client.query(bindingSelect + " WHERE b.workspace_id=$1 AND b.id=$2 AND b.revision=$3", [workspaceId, bindingId, revision])).rows[0]);
      if (fingerprintOf(currentBinding) !== fingerprintOf(binding)) throw Error("source_configuration_changed");
      await lifecycle?.beforeWrite(client);
      const current = await latest(client, workspaceId, bindingId);
      if (current) { assertReportScope(first.scope, current.binding.scope); await check(first, current.binding); }
      const id = fingerprintOf(["source-intake-v1", workspaceId, bindingId, prepared.plan.id]);
      const existing = (await client.query(receiptSelect + " WHERE r.workspace_id=$1 AND r.id=$2", [workspaceId, id])).rows[0];
      let result: { status: "received" | "duplicate" | "current"; receiptId: string | null; inserted: number; duplicates: number };
      if (existing) {
        const saved = receiptRow(existing);
        if (saved.manifest.recordsSha256 !== prepared.recordsSha256 || fingerprintOf(saved.manifest.unverifiedCompletionClaim) !== fingerprintOf(prepared.unverifiedCompletionClaim)) throw Error("source_conflicting_replay");
        if (current?.id !== saved.id) throw Error("source_position_changed");
        result = { status: "duplicate", receiptId: saved.id, inserted: saved.manifest.inserted, duplicates: saved.manifest.duplicates };
      } else {
        if ((current?.id ?? null) !== (prior?.id ?? null)) throw Error("source_position_changed");
        if (prepared.state === "current") result = { status: "current", receiptId: current?.id ?? null, inserted: 0, duplicates: 0 };
        else {
          const writer = new PgMeasurementStore(pool, binding.scope, FIRST_METRICS), records: IntakeManifest["records"] = []; let inserted = 0;
          // A source may page later revisions before their predecessor. The
          // immutable raw-event FK must still see each earlier revision first.
          const writeRecords = [...prepared.records].sort((a, b) => a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 :
            BigInt(a.revision) < BigInt(b.revision) ? -1 : BigInt(a.revision) > BigInt(b.revision) ? 1 :
              fingerprintOf(a) < fingerprintOf(b) ? -1 : fingerprintOf(a) > fingerprintOf(b) ? 1 : 0);
          for (const record of writeRecords) {
            assertLive();
            if (records.length % 32 === 0) await check(first, binding);
            const stored = await writer.appendInTransaction(client, { ...record, workspaceId,
              quality: { ...record.quality, decidedBy: first.context.sub } }, { preservePendingIntakeActor: true });
            if (stored.status === "inserted") inserted++;
            records.push({ id: stored.id, sha256: fingerprintOf(record) });
          }
          const sequence = (BigInt(current?.sequence ?? "0") + 1n).toString(); positiveRevision(sequence);
          const manifest: IntakeManifest = { version: "source-intake-v1", plan: prepared.plan, previousId: current?.id ?? null, inputPosition: prior?.manifest.position ?? null,
            position: { bindingSha256: prepared.plan.bindingSha256, through: prepared.plan.to, dataRevision: prepared.plan.dataRevision, changeCursor: prepared.plan.changesThrough },
            recordsSha256: prepared.recordsSha256, records, inserted, duplicates: records.length - inserted, unverifiedCompletionClaim: prepared.unverifiedCompletionClaim };
          await client.query(`INSERT INTO bsmoss_integration.source_intake_receipt(workspace_id,id,binding_id,binding_revision,sequence,previous_id,manifest,manifest_sha256,database_sha256,received_by)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,encode(sha256(convert_to($7::jsonb::text,'UTF8')),'hex'),$9)`,
          [workspaceId, id, bindingId, binding.revision, sequence, manifest.previousId, manifest, fingerprintOf(manifest), first.context.sub]);
          result = { status: "received", receiptId: id, inserted, duplicates: manifest.duplicates };
        }
      }
      assertLive(); await check(first, binding);
      await lifecycle?.complete(client, { ...result, publishesAvailability: false });
      assertLive(); await check(first, binding);
      await lifecycle?.verify(client);
      await client.query("COMMIT"); return { ...result, publishesAvailability: false as const };
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  } });
}
