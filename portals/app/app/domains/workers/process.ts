import { open, rename, writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { workerHostConfig } from "./host-config.ts";
import type { WorkerHealth } from "./host.ts";

async function boundedFile(path: string, limit: number) {
  const file = await open(path, "r");
  try {
    if (!(await file.stat()).isFile()) throw Error("invalid_worker_host_config");
    const buffer = Buffer.alloc(limit + 1); let position = 0;
    while (position <= limit) {
      const result = await file.read(buffer, position, buffer.length - position, position);
      if (!result.bytesRead) break;
      position += result.bytesRead;
    }
    if (position > limit) throw Error("worker_file_too_large");
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, position));
  } finally { await file.close(); }
}
export async function readHostConfiguration(path: string | undefined) {
  if (!path || !isAbsolute(path)) throw Error("worker_host_config_required");
  const raw: unknown = JSON.parse(await boundedFile(path, 32768));
  const config = workerHostConfig(raw), configSha256 = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  return { config, configSha256 };
}
export function workerHealthPath(path: string | undefined): string {
  if (!path || !isAbsolute(path)) throw Error("worker_health_path_required");
  return path;
}
export async function writeHostHealth(path: string | undefined, health: WorkerHealth) {
  const target = workerHealthPath(path), temporary = target + "." + process.pid + ".tmp";
  await writeFile(temporary, JSON.stringify(health) + "\n", { mode: 0o600 });
  await rename(temporary, target);
}
export async function checkHostHealth(env: Record<string, string | undefined> = process.env, now = Date.now()) {
  const { config, configSha256 } = await readHostConfiguration(env.BSMOSS_WORKER_CONFIG_FILE);
  if (env.BSMOSS_WORKER_KIND !== undefined && env.BSMOSS_WORKER_KIND !== config.kind) throw Error("worker_unhealthy");
  const value = JSON.parse(await boundedFile(workerHealthPath(env.BSMOSS_WORKER_HEALTH_FILE), 4096)) as Partial<WorkerHealth>;
  if (value.schema !== "bsmoss-worker-health-v1" || value.status !== "running" || value.kind !== config.kind ||
    value.configSha256 !== configSha256 || value.gitSha !== (env.GIT_SHA ?? "unknown") || !Number.isSafeInteger(value.pid) || value.pid! < 1 ||
    !Number.isSafeInteger(value.updatedAt) || value.updatedAt! > now || now - value.updatedAt! > config.healthTimeoutMilliseconds) throw Error("worker_unhealthy");
  process.kill(value.pid!, 0);
}
