import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { positiveRevision } from "../aggregation/intervals.ts";
import { exactFields } from "./rules.ts";
import type { IntakeReviewCommand } from "./intake-contracts.ts";

export const INTAKE_TASK_LIMITS = Object.freeze({ leaseSeconds: 300, runMs: 240000, attempts: 5 });
export interface IntakeTaskCommand { bindingId: string; commandId: string }
export type IntakeRecoveryCommand = IntakeReviewCommand;
function commandIdentity(value: string) { jobIdentity(value); if (value.length > 512) throw Error("invalid_intake_command"); }
export function intakeTaskCommand(raw: IntakeTaskCommand) {
  exactFields(raw, ["bindingId", "commandId"]); jobIdentity(raw.bindingId); commandIdentity(raw.commandId); return structuredClone(raw);
}
export function intakeRecoveryCommand(raw: IntakeRecoveryCommand) {
  exactFields(raw, ["taskId", "expectedRevision", "commandId", "reasonRef"]);
  if (typeof raw.taskId !== "string" || !/^[a-f0-9]{64}$/.test(raw.taskId)) throw Error("invalid_intake_task");
  positiveRevision(raw.expectedRevision); commandIdentity(raw.commandId); jobIdentity(raw.reasonRef); return structuredClone(raw);
}
export const intakeTerminationCommand = intakeRecoveryCommand;
// Store only a bounded category. Never save adapter/SQL errors, URLs, payloads
// or credentials in the operational ledger.
export function intakeFailure(error: unknown, aborted = false) {
  if (aborted) return "cancelled" as const;
  const m = error instanceof Error ? error.message : "";
  if (["source_configuration_changed", "source_binding_paused", "source_position_changed"].includes(m)) return "context_changed" as const;
  if (["source_bootstrap_window_required", "source_page_bound_exceeded", "source_record_bound_exceeded", "source_total_bytes_exceeded"].includes(m)) return "capacity_limit" as const;
  if (m.startsWith("invalid_source_") || m.startsWith("source_record_") || m === "source_conflicting_replay" || m === "mapping_not_effective") return "evidence_invalid" as const;
  return "intake_failed" as const;
}
