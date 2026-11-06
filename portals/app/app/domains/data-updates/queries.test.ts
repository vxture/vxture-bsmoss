import { test } from "node:test";
import assert from "node:assert/strict";
import { updateListFromUrl, updateListQuery } from "./queries.ts";
import { encodeJobCursor } from "../supervision/jobs.ts";
import { taskFromUrl, taskHref, updateError } from "../../settings/operations/data-updates/client.ts";
import { ReportClientError } from "../../reports/client.ts";
test("update list accepts only bounded pages and an exact opaque cursor", () => {
  assert.deepEqual(updateListFromUrl(new URL("https://local/api/data-updates")), { limit: 10 });
  const after = encodeJobCursor({ createdAt: "2026-11-06T01:02:03.123456Z", jobId: "a".repeat(64), status: "all" });
  assert.deepEqual(updateListQuery({ limit: 1, after }), { limit: 1, after });
  for (const query of ["?limit=11", "?limit=0", "?limit=01", "?limit=1&limit=2", "?workspaceId=other", "?after=garbage", "?after=a&after=b"]) assert.throws(() => updateListFromUrl(new URL("https://local/api/data-updates" + query)), /invalid_update_query/);
  const wrong = encodeJobCursor({ createdAt: "2026-11-06T01:02:03.123456Z", jobId: "x", status: "dead" });
  assert.throws(() => updateListQuery({ limit: 10, after: wrong }), /invalid_update_query/);
});
test("task links restore one exact task and never accept arbitrary paths or duplicate identities", () => {
  const id = "b".repeat(64); assert.equal(taskFromUrl("https://local" + taskHref(id)), id);
  assert.equal(taskFromUrl("https://local/settings/operations/data-updates"), null);
  for (const suffix of ["?task=../other", "?task=x", "?task=" + id + "&task=" + id]) assert.throws(() => taskFromUrl("https://local/" + suffix));
  assert.throws(() => taskHref("https://evil"));
});
test("task error text distinguishes authorization and conflicts without showing raw server messages", () => {
  const unauthorized = updateError(new ReportClientError(401, "password=secret")); assert.match(unauthorized, /\u767b\u5f55/); assert.doesNotMatch(unauthorized, /secret/);
  assert.match(updateError(new ReportClientError(409, "anything")), /\u4efb\u52a1/);
  assert.doesNotMatch(updateError(Error("database password=secret")), /secret/);
});
