import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { reportScope } from "./rules.ts";
import { readReportInTransaction, readStoredReportInTransaction } from "./pg-store.ts";
import { assertPublishable, normalizePublicationCommand, normalizePublicationQuery,
  type PublicationCommand, type PublicationEvent, type PublicationQuery, type ReportPublicationStore } from "./publication.ts";
import type { RevalidateReport } from "./store.ts";

function eventOf(row: Record<string, any>): PublicationEvent {
  positiveRevision(row.event_revision); positiveRevision(row.report_revision);
  jobIdentity(row.recorded_by);
  const event: PublicationEvent = { reportId: row.report_id, eventRevision: row.event_revision, previousEventRevision: row.previous_event_revision,
    reportRevision: row.report_revision, manifestSha256: row.manifest_sha256, commandId: row.command_id, action: row.action,
    reasonRef: row.reason_ref, recordedBy: row.recorded_by, recordedAt: row.recorded_at.toISOString() };
  normalizePublicationCommand({ ...commandOf(event), expectedEventRevision: event.previousEventRevision });
  return event;
}
function commandOf(event: PublicationEvent): PublicationCommand {
  return { reportId: event.reportId, reportRevision: event.reportRevision, manifestSha256: event.manifestSha256,
    expectedEventRevision: event.previousEventRevision, commandId: event.commandId, action: event.action, reasonRef: event.reasonRef };
}

export class PgReportPublicationStore implements ReportPublicationStore {
  readonly workspaceId: string;
  private readonly scope: MeasurementScope;
  constructor(private readonly pool: Pool, scope: MeasurementScope) { this.scope = reportScope(scope); this.workspaceId = this.scope.workspaceId; }
  async execute(raw: PublicationCommand, actor: string, revalidate: RevalidateReport) {
    const command = normalizePublicationCommand(raw); jobIdentity(actor);
    const client = await this.pool.connect(); let discard = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      const head = (await client.query(`SELECT current_revision FROM bsmoss_analysis.report_series
        WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, [this.workspaceId, command.reportId])).rows[0];
      if (!head) throw Error("report_unavailable");
      const record = await readStoredReportInTransaction(this.scope, { reportId: command.reportId, revision: command.reportRevision }, client);
      if (!record || record.manifestSha256 !== command.manifestSha256) throw Error("report_unavailable");
      const duplicate = (await client.query(`SELECT * FROM bsmoss_analysis.report_publication_event
        WHERE workspace_id=$1 AND report_id=$2 AND command_id=$3`, [this.workspaceId, command.reportId, command.commandId])).rows[0];
      let event: PublicationEvent, status: "inserted" | "duplicate";
      if (duplicate) {
        event = eventOf(duplicate);
        if (event.recordedBy !== actor || fingerprintOf(commandOf(event)) !== fingerprintOf(command)) throw Error("conflicting_publication_replay");
        status = "duplicate";
      } else {
        const prior = (await client.query(`SELECT * FROM bsmoss_analysis.report_publication_event
          WHERE workspace_id=$1 AND report_id=$2 ORDER BY event_revision DESC LIMIT 1`, [this.workspaceId, command.reportId])).rows[0];
        if ((prior?.event_revision ?? null) !== command.expectedEventRevision) throw Error("publication_revision_conflict");
        if (command.action === "published") {
          const current = await readReportInTransaction(this.pool, this.scope, { reportId: command.reportId, revision: command.reportRevision }, client);
          if (!current) throw Error("report_unavailable"); assertPublishable(current);
          if (prior?.action === "published" && prior.report_revision === command.reportRevision) throw Error("report_already_published");
        } else if (prior?.action !== "published" || prior.report_revision !== command.reportRevision || prior.manifest_sha256 !== command.manifestSha256) throw Error("publication_withdrawal_conflict");
        const eventRevision = (BigInt(prior?.event_revision ?? "0") + 1n).toString(); positiveRevision(eventRevision);
        const row = (await client.query(`INSERT INTO bsmoss_analysis.report_publication_event
          (workspace_id,report_id,event_revision,previous_event_revision,report_revision,manifest_sha256,command_id,action,reason_ref,recorded_by)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [this.workspaceId, command.reportId, eventRevision, command.expectedEventRevision,
            command.reportRevision, command.manifestSha256, command.commandId, command.action, command.reasonRef, actor])).rows[0];
        event = eventOf(row);
        await client.query(`INSERT INTO bsmoss_analysis.report_publication_outbox(workspace_id,id,report_id,event_revision,action)
          VALUES($1,$2,$3,$4,$5)`, [this.workspaceId, randomUUID(), command.reportId, eventRevision, event.action]);
        status = "inserted";
      }
      const current = (await client.query(`SELECT event_revision FROM bsmoss_analysis.report_publication_event
        WHERE workspace_id=$1 AND report_id=$2 ORDER BY event_revision DESC LIMIT 1`, [this.workspaceId, command.reportId])).rows[0];
      if (!current) throw Error("invalid_publication_record");
      await revalidate(record.manifest.requiredScope); await client.query("COMMIT");
      return { status, event, currentEventRevision: current.event_revision as string,
        isActive: event.action === "published" && event.eventRevision === current.event_revision };
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
  async read(raw: PublicationQuery, revalidate: RevalidateReport) {
    const query = normalizePublicationQuery(raw), client = await this.pool.connect(); let discard = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const head = (await client.query(`SELECT event_revision FROM bsmoss_analysis.report_publication_event
        WHERE workspace_id=$1 AND report_id=$2 ORDER BY event_revision DESC LIMIT 1`, [this.workspaceId, query.reportId])).rows[0];
      const row = head ? (await client.query(`SELECT * FROM bsmoss_analysis.report_publication_event
        WHERE workspace_id=$1 AND report_id=$2 AND event_revision=$3`, [this.workspaceId, query.reportId, query.eventRevision ?? head.event_revision])).rows[0] : null;
      if (!row) {
        await revalidate(reportScope({ ...this.scope, sourceIds: [], stationIds: [], serviceIds: [], deviceIds: [], metricKeys: [], allowSiteParameters: false }));
        await client.query("COMMIT"); return null;
      }
      const event = eventOf(row), report = await readReportInTransaction(this.pool, this.scope, { reportId: query.reportId, revision: event.reportRevision }, client);
      if (!report || report.manifestSha256 !== event.manifestSha256) throw Error("invalid_publication_record");
      await revalidate(report.manifest.requiredScope); await client.query("COMMIT");
      return { event, currentEventRevision: head.event_revision as string, isActive: event.eventRevision === head.event_revision && event.action === "published", report };
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
}
