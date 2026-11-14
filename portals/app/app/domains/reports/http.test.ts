import { test } from "node:test";
import assert from "node:assert/strict";
import { reportCommand, reportHttpError } from "./http.ts";
import { normalizeGenerateReport } from "./rules.ts";
import { normalizePublicationCommand } from "./publication.ts";
import { normalizeExportRequest } from "./exports.ts";
const session = { enabled: true, sid: "opaque-rp-cookie", appOrigin: "https://bsmoss.example" };
const command = { templateCode: "daily", templateVersion: 1, at: "2026-07-06T00:00:00+08:00", expectedRevision: null };
const post = (body: string = JSON.stringify(command), headers: Record<string, string> = {}, suffix = "") => new Request("https://untrusted-host.example/api/reports" + suffix,
  { method: "POST", body, headers: { origin: session.appOrigin, "content-type": "application/json", ...headers } });
function guard(response: Response, status: number) { assert.equal(response.status, status); assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("vary"), "Cookie"); assert.equal(response.headers.get("x-content-type-options"), "nosniff"); }
test("report writes reject missing sessions and origins bound to request URLs or forwarded hosts before executing", async () => {
  let calls = 0; const execute = async () => { calls++; return {}; };
  for (const s of [{ ...session, enabled: false }, { ...session, sid: undefined }]) guard(await reportCommand(post(), s, normalizeGenerateReport, execute), 401);
  for (const origin of ["", "null", "https://untrusted-host.example", "https://attacker.example", session.appOrigin + "/"]) guard(await reportCommand(post(undefined, { origin, "x-forwarded-host": "attacker.example" }), session, normalizeGenerateReport, execute), 403);
  for (const appOrigin of ["", "invalid", "https://bsmoss.example/path", "data:text/plain,a"]) guard(await reportCommand(post(), { ...session, appOrigin }, normalizeGenerateReport, execute), 403);
  assert.equal(calls, 0);
});
test("report command stream is bounded even with a forged length and selectors cannot carry client scopes", async () => {
  let calls = 0; const execute = async () => { calls++; return {}; };
  for (const body of ["{", "null", "[]", JSON.stringify({ ...command, scope: {} }), JSON.stringify({ ...command, workspaceId: "forged" })]) guard(await reportCommand(post(body), session, normalizeGenerateReport, execute), 400);
  guard(await reportCommand(post(" ".repeat(16385), { "content-length": "1" }), session, normalizeGenerateReport, execute), 413);
  guard(await reportCommand(post(undefined, {}, "?workspaceId=forged"), session, normalizeGenerateReport, execute), 400);
  for (const content of ["text/plain", "application/jsonp", "application/json; charset=iso-8859-1"]) guard(await reportCommand(post(undefined, { "content-type": content }), session, normalizeGenerateReport, execute), 415);
  assert.equal(calls, 0);
});
test("report HTTP commands delegate normalized selectors with only the opaque server session and immutable command IDs", async () => {
  const response = await reportCommand(post(undefined, { "content-type": "application/json; charset=UTF-8" }), session, normalizeGenerateReport, async (sid, value) => {
    assert.equal(sid, session.sid); assert.deepEqual(value, { ...command, at: "2026-07-05T16:00:00.000Z" }); return { status: "inserted" };
  }); guard(response, 200);
  const exportCommand = { reportId: "r", publicationRevision: "90071992547409931234567890", commandId: "command" };
  const exported = await reportCommand(post(JSON.stringify(exportCommand)), session, normalizeExportRequest, async (_sid, value) => { assert.deepEqual(value, exportCommand); return { job: { jobId: "j" } }; }, 202);
  guard(exported, 202); assert.equal((await exported.json()).job.jobId, "j");
  const publication = { reportId: "r", reportRevision: "1", manifestSha256: "a".repeat(64), expectedEventRevision: null, commandId: "publication", action: "published" as const, reasonRef: "review:1" };
  guard(await reportCommand(post(JSON.stringify(publication)), session, normalizePublicationCommand, async (_sid, value) => { assert.deepEqual(value, publication); return {}; }), 200);
});
test("report command conflicts, denied scopes and outages have stable private errors without internal detail", async () => {
  for (const [error, status] of [[Error("identity_required"), 401], [Error("permission_denied"), 403], [Error("report_scope_denied"), 404], [Error("report_unavailable"), 404],
    [Error("report_revision_conflict"), 409], [Error("publication_revision_conflict"), 409], [Error("report_incomplete"), 409], [Object.assign(Error("secret SQL"), { code: "40001" }), 409],
    [Object.assign(Error("secret SQL"), { code: "42501" }), 503], [Error("private server detail"), 503]] as const) {
    const response = reportHttpError(error); guard(response, status); const value = await response.json(); assert.equal(value.retryable, status === 503); assert.ok(!value.message.includes(error.message));
  }
});
