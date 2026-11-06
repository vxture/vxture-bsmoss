import type { UnattributedDraft } from "../access/measurements.ts";
import type { MeasurementScope } from "../measurements/store.ts";

// Internal adapter protocol, not an upstream API or a browser request schema.
// A reviewed composition supplies the binding and a credential-owning adapter.
export interface SourceBinding {
  id: string; revision: string; sourceId: string; adapterVersion: string;
  transformVersion: string; coverageStart: string; scope: MeasurementScope;
}
export interface SourceClaim {
  status: "confirmed" | "revoked"; through: string; evidenceRef: string; evidenceSha256: string;
}
export interface SourceHead {
  sourceId: string; snapshotId: string; dataRevision: string;
  availableThrough: string | null; changeCursor: string; completionClaim: SourceClaim | null;
}
// Only the durable intake coordinator may save this after every page has
// committed. It is a received-input position, never an analysis availability.
export interface SourcePosition {
  bindingSha256: string; through: string; dataRevision: string; changeCursor: string;
}
export type SourceMeasurement = Omit<UnattributedDraft, "quality">;
export interface SourceItem { kind: "window" | "change"; measurement: SourceMeasurement }
export interface SourcePage {
  planId: string; snapshotId: string; after: string | null;
  items: SourceItem[]; next: string | null;
}
export interface PullPlan {
  version: "source-pull-v1"; id: string; bindingSha256: string; sourceId: string;
  snapshotId: string; dataRevision: string; from: string; to: string;
  changesAfter: string | null; changesThrough: string; state: "current" | "pull";
}
export interface SourceReadPort {
  // Must pin both the overlap scan and change feed to the returned snapshot.
  // The feed includes late first arrivals and corrections older than 72 hours.
  // Actual formats, signatures and pagination are the adapter's responsibility.
  head(input: { binding: SourceBinding; signal: AbortSignal }): Promise<unknown>;
  page(input: { binding: SourceBinding; plan: PullPlan; after: string | null; limit: number; signal: AbortSignal }): Promise<unknown>;
}
