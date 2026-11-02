import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { resolveMeasurementAccess, type AccessPorts } from "../access/resolve.ts";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { bucketFor } from "../aggregation/periods.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { fields, normalizeReportTemplate } from "./rules.ts";
import { generateReportInTransaction } from "./pg-store.ts";
import { reportSchedule, reportScheduleAccess, planReportCalendar, generationFailure, generationRetrySeconds,
  REPORT_CALENDAR_VERSION, REPORT_GENERATION_MAX_ATTEMPTS, type ReportSchedule } from "./schedule.ts";

interface ScheduleBinding { schedule: ReportSchedule; sha256: string; configSha256: string }
interface ScanManifest {
  version: typeof REPORT_CALENDAR_VERSION; scheduleId: string; scheduleRevision: string; configSha256: string; scheduleSha256: string;
  scanAt: string; scanHour: string; jobs: { id: string; period: { start: string; end: string }; dueAt: string }[];
}
export interface ReportGenerationJob {
  id: string; scheduleId: string; scheduleRevision: string; scanHour: string; period: { start: string; end: string }; dueAt: string;
  status: "pending" | "succeeded" | "dead"; attempt: number; availableAt: string;
  result: { reportId: string; revision: string; currentRevision: string; manifestSha256: string } | null;
}
async function loadSchedule(client: PoolClient, workspaceId: string, id: string): Promise<ScheduleBinding> {
  const head = (await client.query("SELECT bsmoss_integration.lock_report_schedule($1,$2)::text AS revision", [workspaceId, id])).rows[0];
  if (!head?.revision) throw Error("report_schedule_unavailable");
  const row = (await client.query(`SELECT *,config_sha256=encode(sha256(convert_to(config::text,'UTF8')),'hex') AS valid
    FROM bsmoss_integration.report_schedule_revision WHERE workspace_id=$1 AND id=$2 AND revision=$3`, [workspaceId, id, head.revision])).rows[0];
  if (!row?.valid) throw Error("invalid_report_schedule_evidence");
  const normalized = reportSchedule({ ...row.config, workspaceId, id, revision: row.revision });
  if (row.template_code !== normalized.schedule.templateCode || row.template_version !== String(normalized.schedule.templateVersion) || row.grain !== normalized.schedule.grain) throw Error("invalid_report_schedule_evidence");
  return { ...normalized, configSha256: row.config_sha256 };
}
async function reviewedTemplate(client: PoolClient, p: ReportSchedule) {
  const row = (await client.query("SELECT definition,template_kind FROM bsmoss_views.template_version WHERE workspace_id=$1 AND code=$2 AND version=$3", [p.workspaceId, p.templateCode, p.templateVersion])).rows[0];
  if (!row || row.template_kind !== "report" || fingerprintOf(row.definition) !== p.templateSha256 || normalizeReportTemplate(row.definition).grain !== p.grain) throw Error("report_schedule_template_changed");
}
function validateScan(binding: ScheduleBinding, raw: ScanManifest, sha256: string): ScanManifest {
  fields(raw, ["version", "scheduleId", "scheduleRevision", "configSha256", "scheduleSha256", "scanAt", "scanHour", "jobs"]);
  const { schedule: p } = binding, plan = planReportCalendar(p, raw.scanAt);
  if (fingerprintOf(raw) !== sha256 || raw.version !== REPORT_CALENDAR_VERSION || raw.scheduleId !== p.id || raw.scheduleRevision !== p.revision ||
      raw.configSha256 !== binding.configSha256 || raw.scheduleSha256 !== binding.sha256 || raw.scanHour !== plan.scanHour ||
      !Array.isArray(raw.jobs) || raw.jobs.length !== plan.windows.length || new Set(raw.jobs.map(j => j.id)).size !== raw.jobs.length) throw Error("invalid_report_scan_evidence");
  raw.jobs.forEach((job, i) => { fields(job, ["id", "period", "dueAt"]); jobIdentity(job.id);
    if (fingerprintOf({ period: job.period, dueAt: job.dueAt }) !== fingerprintOf(plan.windows[i])) throw Error("invalid_report_scan_evidence"); });
  return structuredClone(raw);
}
function jobOf(row: Record<string, any>, binding: ScheduleBinding): ReportGenerationJob {
  const p = binding.schedule; jobIdentity(row.id);
  const period = { start: row.period_start.toISOString(), end: row.period_end.toISOString() }, canonical = bucketFor(period.start, p.grain);
  const attempt = Number(row.attempt), result = row.result_report_id === null ? null : { reportId: row.result_report_id, revision: row.result_report_revision,
    currentRevision: row.result_current_revision, manifestSha256: row.result_manifest_sha256 };
  if (row.workspace_id !== p.workspaceId || row.schedule_id !== p.id || row.schedule_revision !== p.revision || row.schedule_sha256 !== binding.sha256 || row.grain !== p.grain ||
      row.requested_by !== p.subject || fingerprintOf(period) !== fingerprintOf(canonical) || period.start < p.notBefore ||
      row.due_at.toISOString() !== new Date(Date.parse(period.end) + p.delayMinutes * 60000).toISOString() ||
      !["pending", "succeeded", "dead"].includes(row.status) || !Number.isSafeInteger(attempt) || attempt < 0 || attempt > REPORT_GENERATION_MAX_ATTEMPTS ||
      (row.status === "succeeded") !== (result !== null)) throw Error("invalid_report_generation_job");
  if (result) { jobIdentity(result.reportId); positiveRevision(result.revision); positiveRevision(result.currentRevision); if (!/^[a-f0-9]{64}$/.test(result.manifestSha256)) throw Error("invalid_report_generation_job"); }
  return { id: row.id, scheduleId: p.id, scheduleRevision: p.revision, scanHour: row.scan_hour.toISOString(), period, dueAt: row.due_at.toISOString(),
    status: row.status, attempt, availableAt: row.available_at.toISOString(), result };
}
async function registeredTransaction<T>(pool: Pool, ports: AccessPorts, id: string,
  work: (client: PoolClient, binding: ScheduleBinding) => Promise<T>): Promise<T> {
  jobIdentity(id); const initial = await resolveMeasurementAccess(ports, "report_generate", "data"), now = ports.now ?? Date.now;
  const client = await pool.connect(); let discard = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const binding = await loadSchedule(client, initial.context.workspaceId, id);
    reportScheduleAccess(binding.schedule, initial, now());
    await reviewedTemplate(client, binding.schedule);
    const result = await work(client, binding);
    if (initial.expiresAt <= now()) throw Error("access_expired");
    reportScheduleAccess(binding.schedule, await resolveMeasurementAccess(ports, "report_generate", "data"), now());
    await client.query("COMMIT"); return result;
  } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
  finally { client.release(discard); }
}
// Only registration selectors cross this internal boundary. A future machine
// identity provider must supply current C1/C2/local grants through AccessPorts.
export async function scanRegisteredReports(pool: Pool, ports: AccessPorts, scheduleId: string) {
  return registeredTransaction(pool, ports, scheduleId, async (client, binding) => {
    const p = binding.schedule, scanAt = new Date((ports.now ?? Date.now)()).toISOString(), plan = planReportCalendar(p, scanAt);
    const prior = (await client.query(`SELECT manifest,manifest_sha256 FROM bsmoss_analysis.report_schedule_scan
      WHERE workspace_id=$1 AND schedule_id=$2 AND schedule_revision=$3 AND scan_hour=$4`, [p.workspaceId, p.id, p.revision, plan.scanHour])).rows[0];
    if (prior) return { status: "duplicate" as const, manifest: validateScan(binding, prior.manifest, prior.manifest_sha256) };
    const locked = (await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked", [JSON.stringify(["bsmoss-report-scan", p.workspaceId, p.id, p.revision, plan.scanHour])])).rows[0].locked;
    if (!locked) return { status: "busy" as const };
    const jobs: ScanManifest["jobs"] = [];
    for (const window of plan.windows) {
      const id = randomUUID();
      await client.query(`INSERT INTO bsmoss_analysis.report_generation_job(workspace_id,id,schedule_id,schedule_revision,schedule_sha256,scan_hour,grain,period_start,period_end,due_at,requested_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [p.workspaceId, id, p.id, p.revision, binding.sha256, plan.scanHour, p.grain, window.period.start, window.period.end, window.dueAt, p.subject]);
      jobs.push({ id, ...window });
    }
    const manifest: ScanManifest = { version: REPORT_CALENDAR_VERSION, scheduleId: p.id, scheduleRevision: p.revision, configSha256: binding.configSha256,
      scheduleSha256: binding.sha256, scanAt, scanHour: plan.scanHour, jobs };
    await client.query(`INSERT INTO bsmoss_analysis.report_schedule_scan(workspace_id,schedule_id,schedule_revision,scan_hour,manifest,manifest_sha256,recorded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [p.workspaceId, p.id, p.revision, plan.scanHour, JSON.stringify(manifest), fingerprintOf(manifest), p.subject]);
    return { status: "enqueued" as const, manifest };
  });
}
export async function pendingRegisteredReports(pool: Pool, ports: AccessPorts, scheduleId: string, limit = 25) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25) throw Error("invalid_report_generation_limit");
  return registeredTransaction(pool, ports, scheduleId, async (client, { schedule: p }) => {
    const rows = (await client.query(`SELECT id FROM bsmoss_analysis.report_generation_job WHERE workspace_id=$1 AND schedule_id=$2 AND schedule_revision=$3
      AND status='pending' AND available_at<=clock_timestamp() ORDER BY available_at,id LIMIT $4`, [p.workspaceId, p.id, p.revision, limit])).rows;
    return { jobIds: rows.map(row => row.id as string) };
  });
}
export async function runRegisteredReport(pool: Pool, ports: AccessPorts, scheduleId: string, jobId: string) {
  jobIdentity(jobId);
  return registeredTransaction(pool, ports, scheduleId, async (client, binding) => {
    const p = binding.schedule;
    const row = (await client.query(`SELECT *,available_at<=clock_timestamp() AS due FROM bsmoss_analysis.report_generation_job
      WHERE workspace_id=$1 AND id=$2 AND schedule_id=$3 AND schedule_revision=$4 FOR UPDATE SKIP LOCKED`, [p.workspaceId, jobId, p.id, p.revision])).rows[0];
    if (!row) return { status: "busy_or_unavailable" as const };
    const job = jobOf(row, binding), receipt = (await client.query(`SELECT manifest,manifest_sha256 FROM bsmoss_analysis.report_schedule_scan
      WHERE workspace_id=$1 AND schedule_id=$2 AND schedule_revision=$3 AND scan_hour=$4`, [p.workspaceId, p.id, p.revision, job.scanHour])).rows[0];
    if (!receipt || !validateScan(binding, receipt.manifest, receipt.manifest_sha256).jobs.some(j => j.id === job.id && fingerprintOf(j.period) === fingerprintOf(job.period) && j.dueAt === job.dueAt)) throw Error("invalid_report_generation_job");
    if (job.status !== "pending" || !row.due) return { status: job.status !== "pending" ? "terminal" as const : "delayed" as const, job };
    if (job.attempt >= REPORT_GENERATION_MAX_ATTEMPTS) throw Error("invalid_report_generation_job");
    const attempt = job.attempt + 1; let outcome: "succeeded" | "retry" | "dead", failure: string | null = null;
    let generated: Awaited<ReturnType<typeof generateReportInTransaction>> | null = null;
    await client.query("SAVEPOINT report_generation_work");
    try {
      const head = (await client.query(`SELECT current_revision FROM bsmoss_analysis.report_series
        WHERE workspace_id=$1 AND template_code=$2 AND template_version=$3 AND grain=$4 AND period_start=$5 AND period_end=$6`,
      [p.workspaceId, p.templateCode, p.templateVersion, p.grain, job.period.start, job.period.end])).rows[0];
      generated = await generateReportInTransaction(pool, p.scope, { templateCode: p.templateCode, templateVersion: p.templateVersion, at: job.period.start, expectedRevision: head?.current_revision ?? null }, p.subject, client);
      outcome = "succeeded"; await client.query("RELEASE SAVEPOINT report_generation_work");
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT report_generation_work"); failure = generationFailure(error); if (!failure) throw error;
      generated = null; outcome = attempt >= REPORT_GENERATION_MAX_ATTEMPTS ? "dead" : "retry"; await client.query("RELEASE SAVEPOINT report_generation_work");
    }
    const record = generated?.record;
    await client.query(`INSERT INTO bsmoss_analysis.report_generation_attempt(workspace_id,job_id,attempt,outcome,failure_code,generation_status,report_id,report_revision,report_current_revision,manifest_sha256,recorded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [p.workspaceId, job.id, attempt, outcome, failure, generated?.status ?? null, record?.reportId ?? null, record?.revision ?? null,
        record?.currentRevision ?? null, record?.manifestSha256 ?? null, p.subject]);
    const updated = (await client.query(`UPDATE bsmoss_analysis.report_generation_job SET status=$3,attempt=$4,available_at=clock_timestamp()+make_interval(secs=>$5),updated_at=clock_timestamp(),
      result_report_id=$6,result_report_revision=$7,result_current_revision=$8,result_manifest_sha256=$9 WHERE workspace_id=$1 AND id=$2 RETURNING *`,
    [p.workspaceId, job.id, outcome === "retry" ? "pending" : outcome, attempt, outcome === "retry" ? generationRetrySeconds(attempt) : 0,
      record?.reportId ?? null, record?.revision ?? null, record?.currentRevision ?? null, record?.manifestSha256 ?? null])).rows[0];
    return { status: outcome, job: jobOf(updated, binding), generationStatus: generated?.status ?? null };
  });
}
