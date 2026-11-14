import { test } from "node:test";
import assert from "node:assert/strict";
import { reportJobList, reportJobQuery, encodeReportJobCursor, decodeReportJobCursor, normalizeRecoverReportJob } from "./report-jobs.ts";
import { createAuthorizedReportRecovery } from "../access/report-recovery.ts";
import { reportRecoveryCommand } from "./http.ts";
import { reportJobListFromUrl, reportJobQueryFromUrl } from "./report-http.ts";
import { createAuthorizedReportJobs } from "../access/report-jobs.ts";
import type { AccessPorts } from "../access/resolve.ts";
import { reportSelection } from "../../reports/navigation.ts";

test("report task cursors preserve microseconds and bind both queue kind and status", () => {
  const c = { kind: "generation", status: "pending", jobId: "job", createdAt: "2026-11-03T00:00:00.123456Z" } as const, value = encodeReportJobCursor(c);
  assert.deepEqual(decodeReportJobCursor(value), c);
  assert.deepEqual(reportJobList({ kind: c.kind, status: c.status, limit: 25, after: value }).after, value);
  for (const patch of [{ kind: "export" }, { status: "dead" }, { limit: 0 }, { limit: 26 }, { limit: "1" }, { permissions: [] }]) assert.throws(() => reportJobList({ kind: c.kind, status: c.status, limit: 1, after: value, ...patch } as never));
  for (const patch of [{ createdAt: "2026-02-30T00:00:00.123456Z" }, { createdAt: "2026-11-03T00:00:00.123Z" }, { kind: "aggregate" }, { status: "leased" }, { jobId: "*" }]) assert.throws(() => encodeReportJobCursor({ ...c, ...patch } as never));
  assert.throws(() => decodeReportJobCursor(value + "=")); assert.throws(() => reportJobQuery({ kind: "generation", jobId: "job", workspaceId: "forged" } as never));
});
test("report task HTTP filters reject duplicate selectors forged scope and invalid queue lifecycle", () => {
  const base = "https://bsmoss.example/api/report-jobs";
  assert.deepEqual(reportJobListFromUrl(new URL(base)), { kind: "generation", status: "all", limit: 20 });
  assert.deepEqual(reportJobQueryFromUrl(new URL(base + "/one?kind=export"), "one"), { kind: "export", jobId: "one" });
  for (const q of ["kind=export&kind=generation", "workspaceId=w", "limit=01", "limit=26", "status=leased", "kind=all", "after=", "limit=2&limit=3"]) assert.throws(() => reportJobListFromUrl(new URL(base + "?" + q)));
  for (const q of ["kind=export&kind=generation", "status=all", "workspaceId=w"]) assert.throws(() => reportJobQueryFromUrl(new URL(base + "/one?" + q), "one"));
});
test("report job inspection requires its own current permission and final identity without conferring execution or download", async () => {
  const scope = { workspaceId: "w", sourceIds: [], stationIds: [], serviceIds: [], deviceIds: [], metricKeys: [], allowSiteParameters: false };
  let permissions = ["reports.generate", "reports.export", "reports.export.execute"], reads = 0, changeIdentity = false;
  const ports: AccessPorts = { featuresFor: () => ["metering"], async readVerifiedIdentity() { return { sub: changeIdentity && reads ? "other" : "reader", activeWorkspace: "w", accountStatus: "active", governanceRoles: ["workspace:owner"], expiresAt: Date.now() + 60000 }; },
    async readCoverage() { return { workspaceId: "w", product: "bsmoss", tier: "fixture", bundled: false, expiresAt: Date.now() + 60000 }; },
    async readLocalGrant(s) { reads++; return { ...s, active: true, permissions, scope, expiresAt: Date.now() + 60000 }; } };
  const api = createAuthorizedReportJobs(ports, { create: () => ({ workspaceId: "w", async list(_, revalidate) { await revalidate(scope); return { items: [], next: null }; }, async read(_, revalidate) { await revalidate(scope); return null; } }) }, "interactive");
  await assert.rejects(api.list({ kind: "generation", status: "all", limit: 1 }), /permission_denied/);
  permissions = ["reports.jobs.view"]; assert.deepEqual(await api.list({ kind: "export", status: "all", limit: 1 }), { items: [], next: null });
  assert.equal("run" in api, false); assert.equal("download" in api, false);
  reads = 0; changeIdentity = true; await assert.rejects(api.read({ kind: "generation", jobId: "one" }), /permission_denied/);
});
test("report deep links select only explicit exact revisions and never manufacture a default report", () => {
  assert.deepEqual(reportSelection({}), { selection: null, invalid: false });
  assert.deepEqual(reportSelection({ report: "report/with?chars", revision: "9007199254740993" }), { selection: { id: "report/with?chars", revision: "9007199254740993" }, invalid: false });
  for (const p of [{ report: "one" }, { revision: "1" }, { report: ["one", "two"], revision: "1" }, { report: "*", revision: "1" }, { report: "one", revision: "01" }, { report: "one", revision: "0" }]) assert.deepEqual(reportSelection(p), { selection: null, invalid: true });
});
const recovery = { kind: "export", jobId: "failed", expectedAttempt: 5, commandId: "review", reasonRef: "review://fixed" } as const;
test("export recovery accepts only an explicit export terminal CAS command without scope or publication overrides", () => {
  assert.deepEqual(normalizeRecoverReportJob(recovery), recovery);
  for (const patch of [{ kind: "aggregate" }, { expectedAttempt: 0 }, { expectedAttempt: 6 }, { expectedAttempt: "5" }, { scope: {} }, { publicationRevision: "2" }, { commandId: "*" }, { reasonRef: " " }]) assert.throws(() => normalizeRecoverReportJob({ ...recovery, ...patch } as never));
});
test("export recovery requires independent permission even for owner and rechecks the original actor and full required scope", async () => {
  const scope = { workspaceId: "w", sourceIds: ["s"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: ["d"], metricKeys: ["m@1"], allowSiteParameters: true };
  let reads = 0, revoked = "", permissions = ["reports.jobs.view", "reports.export", "reports.export.execute"];
  const ports: AccessPorts = { featuresFor: () => ["metering"], async readVerifiedIdentity() { return { sub: reads && revoked === "identity" ? "changed" : "reviewer", activeWorkspace: "w", accountStatus: "active", governanceRoles: ["workspace:owner"], expiresAt: Date.now() + 60000 }; },
    async readCoverage() { return { workspaceId: "w", product: "bsmoss", tier: reads && revoked === "coverage" ? null : "fixture", bundled: false, expiresAt: Date.now() + 60000 }; },
    async readLocalGrant(s) { return { ...s, active: true, permissions: reads++ && revoked === "permission" ? [] : permissions, scope: reads > 1 && revoked === "scope" ? { ...scope, allowSiteParameters: false } : scope, expiresAt: Date.now() + 60000 }; } };
  const record = { commandId: "review", originalJobId: "failed", replacementJobId: "new", originalAttempt: 5, reasonRef: "review://fixed", requestedBy: "reviewer", recordedAt: "2026-11-03T00:00:00.000Z" };
  const api = createAuthorizedReportRecovery(ports, { create: () => ({ workspaceId: "w", async recover(c, actor, revalidate) { assert.deepEqual(c, recovery); assert.equal(actor, "reviewer"); await revalidate(scope); return { status: "inserted", record }; } }) }, "interactive");
  await assert.rejects(api.recover(recovery), /permission_denied/); permissions = ["reports.jobs.recover"]; reads = 0;
  assert.equal((await api.recover(recovery)).status, "inserted"); assert.equal("download" in api, false);
  for (const mode of ["identity", "coverage", "permission", "scope"]) { reads = 0; revoked = mode; await assert.rejects(api.recover(recovery), /denied/); }
});
test("export recovery HTTP closes origin body and path boundaries before executing and returns private conflict receipts", async () => {
  const origin = "https://bsmoss.example", session = { enabled: true, sid: "opaque", appOrigin: origin };
  const request = (body: unknown = recovery, headers = { origin, "content-type": "application/json" }, suffix = "") => new Request(origin + "/api/report-jobs/failed/recover" + suffix, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
  let calls = 0; const execute = async () => { calls++; return { status: "inserted" }; };
  assert.equal((await reportRecoveryCommand(request(), { ...session, sid: undefined }, "failed", execute)).status, 401);
  assert.equal((await reportRecoveryCommand(request(recovery, { origin: "https://forged.example", "content-type": "application/json" }), session, "failed", execute)).status, 403);
  assert.equal((await reportRecoveryCommand(request(recovery, { origin, "content-type": "text/plain" }), session, "failed", execute)).status, 415);
  assert.equal((await reportRecoveryCommand(request(recovery, undefined, "?scope=w"), session, "failed", execute)).status, 400);
  assert.equal((await reportRecoveryCommand(request({ ...recovery, kind: "aggregate" }), session, "failed", execute)).status, 400);
  assert.equal((await reportRecoveryCommand(request(), session, "other", execute)).status, 400);
  assert.equal((await reportRecoveryCommand(request(" ".repeat(16385)), session, "failed", execute)).status, 413); assert.equal(calls, 0);
  const result = await reportRecoveryCommand(request(), session, "failed", execute); assert.equal(result.status, 202); assert.equal(result.headers.get("cache-control"), "no-store");
  for (const message of ["report_not_active", "report_stale", "report_incomplete", "export_renderer_unavailable"]) assert.equal((await reportRecoveryCommand(request(), session, "failed", async () => { throw Error(message); })).status, 409);
});
test("report recovery dispatches explicit generation without accepting a scan scope worker or schedule override", async () => {
  const command = { ...recovery, kind: "generation" } as const, origin = "https://bsmoss.example", session = { enabled: true, sid: "opaque", appOrigin: origin };
  assert.deepEqual(normalizeRecoverReportJob(command), command);
  for (const patch of [{ kind: "aggregate" }, { scope: {} }, { subject: "forged" }, { scanJobId: "forged" }, { scheduleRevision: "2" }, { expectedAttempt: 6 }]) assert.throws(() => normalizeRecoverReportJob({ ...command, ...patch } as never));
  let calls = 0;
  const request = (body: unknown, headers = { origin, "content-type": "application/json" }) => new Request(origin + "/api/report-jobs/failed/recover", { method: "POST", headers, body: JSON.stringify(body) });
  const execute = async (_: string, c: unknown) => { calls++; assert.deepEqual(c, command); return { status: "inserted" }; };
  assert.equal((await reportRecoveryCommand(request(command, { origin: "https://forged.example", "content-type": "application/json" }), session, "failed", execute)).status, 403);
  assert.equal((await reportRecoveryCommand(request({ ...command, scanJobId: "forged" }), session, "failed", execute)).status, 400);
  assert.equal(calls, 0); assert.equal((await reportRecoveryCommand(request(command), session, "failed", execute)).status, 202); assert.equal(calls, 1);
});
