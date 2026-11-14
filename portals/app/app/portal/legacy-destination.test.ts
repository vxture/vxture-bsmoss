import { test } from "node:test";
import assert from "node:assert/strict";
import { legacyDestination } from "./legacy-destination";
import { taskFromUrl } from "../operations/data-updates/client";

test("legacy routes have fixed destinations and preserve duplicate and encoded deep-link data", () => {
  assert.equal(legacyDestination("updates", {}), "/operations/data-updates");
  assert.equal(legacyDestination("aggregation", { job: "a/b", city: "610100", empty: "", omitted: undefined }), "/operations/aggregation?job=a%2Fb&city=610100&empty=");
  assert.equal(legacyDestination("reports", { kind: "export", job: "j 1" }), "/reports/tasks?kind=export&job=j+1");
  assert.equal(legacyDestination("preferences", {}), "/settings/overview");
  const id = "a".repeat(64), href = legacyDestination("updates", { task: [id, id], next: "https://example.invalid" });
  const url = new URL(href, "http://localhost");
  assert.equal(url.pathname, "/operations/data-updates");
  assert.deepEqual(url.searchParams.getAll("task"), [id, id]);
  assert.throws(() => taskFromUrl(url.toString()), /invalid_task_link/);
});
