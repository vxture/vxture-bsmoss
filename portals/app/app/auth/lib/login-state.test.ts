// Adapted from the yucer engineering reference for product bsmoss.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accessTokenFor,
  grantAuthority,
  resolveLoginState,
  type LoginAuthority,
  type LoginStateDeps,
} from "./login-state";
import { authDropSnapshot } from "./auth-failures";
import type { RpSession } from "./session-store";
import type { OidcConfig } from "./config";
import type { TokenSet } from "./oidc";

const cfg = { clientId: "bsmoss", clientSecret: "s", sessionTtlSeconds: 60 } as OidcConfig;
const NOW = 1_800_000_000;
const CLAIMS = { sub: "u1", active_workspace: "ws-1", name: "Tester" };

function rotatingIdp(opts: { latencyMs?: number; fail?: "refuse" | "network" } = {}) {
  let live = "rt-0";
  let issued = 0;
  const calls: string[] = [];
  const refreshTokens = async (_c: OidcConfig, rt: string): Promise<TokenSet> => {
    calls.push(rt);
    await new Promise((r) => setTimeout(r, opts.latencyMs ?? 15));
    if (opts.fail === "network") throw new Error("fetch failed");
    if (opts.fail === "refuse" || rt !== live) throw new Error("token endpoint 400: invalid_grant");
    issued += 1;
    live = `rt-${issued}`;
    return { access_token: `at-${issued}`, refresh_token: live, token_type: "Bearer", expires_in: 300 };
  };
  const verifyToken = (async () => ({ ...CLAIMS })) as never;
  return { calls, refreshTokens, verifyToken };
}

function world(record: RpSession | null, authorityOf: (now: () => number) => LoginAuthority) {
  const map = new Map<string, RpSession>();
  if (record) map.set("r1", record);
  let locked = false;
  let clock = NOW;
  const now = () => clock;
  const deps: LoginStateDeps = {
    getSession: async (_c, id) => map.get(id) ?? null,
    putSession: async (_c, id, data) => void map.set(id, data),
    deleteSession: async (_c, id) => void map.delete(id),
    acquireCheckLock: async () => (locked ? false : (locked = true)),
    releaseCheckLock: async () => void (locked = false),
    authority: authorityOf(now),
    now,
  };
  return {
    deps,
    peek: () => map.get("r1") ?? null,
    advance: (s: number) => void (clock += s),
    hold: () => void (locked = true),
  };
}

/** A logged-in record whose check falls due in `inSeconds`. */
function record(inSeconds: number, extra: Partial<RpSession> = {}): RpSession {
  return {
    idToken: "id", accessToken: "at-0", refreshToken: "rt-0", sub: "u1", sid: "sid-1",
    accessExpiresAt: NOW + inSeconds, nextCheckAt: NOW + inSeconds, claims: { ...CLAIMS }, ...extra,
  };
}

const counts = () => authDropSnapshot().counts;

test("many sections resolving at once, check due: accounts is asked ONCE and nobody is signed out", async () => {
  const idp = rotatingIdp();
  const w = world(record(-5), (now) => grantAuthority(idp, now));
  const results = await Promise.all(
    Array.from({ length: 8 }, () => resolveLoginState(cfg, "r1", { activity: true }, w.deps)),
  );
  assert.deepEqual(idp.calls, ["rt-0"], "one checker, one question - never a replay");
  for (const r of results) assert.equal(r?.claims.sub, "u1", "every section still sees the member");
  assert.equal(w.peek()?.refreshToken, "rt-1");
});

test("a check that is not due asks nothing", async () => {
  const idp = rotatingIdp();
  const w = world(record(600), (now) => grantAuthority(idp, now));
  assert.equal((await resolveLoginState(cfg, "r1", { activity: true }, w.deps))?.claims.sub, "u1");
  assert.deepEqual(idp.calls, []);
});

test("a request the member did not make (probe, prefetch) never asks - it reads, and does not renew", async () => {
  const idp = rotatingIdp();
  const w = world(record(-5), (now) => grantAuthority(idp, now));
  assert.equal((await resolveLoginState(cfg, "r1", { activity: false }, w.deps))?.claims.sub, "u1");
  assert.deepEqual(idp.calls, [], "an open tab must not keep the login alive by itself");
});

