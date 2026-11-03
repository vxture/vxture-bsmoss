import { getS2SConfig } from "../../platform/s2s.ts";
import { getOidcConfig } from "../../auth/lib/config.ts";
import { assertInternalTarget } from "../../lib/internal-target.ts";
import { closePool } from "../../lib/db.ts";
import { aggregateWorkerForWorkspace, reportWorkerForWorkspace } from "./runtime.ts";
import { readHostConfiguration, writeHostHealth, checkHostHealth, workerHealthPath } from "./process.ts";
import { runHostedWorker } from "./host.ts";

const log = (event: Readonly<Record<string, unknown>>) => process.stdout.write(JSON.stringify(event) + "\n");
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "health") { await checkHostHealth(); return; }
  const validate = args.length === 1 && args[0] === "validate";
  if (args.length && !validate) throw Error("worker_startup_refused");
  const { config, configSha256 } = await readHostConfiguration(process.env.BSMOSS_WORKER_CONFIG_FILE);
  workerHealthPath(process.env.BSMOSS_WORKER_HEALTH_FILE);
  if (process.env.BSMOSS_WORKER_KIND !== config.kind) throw Error("worker_startup_refused");
  const cfg = getS2SConfig(), oidc = getOidcConfig();
  if (process.env.BSMOSS_WORKER_ENABLED !== "on" || process.env.BSMOSS_PRODUCT_PREVIEW !== "off" || process.env.BSMOSS_METERING_ENABLED !== "on" ||
    !cfg.enabled || process.env.PG_FORCE_NATIVE || !process.env.PLATFORM_API_URL || !process.env.BSMOSS_WORKER_HEALTH_FILE) throw Error("worker_startup_refused");
  for (const url of [cfg.tokenUrl, oidc.issuer, oidc.jwksUrl, process.env.PLATFORM_API_URL]) assertInternalTarget(url);
  const database = new URL(process.env.DATABASE_URL ?? "");
  if (!["postgres:", "postgresql:"].includes(database.protocol) || decodeURIComponent(database.username) !== "bsmoss_svc") throw Error("worker_startup_refused");
  if (validate) { log({ event: "worker_configuration_valid", kind: config.kind, configSha256 }); return; }
  const controller = new AbortController();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (controller.signal.aborted) return;
    controller.abort();
    deadline = setTimeout(() => { log({ event: "worker_shutdown_timeout" }); process.exit(1); }, config.shutdownMilliseconds);
    deadline.unref();
  };
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
  try {
    const worker = config.kind === "aggregate" ? aggregateWorkerForWorkspace(config.worker) : reportWorkerForWorkspace(config.worker);
    await runHostedWorker(config, worker, { signal: controller.signal, configSha256, pid: process.pid, gitSha: process.env.GIT_SHA ?? "unknown",
      writeHealth: value => writeHostHealth(process.env.BSMOSS_WORKER_HEALTH_FILE, value), close: closePool, log });
  } finally {
    process.removeListener("SIGTERM", stop); process.removeListener("SIGINT", stop);
    if (deadline) clearTimeout(deadline);
    await closePool();
  }
}
main().catch(() => { log({ event: process.argv[2] === "health" ? "worker_unhealthy" : "worker_startup_or_host_failed" }); process.exitCode = 1; });
