import type { MeasurementScope } from "../measurements/store.ts";
import type { GenerateReport, ReportManifest, ReportQuery } from "./rules.ts";

export type RevalidateReport = (scope: MeasurementScope) => Promise<void>;
export interface StoredReport {
  reportId: string; revision: string; currentRevision: string; manifestSha256: string; manifest: ReportManifest;
  generatedBy: string; generatedAt: string;
}
export interface ReportStore {
  readonly workspaceId: string;
  generate(query: GenerateReport, actor: string, revalidate: RevalidateReport): Promise<{ status: "inserted" | "duplicate"; record: StoredReport }>;
  read(query: ReportQuery, revalidate: RevalidateReport): Promise<(StoredReport & { freshness: "current" | "stale"; reasons: readonly string[] }) | null>;
}
