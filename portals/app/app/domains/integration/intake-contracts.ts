// Browser-safe transport contracts. No adapter, identity or database imports.
export interface IntakeReviewCommand { taskId: string; expectedRevision: string; commandId: string; reasonRef: string }
export interface IntakeEvent {
  revision: string; attempt: number; state: "started" | "received" | "duplicate" | "current" | "failed" | "terminated";
  commandId: string; reasonRef: string | null; actor: string; leaseUntil: string; leaseExpired: boolean;
  receiptId: string | null; inserted: number; duplicates: number; failureCode: string | null; recordedAt: string;
}
export interface IntakeSummary {
  id: string; kind: "source_intake"; bindingId: string; bindingRevision: string; createdAt: string;
  configurationChanged: boolean; configurationPaused: boolean; latest: IntakeEvent; publishesAvailability: false;
}
export interface IntakeDetail extends IntakeSummary { attempts: IntakeEvent[] }
export interface IntakeList { items: IntakeSummary[]; next: string | null }
