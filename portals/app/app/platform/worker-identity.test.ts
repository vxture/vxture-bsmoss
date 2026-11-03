import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { decodeJwt, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { getOidcConfig } from "../auth/lib/config.ts";
import { createWorkerIdentityProvider, verifyWorkerToken } from "./worker-identity.ts";

const workspace = "10000000-0000-0000-0000-000000000001";
const oidc = { ...getOidcConfig(), issuer: "https://identity.example", jwksUrl: "https://identity.example/jwks" };
const keys = await generateKeyPair("RS256"), other = await generateKeyPair("RS256");
const seconds = () => Math.floor(Date.now() / 1000);
async function signed(patch: JWTPayload = {}, header = { alg: "RS256", kid: "test-key" }, key = keys.privateKey) {
  const iat = seconds();
  return new SignJWT({ iss: oidc.issuer, aud: "bsmoss", mode: "service", act: { sub: "bsmoss" },
    workspace_id: workspace, scope: "tool:bsmoss", iat, exp: iat + 300, jti: "test-ticket", ...patch })
    .setProtectedHeader(header).sign(key);
}
const s2s = { tokenUrl: "https://identity.example/token", clientId: "bsmoss-beta", clientSecret: "fixture-only", productCode: "bsmoss", enabled: true };
const result = (token: string, expires = 300) => new Response(JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: expires }));

test("worker proof accepts only the signed service profile and contains no credential or human claims", async () => {
  const token = await signed(), proof = await verifyWorkerToken(token, workspace, oidc, { keyResolver: keys.publicKey });
  assert.deepEqual(proof, { callerProduct: "bsmoss", workspaceId: workspace, expiresAt: decodeJwt(token).exp! * 1000, tokenId: "test-ticket" });
  assert.equal(Object.isFrozen(proof), true);
});

test("worker profile rejects user OBO wrong workspace caller scope issuer audience timestamps and absent evidence", async () => {
  const iat = seconds();
  const patches: JWTPayload[] = [
    { sub: "human" }, { sub: null as unknown as string }, { mode: "obo" }, { mode: undefined }, { act: { sub: "foreign" } }, { act: null },
    { workspace_id: "foreign" }, { scope: "tool:vxture" }, { scope: "tool:bsmoss extra" }, { aud: "vxture" },
    { aud: ["bsmoss"] }, { aud: ["bsmoss", "vxture"] }, { iss: "https://other.example" }, { exp: iat - 1, iat: iat - 300 },
    { iat: iat + 120, exp: iat + 300 }, { iat, exp: iat + 301 }, { iat, exp: iat }, { iat: undefined }, { exp: undefined },
    { jti: undefined }, { jti: " " }, { exp: iat + 0.5 },
  ];
  for (const patch of patches) await assert.rejects(verifyWorkerToken(await signed(patch), workspace, oidc, { keyResolver: keys.publicKey }), /worker_identity_invalid/, JSON.stringify(patch));
  for (const token of [await signed({}, { alg: "RS256", kid: "" }), await signed({}, { alg: "RS256", kid: "k" }, other.privateKey), "x".repeat(16385), "broken"])
    await assert.rejects(verifyWorkerToken(token, workspace, oidc, { keyResolver: keys.publicKey }), /worker_identity_invalid/);
});

test("provider singleflights and caches fixed workspace proofs then refreshes early without stale fallback", async () => {
  let now = Date.now(), calls = 0, fail = false;
  const token = await signed();
  const provider = createWorkerIdentityProvider(workspace, { s2s, oidc, keyResolver: keys.publicKey, now: () => now,
    fetchImpl: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); if (fail) throw Error("secret-upstream-body"); return result(token, 120); } });
  const proofs = await Promise.all(Array.from({ length: 12 }, () => provider()));
  assert.equal(calls, 1); assert.ok(proofs.every(p => p === proofs[0]));
  assert.equal(proofs[0].expiresAt, now + 120000);
  now += 89000; await provider(); assert.equal(calls, 1);
  now += 2000; fail = true;
  await assert.rejects(provider(), e => e instanceof Error && e.message === "worker_identity_unavailable");
  await assert.rejects(provider(), /worker_identity_unavailable/); assert.equal(calls, 3);
  fail = false; await provider(); assert.equal(calls, 4);
  const foreign = createWorkerIdentityProvider("20000000-0000-0000-0000-000000000002", { s2s, oidc, keyResolver: keys.publicKey, fetchImpl: async () => result(token) });
  await assert.rejects(foreign(), /worker_identity_invalid/);
});

