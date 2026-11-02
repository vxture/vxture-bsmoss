import { authorize, type AccessContext } from "../shared/model.ts";
import type { MeasurementDraft, MeasurementFilter, MeasurementStore } from "./store.ts";

export async function persistMeasurement(ctx: AccessContext, store: MeasurementStore, draft: MeasurementDraft) {
  authorize(ctx,"metering","metering.ingest");
  if (ctx.workspaceId !== draft.workspaceId || store.workspaceId !== ctx.workspaceId) throw new Error("workspace_mismatch");
  if (ctx.sub !== draft.quality.decidedBy) throw new Error("decision_identity_mismatch");
  return store.append(draft);
}
export async function listMeasurements(ctx: AccessContext, store: MeasurementStore, filter: MeasurementFilter) {
  authorize(ctx,"metering","metering.view");
  if (ctx.workspaceId !== store.workspaceId) throw new Error("workspace_mismatch");
  return store.list(filter);
}
