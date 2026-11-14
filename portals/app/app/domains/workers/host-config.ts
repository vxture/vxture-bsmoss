import { aggregateWorkerConfig, reportWorkerConfig, type AggregateWorkerConfig, type ReportWorkerConfig } from "./rules.ts";
import { fields } from "../reports/rules.ts";

interface HostOptions { version: 1; healthTimeoutMilliseconds: number; shutdownMilliseconds: number }
export type WorkerHostConfig = HostOptions & (
  { kind: "aggregate"; worker: AggregateWorkerConfig } | { kind: "report"; worker: ReportWorkerConfig }
);
export function workerHostConfig(raw: unknown): WorkerHostConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("invalid_worker_host_config");
  const value = raw as Record<string, unknown>;
  const common = ["version", "kind", "workspaceId", "maxStepsPerTick", "pollMilliseconds", "healthTimeoutMilliseconds", "shutdownMilliseconds"];
  const specific = value.kind === "aggregate" ? ["partitionIds", "executeResults"] : value.kind === "report" ? ["scheduleIds", "executeExports", "reconcileHistory"] : null;
  if (!specific) throw Error("invalid_worker_host_config");
  fields(value, [...common, ...specific]);
  if (value.version !== 1 || typeof value.workspaceId !== "string" || value.workspaceId === "00000000-0000-0000-0000-000000000000" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.workspaceId)) throw Error("invalid_worker_host_config");
  const health = value.healthTimeoutMilliseconds ?? 180000, shutdown = value.shutdownMilliseconds ?? 90000;
  if (!Number.isSafeInteger(health) || Number(health) < 30000 || Number(health) > 1800000 || Number(health) < Number(value.pollMilliseconds) * 2 ||
    !Number.isSafeInteger(shutdown) || Number(shutdown) < 1000 || Number(shutdown) > 90000) throw Error("invalid_worker_host_config");
  const base = { workspaceId: value.workspaceId, subject: "s2s:bsmoss", maxStepsPerTick: value.maxStepsPerTick as number, pollMilliseconds: value.pollMilliseconds as number };
  const options = { version: 1 as const, healthTimeoutMilliseconds: Number(health), shutdownMilliseconds: Number(shutdown) };
  if (value.kind === "aggregate") return { ...options, kind: "aggregate", worker: aggregateWorkerConfig({ ...base, partitionIds: value.partitionIds as string[], executeResults: value.executeResults as boolean }) };
  return { ...options, kind: "report", worker: reportWorkerConfig({ ...base, scheduleIds: value.scheduleIds as string[], executeExports: value.executeExports as boolean,
    ...(value.reconcileHistory === undefined ? {} : { reconcileHistory: value.reconcileHistory as boolean }) }) };
}
