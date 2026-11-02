import { aggregateIntervals, completionMatches, type AggregationPlan, type CompletionEvidence, type IntervalInput } from "./intervals.ts";
import { instant } from "./periods.ts";

// Internal, trusted source attestation. Never accepts an unverified request flag.
export function bindSourceCompletion(rawPlan: AggregationPlan, inputs: readonly IntervalInput[], rawEvidence?: CompletionEvidence): AggregationPlan {
  const plan = structuredClone(rawPlan);
  delete plan.completionEvidence;
  plan.watermark = plan.period.start; plan.sourceComplete = false;
  // Validate the caller's end boundary before adopting the canonical period.
  const base = aggregateIntervals(plan, inputs);
  plan.period = { ...base.period }; plan.watermark = base.period.start;
  if (rawEvidence !== undefined) {
    const evidence = structuredClone(rawEvidence);
    evidence.watermark = new Date(instant(evidence.watermark)).toISOString();
    plan.completionEvidence = evidence;
    if (evidence.status === "confirmed" && completionMatches(evidence, base.inputFingerprint, base.mappingWindows)) {
      plan.sourceComplete = true; plan.watermark = evidence.watermark;
    }
  }
  aggregateIntervals(plan, inputs);
  return plan;
}
