import type { PoolClient } from "pg";
import type { MeasurementScope } from "../measurements/store.ts";
import { assertReportScope } from "../reports/rules.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { receiptRow, receiptSelect } from "../integration/pg-intake.ts";
import { readIntakeTaskEvidence, readIntakeTaskHistory } from "../integration/pg-intake-tasks.ts";
import type { IntakeEvent } from "../integration/intake-contracts.ts";
import type { SourceRecord } from "./source-rules.ts";

// Browser transport contains no manifests, raw measurements, actors or cursors.
export type SourceIntakeImpact = { status: "not_authorized" } | {
  status: "current_revision_assessed"; bindingRevision: string;
  receipts: { items: { id: string; sequence: string; through: string; inserted: number; duplicates: number }[]; hasMore: boolean };
  tasks: { items: { id: string; revision: string; state: IntakeEvent["state"]; attempt: number }[]; hasMore: boolean };
  earlierRevisions: "not_assessed"; latestPosition: "not_assessed";
};
export const INTAKE_IMPACT_LIMIT = 20;
export async function readSourceIntakeImpact(c: PoolClient, before: SourceRecord, scope?: MeasurementScope): Promise<SourceIntakeImpact> {
  if (!scope) return { status: "not_authorized" };
  try { assertReportScope(scope, before.binding.scope); } catch { return { status: "not_authorized" }; }
  // Every candidate references exactly the already-authorized immutable binding
  // revision. Historical bindings are deliberately not searched or counted.
  const args = [scope.workspaceId, before.id, before.revision, INTAKE_IMPACT_LIMIT + 1];
  const receiptRows = (await c.query(receiptSelect + ` WHERE r.workspace_id=$1 AND r.binding_id=$2 AND r.binding_revision=$3
    ORDER BY r.sequence DESC LIMIT $4`, args)).rows;
  const receipts: Extract<SourceIntakeImpact, { status: "current_revision_assessed" }>["receipts"]["items"] = [];
  for (const row of receiptRows) {
    const r = receiptRow(row); assertReportScope(scope, r.binding.scope);
    if (fingerprintOf(r.binding) !== before.digest) throw Error("invalid_intake_receipt");
    receipts.push({ id: r.id, sequence: r.sequence, through: r.manifest.position.through, inserted: r.manifest.inserted, duplicates: r.manifest.duplicates });
  }
  const taskRows = (await c.query(`SELECT id FROM bsmoss_integration.source_intake_task
    WHERE workspace_id=$1 AND binding_id=$2 AND binding_revision=$3
    ORDER BY created_at DESC,id COLLATE "C" DESC LIMIT $4`, args)).rows;
  const tasks: Extract<SourceIntakeImpact, { status: "current_revision_assessed" }>["tasks"]["items"] = [];
  for (const row of taskRows) {
    const t = await readIntakeTaskEvidence(c, scope.workspaceId, row.id); assertReportScope(scope, t.binding.scope);
    if (fingerprintOf(t.binding) !== before.digest) throw Error("invalid_intake_task_evidence");
    const latest = (await readIntakeTaskHistory(c, scope.workspaceId, t.id)).at(-1)!;
    tasks.push({ id: t.id, revision: latest.revision, state: latest.state, attempt: latest.attempt });
  }
  // Validate the lookahead as evidence too; do not turn corruption into "more".
  return { status: "current_revision_assessed", bindingRevision: before.revision,
    receipts: { items: receipts.slice(0, INTAKE_IMPACT_LIMIT), hasMore: receipts.length > INTAKE_IMPACT_LIMIT },
    tasks: { items: tasks.slice(0, INTAKE_IMPACT_LIMIT), hasMore: tasks.length > INTAKE_IMPACT_LIMIT },
    earlierRevisions: "not_assessed", latestPosition: "not_assessed" };
}