test("while another request holds the check, a section reads the record and carries on - it neither waits nor asks", async () => {
  const idp = rotatingIdp();
  const w = world(record(-5), (now) => grantAuthority(idp, now));
  w.hold();
  assert.equal((await resolveLoginState(cfg, "r1", { activity: true }, w.deps))?.claims.sub, "u1");
  assert.deepEqual(idp.calls, []);
});

test("ACCOUNTS saying no ends the state - once, recorded, and never re-asked on every request", async () => {
  const before = counts().ended_by_accounts;
  const idp = rotatingIdp({ fail: "refuse" });
  const w = world(record(-5), (now) => grantAuthority(idp, now));
  assert.equal(await resolveLoginState(cfg, "r1", { activity: true }, w.deps), null);
  assert.equal(w.peek(), null, "the record is gone");
  assert.equal(counts().ended_by_accounts, before + 1);
  assert.equal(await resolveLoginState(cfg, "r1", { activity: true }, w.deps), null);
  assert.equal(idp.calls.length, 1, "the dead grant is not presented again");
});

test("accounts NOT ANSWERING is not a no: the member stays signed in, and it is retried later", async () => {
  const before = counts().check_unavailable;
  const idp = rotatingIdp({ fail: "network" });
  const w = world(record(-5), (now) => grantAuthority(idp, now));
  assert.equal((await resolveLoginState(cfg, "r1", { activity: true }, w.deps))?.claims.sub, "u1");
  assert.ok(w.peek(), "the record is kept");
  assert.equal(counts().check_unavailable, before + 1);
  // Retried on a later activity, not on the very next request.
  await resolveLoginState(cfg, "r1", { activity: true }, w.deps);
  assert.equal(idp.calls.length, 1);
});

test("a record written before login-state (no claims) is asked once, even without activity", async () => {
  const idp = rotatingIdp();
  const w = world(record(600, { claims: undefined }), (now) => grantAuthority(idp, now));
  assert.equal((await resolveLoginState(cfg, "r1", { activity: false }, w.deps))?.claims.sub, "u1");
  assert.deepEqual(idp.calls, ["rt-0"]);
});

test("the schedule comes from accounts: asked shortly before accounts' deadline, not on a product clock", async () => {
  const idp = rotatingIdp();
  const w = world(record(100), (now) => grantAuthority(idp, now));
  await resolveLoginState(cfg, "r1", { activity: true }, w.deps);
  assert.deepEqual(idp.calls, [], "100s left: not yet");
  w.advance(80);
  await resolveLoginState(cfg, "r1", { activity: true }, w.deps);
  assert.deepEqual(idp.calls, ["rt-0"], "20s left: asked");
  assert.equal(w.peek()?.nextCheckAt, NOW + 80 + 300, "next deadline is what accounts just issued");
});

test("a token for a platform call: fresh one reused; stale one renewed once however many callers ask", async () => {
  const idp = rotatingIdp();
  const fresh = world(record(600), (now) => grantAuthority(idp, now));
  assert.equal(await accessTokenFor(cfg, "r1", fresh.deps), "at-0");
  assert.deepEqual(idp.calls, []);

  const stale = world(record(-5), (now) => grantAuthority(idp, now));
  const tokens = await Promise.all(Array.from({ length: 5 }, () => accessTokenFor(cfg, "r1", stale.deps)));
  assert.deepEqual(tokens, ["at-1", "at-1", "at-1", "at-1", "at-1"]);
  assert.deepEqual(idp.calls, ["rt-0"]);
});

test("no record behind the cookie is simply logged out, and noted", async () => {
  const before = counts().no_record;
  const w = world(null, (now) => grantAuthority(rotatingIdp(), now));
  assert.equal(await resolveLoginState(cfg, "r1", { activity: true }, w.deps), null);
  assert.equal(counts().no_record, before + 1);
});

test("renewal cannot switch the person behind an existing session", async () => {
  const idp = rotatingIdp();
  const w = world(record(-5), now => grantAuthority({ ...idp, verifyToken: (async () => ({ sub: "other-user" })) as never }, now));
  assert.equal(await accessTokenFor(cfg, "r1", w.deps), null);
  assert.equal(w.peek(), null);
});
