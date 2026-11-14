import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeReportListQuery, encodeReportCursor, decodeReportCursor } from "./list.ts";
test("report pagination has bounded strict selectors and canonical cursors with no embedded authorization", () => {
  const cursor = { reportId: "report-id", periodStart: "2026-07-05T16:00:00.000Z" }, after = encodeReportCursor(cursor);
  assert.deepEqual(decodeReportCursor(after), cursor); assert.deepEqual(normalizeReportListQuery({ limit: 25, after }), { limit: 25, after });
  for (const limit of [0, -1, 26, 1.5, Infinity, NaN]) assert.throws(() => normalizeReportListQuery({ limit }));
  for (const value of ["", after + "=", "!", Buffer.from(JSON.stringify({ ...cursor, scope: "*" })).toString("base64url"),
    Buffer.from(JSON.stringify({ ...cursor, periodStart: "2026-02-30T16:00:00.000Z" })).toString("base64url"), Buffer.from("null").toString("base64url")]) assert.throws(() => decodeReportCursor(value));
  assert.throws(() => normalizeReportListQuery({ limit: 20, workspaceId: "forged" } as { limit: number }));
});
