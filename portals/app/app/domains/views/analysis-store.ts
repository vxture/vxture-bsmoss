import type { MeasurementScope } from "../measurements/store.ts";
import type { RevalidateReport } from "../reports/store.ts";
import type { AnalysisQuery, AnalysisWorkspace, SaveAnalysisPreference } from "./analysis.ts";

export interface AnalysisPreferenceReceipt { status: "inserted" | "duplicate"; revision: string; currentRevision: string; commandId: string }
export interface AnalysisStore {
  readonly workspaceId: string;
  read(query: AnalysisQuery, revalidate: RevalidateReport): Promise<AnalysisWorkspace>;
  save(command: SaveAnalysisPreference, revalidate: RevalidateReport): Promise<AnalysisPreferenceReceipt>;
}
export interface AnalysisStoreFactory { create(scope: MeasurementScope, subject: string): AnalysisStore }
