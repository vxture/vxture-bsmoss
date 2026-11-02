import { test } from "node:test";
import assert from "node:assert/strict";
import { jobHttpError, jobListFromUrl, recoveryCommand } from "./http.ts";

const origin = "https://bsmoss.example", session = { enabled: true, sid: "opaque", appOrigin: origin };
const command = { jobId: "one", expectedAttempt: 1, commandId: "cmd", reasonRef: "review://one" };
const request = (body: unknown = command, headers: Record<string, string> = {}, path = "/api/aggregate-jobs/one/recover") => new Request(origin + path,
  { method: "POST", headers: { origin, "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
test("job HTTP filters strictly reject forged scopes duplicate keys and mismatched cursor state", () => {
  assert.deepEqual(jobListFromUrl(new URL(origin + "/api/aggregate-jobs")), { limit: 20, status: "all" });
  for (const query of ["workspaceId=forged", "limit=1&limit=2", "status=dead&status=all", "status=failed", "limit=01", "limit=26", "after=x"]) assert.throws(() => jobListFromUrl(new URL(origin + "/api/aggregate-jobs?" + query)));
});
test("job recovery writes require authenticated configured origin strict bounded JSON and matching path before execution", async () => {
  let calls = 0; const execute = async (sid: string, c: unknown) => { calls++; assert.equal(sid, "opaque"); assert.deepEqual(c, command); return { status: "inserted" }; };
  assert.equal((await recoveryCommand(request(), { ...session, enabled: false }, "one", execute)).status, 401);
  assert.equal((await recoveryCommand(request(command, { origin: "https://host-forged.example" }), session, "one", execute)).status, 403);
  assert.equal((await recoveryCommand(request(), { ...session, appOrigin: origin + "/" }, "one", execute)).status, 403);
  assert.equal((await recoveryCommand(request(command, {}, "/api/aggregate-jobs/one/recover?scope=forged"), session, "one", execute)).status, 400);
  assert.equal((await recoveryCommand(request(command, { "content-type": "text/plain" }), session, "one", execute)).status, 415);
  assert.equal((await recoveryCommand(request({ ...command, scope: {} }), session, "one", execute)).status, 400);
  assert.equal((await recoveryCommand(request(), session, "other", execute)).status, 400);
  assert.equal((await recoveryCommand(request(" ".repeat(16385)), session, "one", execute)).status, 413); assert.equal(calls, 0);
  const reply = await recoveryCommand(request(), session, "one", execute); assert.equal(reply.status, 202); assert.equal(calls, 1);
  assert.equal(reply.headers.get("cache-control"), "no-store"); assert.equal(reply.headers.get("x-content-type-options"), "nosniff"); assert.ok(reply.headers.get("vary")!.includes("Cookie"));
});
test("job HTTP failures expose only fixed classifications including concurrency conflicts", async () => {
  for (const [error, status] of [[Error("permission_denied"), 403], [Error("identity_required"), 401], [Error("report_scope_denied"), 404], [Error("job_recovery_conflict"), 409],
    [Object.assign(Error("private SQL"), { code: "23505" }), 409], [Error("private database token"), 503]] as const) {
    const r = jobHttpError(error); assert.equal(r.status, status); const text = await r.text(); assert.ok(!text.includes("private"));
  }
});
