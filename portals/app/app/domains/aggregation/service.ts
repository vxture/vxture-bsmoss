import { authorize, type AccessContext } from "../shared/model.ts";
import type { AggregationPlan, IntervalInput } from "./intervals.ts";
import type { AggregateKey, AggregateStore } from "./store.ts";

// Internal services. The caller is a trusted composition root, never a request DTO.
export async function publishIntervalAggregate(ctx: AccessContext, store: AggregateStore, plan: AggregationPlan, inputs: readonly IntervalInput[], expectedRevision: string | null) {
  authorize(ctx, "metering", "metering.aggregate");
  if (ctx.workspaceId !== store.workspaceId || plan.workspaceId !== ctx.workspaceId) throw new Error("workspace_mismatch");
  return store.publish(plan, inputs, expectedRevision, ctx.sub);
}
export async function readIntervalAggregate(ctx: AccessContext, store: AggregateStore, key: AggregateKey, revision?: string) {
  authorize(ctx, "metering", "metering.view");
  if (ctx.workspaceId !== store.workspaceId) throw new Error("workspace_mismatch");
  return revision === undefined ? store.current(key) : store.readRevision(key, revision);
}
