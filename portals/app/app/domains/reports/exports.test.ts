import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeExportRequest, normalizeExportQuery, normalizeExportPendingQuery, exportFailure, exportRetrySeconds, assertExportPublication } from "./exports.ts";
import type { PublicationState } from "./publication.ts";
const request = { reportId: "report", publicationRevision: "999999999999999999999999999999", commandId: "export-1" };
test("export requests bind exact publication selectors and reject request-provided authority or output", () => {
  assert.deepEqual(normalizeExportRequest(request), request);
  for (const patch of [{ publicationRevision: 1 }, { publicationRevision: "0" }, { scope: {} }, { actor: "other" }, { html: "forged" }, { rendererVersion: "forged" }, { commandId: "*" }]) assert.throws(() => normalizeExportRequest({ ...request, ...patch } as typeof request));
  assert.deepEqual(normalizeExportQuery({ jobId: "id" }), { jobId: "id" }); assert.throws(() => normalizeExportQuery({ jobId: "id", workspaceId: "forged" } as { jobId: string }));
  assert.deepEqual(normalizeExportPendingQuery({ limit: 25 }), { limit: 25 });
  for (const limit of [0, 26, 1.5, NaN]) assert.throws(() => normalizeExportPendingQuery({ limit }));
  assert.throws(() => normalizeExportPendingQuery({ limit: 1, workspaceId: "forged" } as { limit: number }));
});
test("export retry classification is finite and never consumes authorization or serialization failures", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(exportRetrySeconds), [5, 10, 20, 40, 0]); assert.throws(() => exportRetrySeconds(6));
  assert.deepEqual(exportFailure(Error("report_stale")), { code: "report_stale", terminal: true });
  assert.deepEqual(exportFailure({ code: "42P01" }), { code: "storage_failed", terminal: false });
  for (const error of [Error("permission_denied"), Error("report_scope_denied"), Error("access_expired"), { code: "40001" }, { code: "40P01" }, { code: "42501" }]) assert.equal(exportFailure(error), null);
});
test("exports require a still-active complete fresh publication independently of a historical published action", () => {
  const state = { isActive: true, report: { revision: "1", currentRevision: "1", freshness: "current", manifest: { capturedFreshness: "current", dataCompleteness: "complete" } } } as PublicationState;
  assert.doesNotThrow(() => assertExportPublication(state)); assert.throws(() => assertExportPublication(null), /not_active/);
  assert.throws(() => assertExportPublication({ ...state, isActive: false }), /not_active/);
  assert.throws(() => assertExportPublication({ ...state, report: { ...state.report, freshness: "stale" } }), /stale/);
});
