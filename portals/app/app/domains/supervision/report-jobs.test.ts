import { test } from "node:test";
import assert from "node:assert/strict";
import { reportJobList, reportJobQuery, encodeReportJobCursor, decodeReportJobCursor } from "./report-jobs.ts";
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
