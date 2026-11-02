import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeJobCursor, decodeJobCursor, normalizeJobList, normalizeRecoverJob, jobScope } from "./jobs.ts";
import { mappedSubject } from "../aggregation/subjects.ts";
import { planRefreshJob } from "../aggregation/refresh-jobs.ts";
import { bucketFor } from "../aggregation/periods.ts";
import { createAuthorizedAggregateJobs } from "../access/aggregate-jobs.ts";
import type { AccessPorts } from "../access/resolve.ts";
import type { AggregateJobStore } from "./jobs.ts";

const metric = { code: "service.data.uplink_bytes", version: 1 }, at = "2026-07-05T16:00:00.000Z";
const plan = { workspaceId: "w", sourceId: "src", subjectKey: mappedSubject("st", "svc", "cell", null), metric, grain: "day" as const, period: bucketFor(at, "day") };
const job = planRefreshJob({ plan }, { sourceId: "src", mappingId: "map", metric, grain: "day", at }, "fixture:job");
const scope = jobScope(job);
test("job cursors preserve PostgreSQL microseconds and bind the live status filter", () => {
  const c = { createdAt: "2026-07-06T10:11:12.123456Z", jobId: "one", status: "dead" as const }, token = encodeJobCursor(c);
  assert.deepEqual(decodeJobCursor(token), c); assert.deepEqual(normalizeJobList({ limit: 25, status: "dead", after: token }), { limit: 25, status: "dead", after: token });
  for (const bad of ["=", token + "=", Buffer.from('{"createdAt":"2026-02-30T00:00:00.000001Z","jobId":"x","status":"all"}').toString("base64url")]) assert.throws(() => decodeJobCursor(bad));
  for (const patch of [{ status: "all", after: token }, { limit: 26 }, { limit: 0 }, { limit: "1" }, { scope: {} }]) assert.throws(() => normalizeJobList({ limit: 20, status: "dead", ...patch } as never));
});
test("recovery commands require a bounded terminal attempt and explicit immutable review reference", () => {
  const c = { jobId: "one", expectedAttempt: 5, commandId: "command", reasonRef: "review://one" };
  assert.deepEqual(normalizeRecoverJob(c), c);
  for (const patch of [{ expectedAttempt: 0 }, { expectedAttempt: 9 }, { expectedAttempt: "1" }, { reasonRef: " " }, { expectedAttempt: 1.5 }, { target: job.target }, { permissions: [] }]) assert.throws(() => normalizeRecoverJob({ ...c, ...patch } as never));
});
test("lifecycle scope uses the canonical exact object and physical-site switch without requiring unrelated dependencies", () => {
  assert.deepEqual(scope, { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: [], metricKeys: [metric.code + "@1"], allowSiteParameters: false });
  const site = planRefreshJob({ plan: { ...plan, subjectKey: mappedSubject("st", null, null, null) } }, job.target, "site");
  assert.equal(jobScope(site).allowSiteParameters, true);
  const device = planRefreshJob({ plan: { ...plan, subjectKey: mappedSubject("st", null, null, "device") } }, job.target, "device");
  assert.deepEqual(jobScope(device).deviceIds, ["device"]); assert.equal(jobScope(device).allowSiteParameters, false);
  assert.throws(() => jobScope({ ...job, subjectKey: "[]" }));
});
test("job inspection and recovery have independent explicit permissions with no workspace-owner baseline", async () => {
  let permissions = ["metering.view", "metering.aggregate"], owner = true, called = 0;
  const ports: AccessPorts = { async readVerifiedIdentity() { return { sub: "reviewer", activeWorkspace: "w", accountStatus: "active", governanceRoles: owner ? ["workspace:owner"] : [], expiresAt: Date.now() + 60000 }; },
    async readCoverage() { return { workspaceId: "w", product: "bsmoss", tier: "fixture", bundled: false, expiresAt: Date.now() + 60000 }; },
    featuresFor: () => ["metering"], async readLocalGrant() { return { workspaceId: "w", sub: "reviewer", active: true, permissions, scope, expiresAt: Date.now() + 60000 }; } };
  const store: AggregateJobStore = { workspaceId: "w", async list(_, revalidate) { called++; await revalidate(scope); return { items: [], next: null }; },
    async read(_, revalidate) { called++; await revalidate(scope); return null; }, async recover(_, actor, revalidate) { called++; assert.equal(actor, "reviewer"); await revalidate(scope); return { status: "inserted", record: {} as never }; } };
  const api = createAuthorizedAggregateJobs(ports, { create: () => store }, "interactive"), command = { jobId: "one", expectedAttempt: 1, commandId: "cmd", reasonRef: "review://one" };
  await assert.rejects(api.list({ limit: 1, status: "all" }), /permission_denied/); await assert.rejects(api.recover(command), /permission_denied/); assert.equal(called, 0);
  permissions = ["metering.jobs.view"]; assert.equal(await api.read({ jobId: "one" }), null); await assert.rejects(api.recover(command), /permission_denied/);
  owner = false; permissions = ["metering.jobs.recover"]; await api.recover(command); await assert.rejects(api.list({ limit: 1, status: "all" }), /permission_denied/);
});
