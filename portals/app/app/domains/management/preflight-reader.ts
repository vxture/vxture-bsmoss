import type { MappingImpactScopes } from "./mapping-impact-contracts.ts";
import { readMappingImpacts } from "./mapping-impact-reader.ts";
import type { Pool } from "pg";
import type { MeasurementScope } from "../measurements/store.ts";
import { reportScope } from "../reports/rules.ts";
import { mappingSelect, mappingScoped } from "./mapping-reader.ts";
import { mappingRecord } from "./mapping-rules.ts";
import { assertMappingBaseline, mappingPreflightResult, type MappingPreflight, type MappingProposal } from "./preflight-rules.ts";
export interface MappingPreflightReader {
  readonly workspaceId: string;
  preview(id: string, proposal: MappingProposal, impacts?: MappingImpactScopes): Promise<MappingPreflight | null>;
}
export class PgMappingPreflightReader implements MappingPreflightReader {
  readonly workspaceId: string; private scope: MeasurementScope;
  constructor(private pool: Pool, scope: MeasurementScope) { this.scope = reportScope(scope); this.workspaceId = scope.workspaceId; }
  async preview(id: string, proposal: MappingProposal, impacts?: MappingImpactScopes) {
    const c = await this.pool.connect(), s = this.scope, args = [s.workspaceId, s.sourceIds, s.stationIds, s.serviceIds, s.deviceIds, s.allowSiteParameters];
    try {
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await c.query("SET LOCAL statement_timeout='15s'");
      const row = (await c.query(mappingSelect + ` WHERE ${mappingScoped} AND m.id=$7`, [...args, id])).rows[0];
      if (!row) { await c.query("COMMIT"); return null; }
      const before = mappingRecord(row, s); assertMappingBaseline(before, proposal);
      // Never query hidden peers, their identities or counts. A negative result
      // means only no overlap within authorized definitions, never global safety.
      const overlap = (await c.query(`SELECT EXISTS(SELECT 1 FROM bsmoss_integration.source_mapping m WHERE ${mappingScoped}
        AND m.id<>$7 AND m.source_id=$8 AND m.external_type=$9 AND m.external_id=$10
        AND m.valid_from<$12::timestamptz AND m.valid_to>$11::timestamptz) present`, [...args, id, before.sourceId, before.externalType, before.externalId, proposal.proposed.validFrom, proposal.proposed.validTo])).rows[0].present;
      if (typeof overlap !== "boolean") throw Error("invalid_preflight_record");
      const at = (await c.query("SELECT CURRENT_TIMESTAMP at")).rows[0].at;
      const result = mappingPreflightResult(before, proposal, overlap, new Date(at).toISOString());
      result.dependencyEvidence = await readMappingImpacts(c, before, this.workspaceId, impacts);
      for (const k of ["aggregates", "reports"] as const) if (result.dependencyEvidence[k].status === "authorized_current_heads") result.downstream[k] = "authorized_current_heads";
      await c.query("COMMIT"); return result;
    } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } finally { c.release(); }
  }
}
