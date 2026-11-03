import type { MeasurementScope } from "../measurements/store.ts";
import type { RevalidateReport } from "../reports/store.ts";
import type { TemplateCandidate, TemplatePreview, TemplatePublicationCommand, TemplateSelectionCommand, TemplatePointer, TemplateRead } from "./templates.ts";

export interface TemplatePublicationReceipt { status: "inserted" | "duplicate"; code: string; version: number; currentVersion: number; commandId: string }
export interface TemplateSelectionReceipt { status: "inserted" | "duplicate"; revision: string; selected: TemplatePointer; currentRevision: string; isCurrent: boolean; commandId: string }
export interface TemplateStore {
  readonly workspaceId: string;
  preview(candidate: TemplateCandidate, revalidate: RevalidateReport): Promise<TemplatePreview>;
  read(query: { code: string; version?: number }, revalidate: RevalidateReport): Promise<TemplateRead>;
  publish(command: TemplatePublicationCommand, revalidate: RevalidateReport): Promise<TemplatePublicationReceipt>;
  select(command: TemplateSelectionCommand, revalidate: RevalidateReport): Promise<TemplateSelectionReceipt>;
}
export interface TemplateStoreFactory { create(scope: MeasurementScope, subject: string): TemplateStore }
