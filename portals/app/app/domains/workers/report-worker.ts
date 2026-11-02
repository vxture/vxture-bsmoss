import type { Pool } from "pg";
import type { AccessPorts } from "../access/resolve.ts";
import { createAuthorizedReportExports } from "../access/report-exports.ts";
import { PgReportExportStore } from "../reports/pg-exports.ts";
import { scanRegisteredReports, pendingRegisteredReports, runRegisteredReport } from "../reports/pg-schedule.ts";
import { createWorkerLoop, type WorkerLane } from "./loop.ts";
import { reportWorkerConfig, type ReportWorkerConfig } from "./rules.ts";

// Internal host configuration, never a request body. This does not mint an
// identity or grant: real current C1/C2/local grants are required on every step.
export function createReportWorker(pool: Pool, ports: AccessPorts, raw: ReportWorkerConfig) {
  const config = reportWorkerConfig(raw);
  const pinned: AccessPorts = { ...ports, async readVerifiedIdentity() {
    const identity = await ports.readVerifiedIdentity();
    return identity?.activeWorkspace === config.workspaceId && identity.sub === config.subject ? identity : null;
  } };
  const lanes: WorkerLane[] = config.scheduleIds.map(id => ({ async step(signal) {
    const scan = await scanRegisteredReports(pool, pinned, id);
    if (scan.status === "busy") return { status: "busy" as const };
    if (signal?.aborted) return { status: "idle" as const };
    const pending = await pendingRegisteredReports(pool, pinned, id, 1), job = pending.jobIds[0];
    if (!job || signal?.aborted) return { status: "idle" as const };
    const result = await runRegisteredReport(pool, pinned, id, job);
    return { status: result.status === "busy_or_unavailable" ? "busy" as const : result.status };
  } }));
  if (config.executeExports) {
    const exports = createAuthorizedReportExports(pinned, { create: scope => new PgReportExportStore(pool, scope) }, "data");
    lanes.push({ async step(signal) {
      const pending = await exports.pending({ limit: 1 }), job = pending.jobIds[0];
      if (!job || signal?.aborted) return { status: "idle" as const };
      const result = await exports.run({ jobId: job });
      return { status: result.status === "busy_or_unavailable" ? "busy" as const : result.status };
    } });
  }
  return createWorkerLoop(lanes, { maxStepsPerTick: config.maxStepsPerTick, pollMilliseconds: config.pollMilliseconds });
}
