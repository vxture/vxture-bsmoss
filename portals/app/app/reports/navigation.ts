import { normalizeReportQuery } from "../domains/reports/rules.ts";
export function reportSelection(params: Record<string, string | string[] | undefined>) {
  if (params.report === undefined && params.revision === undefined) return { selection: null, invalid: false };
  try {
    if (typeof params.report !== "string" || typeof params.revision !== "string") throw Error("invalid_report_link");
    const q = normalizeReportQuery({ reportId: params.report, revision: params.revision });
    return { selection: { id: q.reportId, revision: q.revision! }, invalid: false };
  } catch { return { selection: null, invalid: true }; }
}