test("provider limits streamed and declared bytes validates responses and never leaks endpoint errors", async () => {
  const token = await signed(); let cancelled = false;
  const stream = () => new Response(new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(32769)); }, cancel() { cancelled = true; } }));
  for (const response of [stream(), new Response("{}", { headers: { "content-length": "32769" } }), new Response("not-json"),
    new Response("[]"), new Response("{}"), result(token, 301), result(token, 0), new Response(JSON.stringify({ access_token: token, expires_in: 300, token_type: "Basic" }))]) {
    const provider = createWorkerIdentityProvider(workspace, { s2s, oidc, keyResolver: keys.publicKey, fetchImpl: async () => response });
    await assert.rejects(provider(), /worker_identity_invalid/);
  }
  assert.equal(cancelled, true);
  const provider = createWorkerIdentityProvider(workspace, { s2s, oidc, fetchImpl: async () => new Response("fixture-sensitive-body", { status: 403 }) });
  await assert.rejects(provider(), e => e instanceof Error && e.message === "worker_identity_unavailable");
  let calls = 0;
  for (const config of [{ ...s2s, enabled: false }, { ...s2s, clientId: "foreign" }, { ...s2s, productCode: "foreign" }])
    await assert.rejects(createWorkerIdentityProvider(workspace, { s2s: config, fetchImpl: async () => { calls++; return result(token); } })(), /worker_identity_unconfigured/);
  for (const tokenUrl of ["http://public.example/token", "https://user:password@identity.example/token"])
    await assert.rejects(createWorkerIdentityProvider(workspace, { s2s: { ...s2s, tokenUrl }, fetchImpl: async () => { calls++; return result(token); } })(), /worker_identity_unavailable/);
  assert.equal(calls, 0);
});

test("response latency cannot extend ticket lifetime beyond either the signed expiry or response-start lifetime", async () => {
  const token = await signed(), start = Date.now(); let clock = start;
  const provider = createWorkerIdentityProvider(workspace, { s2s, oidc, keyResolver: keys.publicKey, now: () => clock,
    fetchImpl: async () => { clock += 5000; return result(token, 120); } });
  assert.equal((await provider()).expiresAt, start + 120000);
  clock = start;
  const signedLimit = createWorkerIdentityProvider(workspace, { s2s, oidc, keyResolver: keys.publicKey, now: () => clock, fetchImpl: async () => result(token) });
  assert.equal((await signedLimit()).expiresAt, decodeJwt(token).exp! * 1000);
  const tooLate = createWorkerIdentityProvider(workspace, { s2s, oidc, keyResolver: keys.publicKey, now: () => clock,
    fetchImpl: async () => { clock += 121000; return result(token, 120); } });
  await assert.rejects(tooLate(), /worker_identity_invalid/);
});

test("actual HTTP exchange sends existing client credentials and self audience with no user delegation", async () => {
  const token = await signed(), requests: { url: string; authorization: string; body: string }[] = [];
  const server = createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    requests.push({ url: req.url!, authorization: req.headers.authorization!, body });
    if (req.url === "/redirect") { res.writeHead(302, { location: "/token" }); res.end(); return; }
    res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: 300 }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const provider = createWorkerIdentityProvider(workspace, { s2s: { ...s2s, tokenUrl: base + "/token" }, oidc, keyResolver: keys.publicKey });
    assert.equal((await provider()).workspaceId, workspace);
    assert.equal(requests[0].authorization, "Basic " + Buffer.from("bsmoss-beta:fixture-only").toString("base64"));
    assert.deepEqual(Object.fromEntries(new URLSearchParams(requests[0].body)), {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", audience: "bsmoss",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token", workspace_id: workspace,
    });
    await assert.rejects(createWorkerIdentityProvider(workspace, { s2s: { ...s2s, tokenUrl: base + "/redirect" }, oidc, keyResolver: keys.publicKey })(), /worker_identity_unavailable/);
    assert.equal(requests.length, 2);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
