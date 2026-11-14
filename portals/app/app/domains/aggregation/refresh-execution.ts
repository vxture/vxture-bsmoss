import type { Pool } from "pg";
import { resolveMeasurementAccess, type AccessPorts } from "../access/resolve.ts";
import { refKey } from "../catalog/registry.ts";
import { readRefreshSnapshot } from "./refresh-snapshot.ts";
import { PgStateAggregateStore } from "./pg-state-store.ts";
import { publishStateAggregate } from "./state-service.ts";
import { PgAggregateStore } from "./pg-store.ts";
import type { RefreshLease } from "./pg-refresh-jobs.ts";
import { validateRefreshJob } from "./refresh-jobs.ts";
import { publishIntervalAggregate } from "./service.ts";
import { PgGaugeAggregateStore } from "./pg-gauge-store.ts";
import { publishGaugeAggregate } from "./gauge-service.ts";
import { revalidateRefreshAccess } from "./refresh-access.ts";

// One internal worker step. No timer, identity fabrication or retry loop here.
// Composition must supply a verified machine identity and product data scope.
export async function executeRefreshLease(pool: Pool, ports: AccessPorts, raw: RefreshLease) {
  const lease = structuredClone(raw); validateRefreshJob(lease.job);
  const now = ports.now ?? Date.now;
  const access = await resolveMeasurementAccess(ports, "aggregate", "data");
  if (access.context.workspaceId !== lease.job.workspaceId) throw Error("workspace_mismatch");
  if (access.expiresAt <= now()) throw Error("access_expired");
  const client = await pool.connect(); let discard = false;
  try {
    // Facts, authority, completion and head share one snapshot through commit.
    // A concurrently changed head causes serialization failure, never adoption
    // of a new head paired with old inputs. The coordinator retries the job.
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const snapshot = await readRefreshSnapshot(pool, access.scope, lease.job.target, client);
    const plan = snapshot.plan;
    if (plan.subjectKey !== lease.job.subjectKey || plan.sourceId !== lease.job.sourceId || refKey(plan.metric) !== lease.job.metricKey) throw Error("refresh_snapshot_mismatch");
    const scope = { workspaceId: access.context.workspaceId, series: [{ sourceId: plan.sourceId, subjectKey: plan.subjectKey, metricKey: refKey(plan.metric) }] };
    let result;
    if (snapshot.kind === "gauge") {
      const store = new PgGaugeAggregateStore(pool, scope, lease, client), head = await store.current(snapshot.plan);
      if (access.expiresAt <= now()) throw Error("access_expired");
      result = await publishGaugeAggregate(access.context, store, snapshot.plan, snapshot.inputs, head?.revision ?? null);
    } else if (snapshot.kind === "state") {
      const store = new PgStateAggregateStore(pool, scope, lease, client), head = await store.current(snapshot.plan);
      if (access.expiresAt <= now()) throw Error("access_expired");
      result = await publishStateAggregate(access.context, store, snapshot.plan, snapshot.inputs, head?.revision ?? null);
    } else {
      const store = new PgAggregateStore(pool, scope, lease, client), head = await store.current(snapshot.plan);
      if (access.expiresAt <= now()) throw Error("access_expired");
      result = await publishIntervalAggregate(access.context, store, snapshot.plan, snapshot.inputs, head?.revision ?? null);
    }
    await revalidateRefreshAccess(ports, access, snapshot);
    await client.query("COMMIT");
    return result;
  } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
  finally { client.release(discard); }
}
