import { test } from "node:test";
import assert from "node:assert/strict";
import { analysisTemplate, analysisWindows, analysisQuery, applyAnalysisPreferences, saveAnalysisPreference } from "./analysis.ts";
import { analysisSearch, analysisHttpError } from "./analysis-http.ts";
import { seriesPaths } from "../../analysis/series.ts";
import type { AnalysisPoint } from "./analysis.ts";
import type { Panel } from "./resolve.ts";
import { reportCommand } from "../reports/http.ts";
const panel: Panel = { id: "up", category: "business_service", metricRef: { code: "service.data.uplink_bytes", version: 1 }, view: "trend", grain: "month", displayUnit: "B", precision: 2, order: 0, visible: true };
const template = { schema: "analysis-template-v1" as const, title: "Analysis", panels: [panel], bindings: [{ panelId: "up", kind: "not_connected" as const }] };
const command = { commandId: "cmd", templateCode: "page", templateVersion: 1, templateSha256: "a".repeat(64), expectedRevision: null, preferences: [] };
test("analysis configuration preserves bindings and restricts display changes to legal metric semantics", () => {
  assert.deepEqual(analysisTemplate(template), template);
  assert.throws(() => analysisTemplate({ ...template, bindings: [] }));
  assert.throws(() => analysisTemplate({ ...template, panels: [panel, panel] }));
  assert.throws(() => analysisTemplate({ ...template, panels: [{ ...panel, category: "runtime_parameter" }] }));
  assert.throws(() => applyAnalysisPreferences(template, [{ id: "foreign", visible: true }]));
  assert.throws(() => applyAnalysisPreferences(template, [{ id: "up", displayUnit: "kWh" }]));
  assert.equal(applyAnalysisPreferences(template, [{ id: "up", displayUnit: "GB", grain: "day", visible: false }])[0]!.displayUnit, "GB");
  assert.equal(template.panels[0]!.visible, true);
  assert.throws(() => saveAnalysisPreference({ ...command, preferences: [{ id: "up", metricRef: panel.metricRef } as any] }));
  for (const patch of [{ visible: "yes" }, { precision: 10 }, { order: 1.5 }, { grain: "minute" }, { displayUnit: {} }]) assert.throws(() => saveAnalysisPreference({ ...command, preferences: [{ id: "up", ...patch } as any] }));
  assert.throws(() => saveAnalysisPreference({ ...command, expectedRevision: "01" }));
  assert.deepEqual(saveAnalysisPreference(command), command);
});
test("analysis windows honor Shanghai natural months and weeks, bound history and reject calendar underflow", () => {
  const month = analysisWindows(panel, "2024-03-10T04:00:00Z");
  assert.equal(month.length, 7); assert.deepEqual(month.at(-2), { start: "2024-01-31T16:00:00.000Z", end: "2024-02-29T16:00:00.000Z" });
  assert.equal(analysisWindows({ ...panel, grain: "week" }, "2026-11-03T00:00:00Z").at(-1)!.start, "2026-11-01T16:00:00.000Z");
  assert.equal(analysisWindows({ ...panel, view: "card" }, "2026-11-03T00:00:00Z").length, 1);
  assert.equal(analysisWindows({ ...panel, grain: "day" }, "1992-01-01T00:00:00+08:00").length, 1);
  assert.throws(() => analysisWindows({ ...panel, grain: "week" }, "1992-01-01T00:00:00+08:00"), /unsupported_calendar/);
});
test("analysis HTTP filters are strict and conflicts fail with private 409 rather than a retryable success", () => {
  assert.equal(analysisSearch(new URLSearchParams({ at: "2026-11-03T08:00:00+08:00" })).at, "2026-11-03T00:00:00.000Z");
  for (const s of ["", "at=x", "at=2026-11-03T00%3A00%3A00Z&at=x", "at=2026-11-03T00%3A00%3A00Z&workspaceId=w"]) assert.throws(() => analysisSearch(new URLSearchParams(s)));
  assert.throws(() => analysisQuery({ at: "1991-01-01T00:00:00Z" }));
  const response = analysisHttpError(Error("analysis_preference_conflict")); assert.equal(response.status, 409); assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(analysisHttpError(Error("sql_failure")).status, 503);
  assert.equal(analysisHttpError(Error("invalid_analysis_preferences")).status, 400);
});
test("trend projection bounds only screen coordinates and breaks lines across unknown and stale observations", () => {
  const point = (value: string, freshness = "current"): AnalysisPoint => ({ period: { start: "", end: "" }, freshness, status: "complete", reasons: [], data: { kind: "aggregate", publication: { result: { value: { kind: "integer", value } } } } } as any);
  const unknown = { ...point("0"), data: null };
  const paths = seriesPaths([point("90071992547409930000000000"), point("90071992547409930000000001"), unknown, point("90071992547409930000000002")]);
  assert.deepEqual(paths, ["10,60 103.33333333333333,35", "290,10"]);
  assert.deepEqual(seriesPaths([unknown, point("0", "stale")]), []);
  assert.deepEqual(seriesPaths([point("0")]), ["150,35"]);
});
test("analysis writes preserve the shared origin and streamed body boundary while mapping preference conflicts explicitly", async () => {
  const session = { enabled: true, sid: "opaque", appOrigin: "https://bsmoss.example" }; let executed = 0;
  const execute = async () => { executed++; throw Error("analysis_preference_conflict"); };
  const request = (body: string, origin = session.appOrigin) => new Request("https://bsmoss.example/api/analysis", { method: "POST", headers: { "content-type": "application/json", origin }, body });
  const run = (r: Request) => reportCommand(r, session, saveAnalysisPreference, execute, 200, analysisHttpError);
  assert.equal((await run(request(JSON.stringify(command), "https://foreign.example"))).status, 403); assert.equal(executed, 0);
  assert.equal((await run(request(JSON.stringify({ ...command, workspaceId: "forged" })))).status, 400); assert.equal(executed, 0);
  assert.equal((await run(request(" ".repeat(16385)))).status, 413); assert.equal(executed, 0);
  const conflict = await run(request(JSON.stringify(command))); assert.equal(conflict.status, 409); assert.equal(conflict.headers.get("cache-control"), "no-store"); assert.equal(executed, 1);
});
