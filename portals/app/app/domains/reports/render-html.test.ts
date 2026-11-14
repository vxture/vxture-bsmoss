import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { renderPublishedReport } from "./render-html.ts";
import { reportManifest, type ReportTemplate } from "./rules.ts";
import type { PublicationState } from "./publication.ts";
import { aggregateIntervals, fingerprintOf } from "../aggregation/intervals.ts";
import { bucketFor } from "../aggregation/periods.ts";
function fixture(): PublicationState {
  const period = bucketFor("2026-07-06T00:00:00+08:00", "day"), metric = { code: "service.data.uplink_bytes", version: 1 }, authority = "a".repeat(64);
  const template: ReportTemplate = { schema: "periodic-report-template-v1", title: '<img src=x onerror="alert(1)"> & report', grain: "day", panels: [{ id: "usage", metricRef: metric, category: "business_service", view: "card", grain: "day", displayUnit: "GiB", precision: 9, order: 0, visible: false }], bindings: [{ panelId: "usage", kind: "aggregate", sourceId: "src", mappingId: "map" }] };
  const result = aggregateIntervals({ workspaceId: "w", sourceId: "src", subjectKey: "subject", authorityVersion: authority, metric, inputMode: "direct", grain: "day", nativeGrain: "day", period, sourceComplete: true, watermark: period.end }, [{ workspaceId: "w", sourceId: "src", subjectKey: "subject", metric, eventId: "</pre><script>alert(2)</script>", componentKey: "value", revision: "1", qualityRevision: "1", quality: "verified", payloadSha256: authority, mappingVersion: "1", transformVersion: "v1", period, value: { kind: "integer_delta", value: "90071992547409931234567890" } }]);
  const manifest = reportManifest("w", "report", 1, template, period.start, [{ panelId: "usage", requiredScope: { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: [], metricKeys: [metric.code + "@1"], allowSiteParameters: false }, dailyDependencies: [], data: { kind: "aggregate", authorityVersion: authority, query: { sourceId: "src", mappingId: "map", metric, grain: "day", at: period.start }, publication: { seriesId: "series", revision: "1", currentRevision: "1", publishedBy: "worker", createdAt: period.end, selection: "current", freshness: "current", currentInputFingerprint: result.inputFingerprint, reasons: [], result } } }]);
  const manifestSha256 = fingerprintOf(manifest);
  return { event: { reportId: "report-id", eventRevision: "1", previousEventRevision: null, reportRevision: "1", manifestSha256, commandId: "publish", action: "published", reasonRef: "review://release", recordedBy: "publisher", recordedAt: period.end }, currentEventRevision: "1", isActive: true, report: { reportId: "report-id", revision: "1", currentRevision: "1", manifest, manifestSha256, generatedBy: "generator", generatedAt: period.end, freshness: "current", reasons: [] } };
}
test("HTML exports escape every dynamic field, preserve exact native evidence and produce deterministic isolated content", () => {
  const state = fixture(), rendered = renderPublishedReport(state);
  assert.deepEqual(renderPublishedReport(state), rendered); assert.equal(rendered.sha256, createHash("sha256").update(rendered.html).digest("hex"));
  assert.ok(rendered.html.includes("90071992547409931234567890")); assert.ok(rendered.html.includes("83886080000000010.463006692 GiB"));
  assert.ok(rendered.html.includes("&lt;img")); assert.ok(rendered.html.includes("&lt;script&gt;")); assert.ok(!/<script|<img|<iframe|<link|<form/i.test(rendered.html));
  assert.ok(rendered.html.includes("default-src 'none'")); assert.ok(rendered.html.includes("<details>")); assert.ok(rendered.html.includes(state.report.manifestSha256));
  assert.ok(rendered.html.includes("2026-07-06 00:00:00 (\u5317\u4eac\u65f6\u95f4)"));
});
test("HTML exports reject withdrawn stale or tampered reports and never silently truncate oversized evidence", () => {
  const state = fixture(); assert.throws(() => renderPublishedReport({ ...state, isActive: false }), /not_active/);
  assert.throws(() => renderPublishedReport({ ...state, report: { ...state.report, freshness: "stale" } }), /report_stale/);
  assert.throws(() => renderPublishedReport({ ...state, report: { ...state.report, manifestSha256: "f".repeat(64) } }), /invalid_export_report/);
  const item = state.report.manifest.items[0]!; if (item.data.kind !== "aggregate" || !item.data.publication) throw Error("fixture");
  const evidence = item.data.publication.result.evidence[0]!;
  item.data.publication.result.evidence = Array.from({ length: 2000 }, (_, i) => ({ ...evidence, eventId: "event-" + i + "x".repeat(2000) })) as typeof item.data.publication.result.evidence;
  state.report.manifestSha256 = fingerprintOf(state.report.manifest); state.event.manifestSha256 = state.report.manifestSha256;
  assert.throws(() => renderPublishedReport(state), /export_too_large/);
});
