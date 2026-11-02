import { authorize, type AccessContext } from "../shared/model.ts";
import type { GaugeAggregateStore } from "./gauge-store.ts";
import type { GaugePlan, GaugeInput } from "./gauge-period.ts";

export async function publishGaugeAggregate(ctx: AccessContext, store: GaugeAggregateStore, plan: GaugePlan, inputs: readonly GaugeInput[], expectedRevision: string | null) {
  authorize(ctx, "metering", "metering.aggregate");
  if (ctx.workspaceId !== store.workspaceId || plan.workspaceId !== ctx.workspaceId) throw Error("workspace_mismatch");
  return store.publish(plan, inputs, expectedRevision, ctx.sub);
}
