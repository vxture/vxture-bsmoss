import { authorize, type AccessContext } from "../shared/model.ts";
import type { StateAggregateStore } from "./state-store.ts";
import type { StatePlan, StateInput } from "./state-period.ts";
import type { AggregateKey } from "./store.ts";

export async function publishStateAggregate(ctx: AccessContext, store: StateAggregateStore, plan: StatePlan, inputs: readonly StateInput[], expectedRevision: string | null) {
  authorize(ctx, "metering", "metering.aggregate");
  if (ctx.workspaceId !== store.workspaceId || plan.workspaceId !== ctx.workspaceId) throw Error("workspace_mismatch");
  return store.publish(plan, inputs, expectedRevision, ctx.sub);
}
export async function readStateAggregate(ctx: AccessContext, store: StateAggregateStore, key: AggregateKey, revision?: string) {
  authorize(ctx, "metering", "metering.view");
  if (ctx.workspaceId !== store.workspaceId) throw Error("workspace_mismatch");
  return revision === undefined ? store.current(key) : store.readRevision(key, revision);
}
