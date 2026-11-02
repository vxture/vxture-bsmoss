import type { Pool, PoolClient } from "pg";
import type { AccessPorts } from "../access/resolve.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { bucketFor } from "../aggregation/periods.ts";
import { registeredTransaction, readReportScheduleRevision } from "./pg-schedule.ts";
import { generateReportInTransaction, readReportInTransaction, readStoredReportInTransaction } from "./pg-store.ts";
import { historyBindingUnavailable, reportHistoryManifest, type ReportHistoryManifest } from "./history.ts";

export async function readHistoryCheck(client: PoolClient, workspaceId: string, scheduleId: string, scheduleRevision: string, scanHour: string, reportId: string) {
  const row = (await client.query(`SELECT *,database_sha256=encode(sha256(convert_to(manifest::text,'UTF8')),'hex') AS valid
    FROM bsmoss_analysis.report_history_check WHERE workspace_id=$1 AND schedule_id=$2 AND schedule_revision=$3 AND scan_hour=$4 AND report_id=$5`,
  [workspaceId, scheduleId, scheduleRevision, scanHour, reportId])).rows[0];
  if (!row) return null;
  const m = row.manifest as ReportHistoryManifest, binding = await readReportScheduleRevision(client, workspaceId, scheduleId, scheduleRevision), p = binding.schedule;
  const original = await readStoredReportInTransaction(p.scope, { reportId, revision: row.original_revision }, client);
  const result = await readStoredReportInTransaction(p.scope, { reportId, revision: row.result_revision }, client);
  if (!original || !result) throw Error("invalid_report_history_evidence");
  // Current heads can advance later; this receipt pins the heads at check time.
  const rebuilt = reportHistoryManifest(p, binding.configSha256, m.scanAt, { ...original, currentRevision: row.original_revision },
    m.before, row.outcome, { ...result, currentRevision: row.result_current_revision });
  if (!row.valid || fingerprintOf(m) !== row.manifest_sha256 || fingerprintOf(m) !== fingerprintOf(rebuilt) ||
    m.workspaceId !== workspaceId || m.scheduleId !== scheduleId || m.scheduleRevision !== scheduleRevision || m.reportId !== reportId ||
    m.scanHour !== row.scan_hour.toISOString() || m.scanHour !== scanHour || m.requestedBy !== row.recorded_by ||
    m.original.manifestSha256 !== row.original_sha256 || m.result.manifestSha256 !== row.result_sha256 || m.failureCode !== row.failure_code) throw Error("invalid_report_history_evidence");
  return { manifest: rebuilt, recordedAt: row.recorded_at.toISOString(), databaseActor: row.database_actor as string };
}

// One existing, closed report per step. A receipt anti-join, not a global
// high-water cursor, preserves late commits and makes restarts safe.
export async function reconcileRegisteredReport(pool: Pool, ports: AccessPorts, scheduleId: string) {
  return registeredTransaction(pool, ports, scheduleId, async (client, binding) => {
    const p = binding.schedule, scanAt = new Date((ports.now ?? Date.now)()).toISOString(), scanHour = bucketFor(scanAt, "hour").start;
    const locked = (await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked",
      [JSON.stringify(["bsmoss-report-history", p.workspaceId, p.id, p.revision, scanHour])])).rows[0].locked;
    if (!locked) return { status: "busy" as const };
    const row = (await client.query(`SELECT s.id,s.current_revision FROM bsmoss_analysis.report_series s
      JOIN bsmoss_analysis.report_revision r ON (r.workspace_id,r.report_id,r.revision)=(s.workspace_id,s.id,s.current_revision)
      CROSS JOIN LATERAL (SELECT r.manifest->'requiredScope' AS required) v
      LEFT JOIN LATERAL (SELECT max(h.scan_hour) AS last_checked FROM bsmoss_analysis.report_history_check h
        WHERE (h.workspace_id,h.schedule_id,h.schedule_revision,h.report_id)=(s.workspace_id,$14,$15,s.id)) history ON true
      WHERE s.workspace_id=$1 AND s.template_code=$2 AND s.template_version=$3 AND s.grain=$4 AND s.period_start>=$5
      AND s.period_end<=$6::timestamptz-make_interval(mins=>$7)
      AND required->>'workspaceId'=$1 AND required->'sourceIds' <@ $8::jsonb AND required->'stationIds' <@ $9::jsonb
      AND required->'serviceIds' <@ $10::jsonb AND required->'deviceIds' <@ $11::jsonb AND required->'metricKeys' <@ $12::jsonb
      AND (required->'allowSiteParameters'='false'::jsonb OR $13::boolean)
      AND NOT EXISTS(SELECT 1 FROM bsmoss_analysis.report_history_check h WHERE
        (h.workspace_id,h.schedule_id,h.schedule_revision,h.scan_hour,h.report_id)=(s.workspace_id,$14,$15,$16::timestamptz,s.id))
      ORDER BY history.last_checked NULLS FIRST,s.period_start,s.id COLLATE "C" LIMIT 1`,
    [p.workspaceId, p.templateCode, p.templateVersion, p.grain, p.notBefore, scanAt, p.delayMinutes,
      ...[p.scope.sourceIds, p.scope.stationIds, p.scope.serviceIds, p.scope.deviceIds, p.scope.metricKeys].map(a => JSON.stringify(a)), p.scope.allowSiteParameters, p.id, p.revision, scanHour])).rows[0];
    if (!row) return { status: "idle" as const };
    const original = await readStoredReportInTransaction(p.scope, { reportId: row.id }, client);
    if (!original || original.revision !== row.current_revision) throw Error("invalid_report_history_evidence");
    let before: ReportHistoryManifest["before"], outcome: ReportHistoryManifest["outcome"] = "blocked", result = original;
    await client.query("SAVEPOINT report_history_work");
    try {
      const current = await readReportInTransaction(pool, p.scope, { reportId: row.id }, client);
      if (!current) throw Error("invalid_report_history_evidence");
      before = { freshness: current.freshness, reasons: current.reasons };
      if (current.freshness === "current") outcome = "unchanged";
      else {
        const generated = await generateReportInTransaction(pool, p.scope, { templateCode: p.templateCode, templateVersion: p.templateVersion,
          at: original.manifest.period.start, expectedRevision: original.revision }, p.subject, client);
        result = generated.record; outcome = generated.status;
      }
      await client.query("RELEASE SAVEPOINT report_history_work");
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT report_history_work");
      if (!historyBindingUnavailable(error)) throw error;
      before = { freshness: "unavailable", reasons: ["report_binding_unavailable"] }; result = original; outcome = "blocked";
      await client.query("RELEASE SAVEPOINT report_history_work");
    }
    const manifest = reportHistoryManifest(p, binding.configSha256, scanAt, original, before, outcome, result);
    await client.query(`INSERT INTO bsmoss_analysis.report_history_check(workspace_id,schedule_id,schedule_revision,scan_hour,report_id,
      original_revision,original_sha256,result_revision,result_sha256,result_current_revision,outcome,failure_code,manifest,manifest_sha256,recorded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [p.workspaceId, p.id, p.revision, scanHour, original.reportId, original.revision, original.manifestSha256, result.revision, result.manifestSha256,
      result.currentRevision, outcome, manifest.failureCode, manifest, fingerprintOf(manifest), p.subject]);
    const receipt = await readHistoryCheck(client, p.workspaceId, p.id, p.revision, scanHour, original.reportId);
    if (!receipt) throw Error("invalid_report_history_evidence");
    return { status: "checked" as const, receipt };
  });
}
