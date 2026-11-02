import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPublishable, normalizePublicationCommand, normalizePublicationQuery, type PublicationState } from "./publication.ts";

const command = { reportId: "report", reportRevision: "90071992547409931234567890", manifestSha256: "a".repeat(64), expectedEventRevision: null,
  commandId: "publish-1", action: "published" as const, reasonRef: "review://release" };
test("publication selectors preserve exact revisions and reject forged authority or ambiguous commands", () => {
  assert.deepEqual(normalizePublicationCommand(command), command);
  assert.deepEqual(normalizePublicationQuery({ reportId: "report", eventRevision: "999999999999999999999999999999" }), { reportId: "report", eventRevision: "999999999999999999999999999999" });
  for (const patch of [{ scope: {} }, { actor: "forged" }, { action: "generated" }, { expectedEventRevision: undefined }, { reportRevision: 1 }, { manifestSha256: "A".repeat(64) }, { reasonRef: "" }, { commandId: "*" }]) assert.throws(() => normalizePublicationCommand({ ...command, ...patch } as typeof command));
  assert.throws(() => normalizePublicationQuery({ reportId: "report", revision: "1" } as { reportId: string }));
});
test("publication requires a current generated version and complete fresh evidence separately", () => {
  const report = { revision: "1", currentRevision: "1", freshness: "current", manifest: { capturedFreshness: "current", dataCompleteness: "complete" } } as PublicationState["report"];
  assert.doesNotThrow(() => assertPublishable(report));
  assert.throws(() => assertPublishable({ ...report, currentRevision: "2" }), /report_stale/);
  assert.throws(() => assertPublishable({ ...report, freshness: "stale" }), /report_stale/);
  assert.throws(() => assertPublishable({ ...report, manifest: { ...report.manifest, capturedFreshness: "stale" } }), /report_stale/);
  assert.throws(() => assertPublishable({ ...report, manifest: { ...report.manifest, dataCompleteness: "incomplete" } }), /report_incomplete/);
});
