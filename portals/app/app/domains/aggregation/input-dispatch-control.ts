import { positiveRevision } from "./intervals.ts";

export const INPUT_DISPATCH_ATTEMPTS = 5;
export function inputFailureCode(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (["40001", "40P01"].includes(e?.code ?? "") || e?.message === "aggregate_revision_conflict") return "serialization_conflict";
  if (["ECONNRESET", "ETIMEDOUT", "57P01", "53300"].includes(e?.code ?? "")) return "database_unavailable";
  if (["identity_required", "permission_denied", "feature_denied", "access_expired", "object_scope_denied", "input_change_unavailable", "aggregate_scope_denied", "aggregate_dependency_scope_denied",
    "registered_partition_paused", "registered_partition_subject_denied", "registered_partition_scope_denied"].includes(e?.message ?? "")) return null;
  if (/bound_exceeded|refresh_bound_exceeded/.test(e?.message ?? "")) return "capacity_limit";
  if (/^(aggregate_capability_|aggregate_policy_|aggregate_dependency_policy_|aggregate_mapping_|state_policy_|gauge_policy_|gauge_duration_required|invalid_gauge_duration_policy|invalid_state_hold_policy|mapping_object_mismatch)/.test(e?.message ?? "")) return "source_unavailable";
  return "evidence_invalid";
}
export function nextInputFailure(last: { revision: string; attempt: number; state: string } | null) {
  if (last) {
    positiveRevision(last.revision);
    if (!Number.isSafeInteger(last.attempt) || last.attempt < 0 || last.attempt > 5 ||
        !(last.state === "reopened" && last.attempt === 0 || last.state === "retry" && last.attempt >= 1 && last.attempt < 5)) throw Error("invalid_input_dispatch_state");
  }
  const revision = (BigInt(last?.revision ?? "0") + 1n).toString(); positiveRevision(revision);
  const attempt = (last?.attempt ?? 0) + 1;
  return { revision, attempt, state: attempt === INPUT_DISPATCH_ATTEMPTS ? "quarantined" as const : "retry" as const,
    delaySeconds: attempt === INPUT_DISPATCH_ATTEMPTS ? 0 : 5 * 2 ** (attempt - 1) };
}
