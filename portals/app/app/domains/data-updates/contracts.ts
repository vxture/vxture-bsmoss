// Browser-safe transport contracts; no server hashing or database dependencies.
export interface UpdateSummary {
  id: string; kind: "received_evidence"; partitionId: string; partitionRevision: string; createdAt: string;
}
export interface UpdateFailure {
  kind: "input" | "result"; id: string; code: string; canRetry: boolean;
  expectedRevision?: string | null; expectedAttempt?: number | null; retryAt?: string | null;
}
export interface UpdateDetail extends UpdateSummary {
  configurationChanged: boolean; publishesAvailability: false;
  progress: { phase: "dispatching" | "recomputing" | "failed" | "processed";
    inputs: { total: number; dispatched: number; blocked: number };
    results: { total: number; succeeded: number; failed: number; running: number; waiting: number };
    failures: UpdateFailure[] };
}
export interface UpdateList { items: UpdateSummary[]; next: string | null }
export interface InputRetryCommand { id: string; changeId: string; expectedRevision: string; reasonRef: string }
export function validTaskId(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
