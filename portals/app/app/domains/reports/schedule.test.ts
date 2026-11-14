import { test } from "node:test";
import assert from "node:assert/strict";
import { reportSchedule, reportScheduleAccess, planReportCalendar, generationFailure, generationRetrySeconds, type ReportSchedule } from "./schedule.ts";
const scope = { workspaceId: "w", sourceIds: [], stationIds: [], serviceIds: [], deviceIds: [], metricKeys: ["service.sms.success_count@1"], allowSiteParameters: false };
const config: ReportSchedule = { workspaceId: "w", id: "schedule", revision: "1", subject: "worker", status: "active", scope,
  templateCode: "daily", templateVersion: 1, templateSha256: "a".repeat(64), grain: "day", notBefore: "2026-01-01T00:00:00+08:00", delayMinutes: 480, lookbackHours: 72 };
test("registered report calendars use exact Beijing day week and month due boundaries and never generate an open period", () => {
  const day = planReportCalendar(config, "2026-07-07T08:00:00+08:00"); assert.equal(day.windows.length, 4);
  assert.equal(day.windows.at(-1)!.period.start, "2026-07-05T16:00:00.000Z"); assert.equal(day.windows.at(-1)!.dueAt, "2026-07-07T00:00:00.000Z");
  assert.equal(planReportCalendar(config, "2026-07-07T07:59:59+08:00").windows.at(-1)!.period.end, "2026-07-05T16:00:00.000Z");
  const week = { ...config, grain: "week" as const, notBefore: "2026-01-05T00:00:00+08:00", delayMinutes: 540 };
  assert.equal(planReportCalendar(week, "2026-07-06T08:59:59+08:00").windows.length, 0);
  const weekly = planReportCalendar(week, "2026-07-06T09:00:00+08:00").windows[0]!; assert.equal(weekly.period.start, "2026-06-28T16:00:00.000Z"); assert.equal(weekly.period.end, "2026-07-05T16:00:00.000Z");
  const month = { ...config, grain: "month" as const, delayMinutes: 2040 };
  assert.equal(planReportCalendar(month, "2026-03-02T09:59:59+08:00").windows.length, 0);
  assert.deepEqual(planReportCalendar(month, "2026-03-02T10:00:00+08:00").windows[0]!.period, { start: "2026-01-31T16:00:00.000Z", end: "2026-02-28T16:00:00.000Z" });
  assert.equal(planReportCalendar({ ...config, notBefore: "2026-07-07T00:00:00+08:00" }, "2026-07-07T08:00:00+08:00").windows.length, 0);
});
test("report schedules bind reviewed versions and finite scopes without wildcard, excess lookback or partial-period starts", () => {
  const normalized = reportSchedule(config); assert.deepEqual(reportSchedule(normalized.schedule), normalized);
  for (const patch of [{ lookbackHours: 169 }, { delayMinutes: -1 }, { delayMinutes: 10081 }, { notBefore: "2026-01-01T00:01:00+08:00" }, { templateSha256: "invalid" }, { scope: { ...scope, metricKeys: ["*"] } }, { workspaceId: "other" }, { autoPublish: true }]) assert.throws(() => reportSchedule({ ...config, ...patch } as ReportSchedule));
  const access: Parameters<typeof reportScheduleAccess>[1] = { context: { workspaceId: "w", sub: "worker", features: new Set(["metering"]), permissions: new Set(["reports.generate"]) }, scope, expiresAt: 2000 };
  assert.deepEqual(reportScheduleAccess(config, access, 1000).scope, scope);
  for (const patch of [{ status: "paused" }, { subject: "other" }, { scope: { ...scope, sourceIds: ["unowned"] } }]) assert.throws(() => reportScheduleAccess({ ...config, ...patch } as ReportSchedule, access, 1000), /paused|denied/);
  assert.throws(() => reportScheduleAccess(config, access, 2000), /expired/);
});
test("report generation retries only classified storage or binding faults and never consumes authentication or serialization failures", () => {
  assert.deepEqual([1,2,3,4,5].map(generationRetrySeconds), [5,10,20,40,0]);
  assert.equal(generationFailure(Error("aggregate_mapping_unavailable")), "report_binding_unavailable"); assert.equal(generationFailure(Object.assign(Error("private SQL"), { code: "42P01" })), "storage_failed");
  for (const error of [Error("permission_denied"), Error("report_scope_denied"), Error("private unknown fault"), ...["40001", "40P01", "42501"].map(code => Object.assign(Error("SQL"), { code }))]) assert.equal(generationFailure(error), null);
});
