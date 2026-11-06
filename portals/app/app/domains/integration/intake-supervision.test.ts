import { test } from "node:test";
import assert from "node:assert/strict";
import { intakeListFromUrl, intakeListQuery } from "./intake-queries.ts";
import { encodeJobCursor } from "../supervision/jobs.ts";
import { intakeTerminationHttp, intakeHttpError } from "./intake-http.ts";
const id = "a".repeat(64), command = { taskId: id, expectedRevision: "2", commandId: "terminate-1", reasonRef: "review://source-changed" };
test("intake pagination accepts only complete bounded query and microsecond task cursor", () => {
  assert.deepEqual(intakeListFromUrl(new URL("https://local/api/intake-tasks")), { limit: 10 });
  const after = encodeJobCursor({ createdAt: "2026-11-06T01:02:03.123456Z", jobId: id, status: "all" });
  assert.deepEqual(intakeListQuery({ limit: 1, after }), { limit: 1, after });
  for (const q of ["?limit=11", "?limit=0", "?limit=01", "?limit=1&limit=2", "?scope=other", "?after=bad", "?after=a&after=b"]) assert.throws(() => intakeListFromUrl(new URL("https://local/api/intake-tasks" + q)), /invalid_intake_query/);
  for (const c of [{ jobId: "arbitrary", status: "all" }, { jobId: id, status: "dead" }]) assert.throws(() => intakeListQuery({ limit: 1, after: encodeJobCursor({ createdAt: "2026-11-06T01:02:03.123456Z", ...c } as any) }));
});
test("termination transport binds RP session, configured origin, exact path, revision and review reference", async () => {
  const session = { enabled: true, sid: "sid", appOrigin: "https://local" }; let calls = 0;
  const execute = async (sid: string, raw: typeof command) => { calls++; assert.equal(sid, "sid"); assert.deepEqual(raw, command); return { state: "terminated" }; };
  const req = (body = JSON.stringify(command), headers = { origin: "https://local", "content-type": "application/json" }, query = "") => new Request("https://local/api/intake-tasks/" + id + "/terminate" + query, { method: "POST", body, headers });
  assert.equal((await intakeTerminationHttp(req(), { ...session, enabled: false }, id, execute)).status, 401);
  assert.equal((await intakeTerminationHttp(req(), { ...session, sid: undefined }, id, execute)).status, 401);
  assert.equal((await intakeTerminationHttp(req(undefined, { origin: "https://evil", "content-type": "application/json" }), session, id, execute)).status, 403);
  assert.equal((await intakeTerminationHttp(req(), { ...session, appOrigin: "https://local/path" }, id, execute)).status, 403);
  assert.equal((await intakeTerminationHttp(req(undefined, { origin: "https://local", "content-type": "text/plain" }), session, id, execute)).status, 415);
  assert.equal((await intakeTerminationHttp(req("x".repeat(4097)), session, id, execute)).status, 413);
  assert.equal((await intakeTerminationHttp(req("{"), session, id, execute)).status, 400);
  assert.equal((await intakeTerminationHttp(req(undefined, undefined, "?extra=1"), session, id, execute)).status, 400);
  assert.equal((await intakeTerminationHttp(req(), session, "b".repeat(64), execute)).status, 400);
  for (const patch of [{ actor: "spoof" }, { cursor: "spoof" }, { expectedRevision: "01" }, { reasonRef: "" }, { commandId: "x".repeat(513) }]) assert.equal((await intakeTerminationHttp(req(JSON.stringify({ ...command, ...patch })), session, id, execute)).status, 400);
  assert.equal(calls, 0);
  const response = await intakeTerminationHttp(req(), session, id, execute);
  assert.equal(response.status, 200); assert.equal(calls, 1); assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(response.headers.get("vary"), "Cookie");
});
test("intake HTTP hides raw errors, distinguishes conflicts and keeps evidence corruption unavailable", async () => {
  for (const m of ["intake_task_busy", "intake_task_revision_conflict", "intake_task_not_terminable", "conflicting_intake_termination"]) assert.equal(intakeHttpError(Error(m)).status, 409);
  for (const m of ["intake_task_unavailable", "report_scope_denied"]) assert.equal(intakeHttpError(Error(m)).status, 404);
  for (const m of ["invalid_intake_task", "invalid_intake_query"]) assert.equal(intakeHttpError(Error(m)).status, 400);
  for (const m of ["invalid_intake_task_evidence", "password=private"]) { const r = intakeHttpError(Error(m)); assert.equal(r.status, 503); assert.doesNotMatch(await r.text(), /password|private|invalid_intake/); }
  assert.equal(intakeHttpError(Error("permission_denied")).status, 403);
  assert.equal(intakeHttpError(Error("access_expired")).status, 401);
});
