import { authorize, type AccessContext, type UsageRecord } from "../shared/model.ts";
import { validateUsage } from "./lib/rules.ts";
import type { UsageStore } from "./store.ts";
export async function ingestUsage(ctx: AccessContext, store: UsageStore, record: UsageRecord) {
  authorize(ctx, "metering", "metering.ingest");
  if (record.workspaceId !== ctx.workspaceId) throw new Error("workspace_mismatch");
  validateUsage(record);
  return store.append(record);
}
