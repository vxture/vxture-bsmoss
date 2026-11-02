import type { MetricRef } from "../catalog/registry.ts";

export type MeasurementValue =
  | { kind: "integer_delta"; value: string }
  | { kind: "ratio_parts"; numerator: string; denominator: string }
  | { kind: "fixed_point"; unscaled: string; scale: number }
  | { kind: "state_event"; state: "running" | "standby" | "fault" | "offline" | "maintenance" | "unknown"; validUntil: string };

export interface MeasurementDraft {
  workspaceId: string;
  sourceId: string;
  eventId: string;
  revision: string;
  previousRevision: string | null;
  payloadSha256: string;
  payloadUri: string;
  occurredAt: string;
  metric: MetricRef;
  componentKey: string;
  stationId: string;
  mappingId: string;
  transformVersion: string;
  periodStart: string;
  periodEnd: string;
  value: MeasurementValue;
  quality: { status: "verified" | "pending" | "rejected"; ruleVersion: string; reason: string; decidedBy: string };
}

// Construct only from trusted identity resolution, never request-supplied grants.
export interface MeasurementScope {
  workspaceId: string;
  sourceIds: readonly string[];
  stationIds: readonly string[];
  metricKeys: readonly string[];
  serviceIds: readonly string[];
  deviceIds: readonly string[];
  allowSiteParameters: boolean;
}
export interface MeasurementFilter {
  stationId: string;
  metric: MetricRef;
  from: string;
  to: string;
  limit: number;
  afterId?: string;
}
export interface StoredMeasurement {
  id: string;
  draft: MeasurementDraft;
}
export interface MeasurementStore {
  readonly workspaceId: string;
  append(draft: MeasurementDraft): Promise<{ id: string; status: "inserted" | "duplicate" }>;
  // Bounded raw revisions for evidence drill-down, not a current-value aggregate.
  list(filter: MeasurementFilter): Promise<{ items: StoredMeasurement[]; nextAfterId: string | null }>;
}
