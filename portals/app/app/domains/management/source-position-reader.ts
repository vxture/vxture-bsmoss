import type { PoolClient } from "pg";
import type { SourceBinding } from "../integration/contracts.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { assertReportScope } from "../reports/rules.ts";
import { receiptSelect, receiptRow } from "../integration/pg-intake.ts";
import { sourceScopeWhere } from "./source-reader.ts";
import { positionPreview, type SourcePositionPreview } from "./source-position-rules.ts";

export async function readSourcePositionPreview(c: PoolClient, current: SourceBinding, proposed: SourceBinding, scope?: MeasurementScope): Promise<SourcePositionPreview> {
  if (!scope) return { status: "not_authorized" };
  try { assertReportScope(scope, current.scope); assertReportScope(scope, proposed.scope); }
  catch { return { status: "not_authorized" }; }
  // Match the true latest receipt across revisions before checking its full
  // historical scope. A hidden latest receipt must never revive an older one.
  // Empty and hidden are intentionally indistinguishable in this response.
  const row = (await c.query(receiptSelect + ` /* source-position-preview */
    WHERE ${sourceScopeWhere} AND r.workspace_id=$1 AND r.binding_id=$3
    AND r.sequence=(SELECT max(x.sequence) FROM bsmoss_integration.source_intake_receipt x
      WHERE x.workspace_id=$1 AND x.binding_id=$3) LIMIT 1`, [scope.workspaceId, scope, current.id])).rows[0];
  if (!row) return { status: "unavailable" };
  const receipt = receiptRow(row);
  assertReportScope(scope, receipt.binding.scope);
  return positionPreview(receipt, current, proposed);
}
