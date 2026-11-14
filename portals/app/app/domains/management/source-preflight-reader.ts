import { readSourcePositionPreview } from "./source-position-reader.ts";
import { readSourceIntakeImpact } from "./source-intake-impact.ts";
import type { Pool } from "pg";
import type { MeasurementScope } from "../measurements/store.ts";
import { reportScope } from "../reports/rules.ts";
import { sourceSelect, sourceScopeWhere } from "./source-reader.ts";
import { sourceRecord } from "./source-rules.ts";
import { proposedSourceBinding, sourceDimensions, sourcePreflightResult, type SourcePreflight, type SourceProposal, type SourceResourceIssue } from "./source-preflight-rules.ts";
export interface SourcePreflightReader {
  readonly workspaceId: string;
  preview(id: string, proposal: SourceProposal, impactScope?: MeasurementScope, positionScope?: MeasurementScope): Promise<SourcePreflight | null>;
}
export class PgSourcePreflightReader implements SourcePreflightReader {
  readonly workspaceId: string; private scope: MeasurementScope;
  constructor(private pool: Pool, scope: MeasurementScope) { this.scope = reportScope(scope); this.workspaceId = this.scope.workspaceId; }
  async preview(id: string, proposal: SourceProposal, impactScope?: MeasurementScope, positionScope?: MeasurementScope) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await c.query("SET LOCAL statement_timeout='15s'");
      const row = (await c.query(sourceSelect + ` JOIN bsmoss_integration.source_binding_head h ON (h.workspace_id,h.id,h.revision)=(b.workspace_id,b.id,b.revision)
        WHERE ${sourceScopeWhere} AND b.id=$3`, [this.workspaceId, this.scope, id])).rows[0];
      if (!row) { await c.query("COMMIT"); return null; }
      const before = sourceRecord(row, this.scope), binding = proposedSourceBinding(before, proposal, this.scope), s = binding.scope;
      // No resource lookup happens until both complete scopes are authorized.
      // For broken service/device associations, return only the submitted ID,
      // never the unrequested station to which the record actually belongs.
      const stations = (await c.query("SELECT id FROM bsmoss_resource.station WHERE workspace_id=$1 AND id=ANY($2::text[])", [this.workspaceId, s.stationIds])).rows;
      const services = (await c.query("SELECT id FROM bsmoss_resource.station_service WHERE workspace_id=$1 AND id=ANY($2::text[]) AND station_id=ANY($3::text[])", [this.workspaceId, s.serviceIds, s.stationIds])).rows;
      const devices = (await c.query("SELECT id FROM bsmoss_resource.device WHERE workspace_id=$1 AND id=ANY($2::text[]) AND station_id=ANY($3::text[])", [this.workspaceId, s.deviceIds, s.stationIds])).rows;
      const metrics = (await c.query("SELECT code||'@'||version::text id FROM bsmoss_catalog.metric_version WHERE code||'@'||version::text=ANY($1::text[])", [s.metricKeys])).rows;
      const found = { stationIds: stations, serviceIds: services, deviceIds: devices, metricKeys: metrics }, issues: SourceResourceIssue[] = [];
      for (const dimension of sourceDimensions) {
        const ids = new Set(found[dimension].map(r => r.id));
        for (const id of s[dimension]) if (!ids.has(id)) issues.push({ dimension, id });
      }
      const evidence = await readSourceIntakeImpact(c, before, impactScope);
      const checkedAt = new Date((await c.query("SELECT CURRENT_TIMESTAMP at")).rows[0].at).toISOString();
      const result = sourcePreflightResult(before, proposal, this.scope, issues, checkedAt);
      result.intake.evidence = evidence;
      result.intake.position = await readSourcePositionPreview(c, before.binding, binding, positionScope);
      if (evidence.status === "current_revision_assessed" && result.intake.position.status === "assessed") evidence.latestPosition = "separately_assessed";
      if (evidence.status === "current_revision_assessed") result.intake.existingReceipts = result.intake.existingTasks = "current_revision_assessed";
      await c.query("COMMIT"); return result;
    } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } finally { c.release(); }
  }
}
