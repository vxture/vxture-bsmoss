// Adapted from the yucer engineering reference for product bsmoss.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlatformEntitlementResolver } from "./platform-resolver";
import { makeEntitlement } from "./resolver";
import { DEFAULT_CACHE_TTL_MS, type PlatformClientConfig } from "./platform-client";
import type { Entitlement } from "./types";

const CFG: PlatformClientConfig = {
  baseUrl: "https://platform.internal",
  accessToken: async () => "tok",
  product: "bsmoss",
};

const WS = "ws_1";

function ent(over: Partial<Entitlement> = {}): Entitlement {
  return makeEntitlement(WS, "bsmoss", { tier: "pro", status: "active", ...over });
}

function platform(script: Array<Entitlement | { entitlement: Entitlement; ttlMs: number } | Error>) {
  let i = 0;
  const calls: string[] = [];
  const fetchImpl = async (_cfg: PlatformClientConfig, workspaceId: string) => {
    calls.push(workspaceId);
    const step = script[Math.min(i, script.length - 1)];
    i += 1;
    if (step instanceof Error) throw step;
    return "entitlement" in step ? step : { entitlement: step, ttlMs: DEFAULT_CACHE_TTL_MS };
  };
  return { fetchImpl, calls };
}

const at = (ms: number) => () => ms;

test("a cold-cache outage falls CLOSED, not open", async () => {

  const { fetchImpl } = platform([new Error("platform down")]);
  const r = new PlatformEntitlementResolver(CFG, { fetchImpl, now: at(1_000) });

  const result = await r.resolve(WS);
  assert.equal(result.tier, null, "no tier means no product access");
  assert.equal(result.status, null);
  assert.equal(result.workspace_id, WS, "the answer is still scoped to the workspace that asked");
  assert.equal(result.product, "bsmoss");
});

test("an expired grant cannot authorize during a platform outage", async () => {
  let clock = 1_000;
  const { fetchImpl } = platform([ent({ tier: "business" }), new Error("down")]);
  const r = new PlatformEntitlementResolver(CFG, { fetchImpl, now: () => clock });

  assert.equal((await r.resolve(WS)).tier, "business");
  clock += 46_000;
  const after = await r.resolve(WS);
  assert.equal(after.tier, null);
});

test("a failure is not cached, so recovery is immediate", async () => {

  let clock = 1_000;
  const { fetchImpl, calls } = platform([new Error("down"), ent()]);
  const r = new PlatformEntitlementResolver(CFG, { fetchImpl, now: () => clock });

  assert.equal((await r.resolve(WS)).tier, null);
  const recovered = await r.resolve(WS);
  assert.equal(recovered.tier, "pro", "the very next call gets the real answer");
  assert.equal(calls.length, 2);
});

test("a good answer is cached for the TTL", async () => {
  let clock = 1_000;
  const { fetchImpl, calls } = platform([ent()]);
  const r = new PlatformEntitlementResolver(CFG, { fetchImpl, now: () => clock });

  await r.resolve(WS);
  clock += 44_000;
  await r.resolve(WS);
  assert.equal(calls.length, 1, "entitlement is read on every gated render; 45s of cache is the point");

  clock += 2_000;
  await r.resolve(WS);
  assert.equal(calls.length, 2);
});

test("the cache follows this fetch's own ttlMs, not a fixed constant", async () => {

  let clock = 1_000;
  const calls: string[] = [];
  const fetchImpl = async (_c: PlatformClientConfig, id: string) => {
    calls.push(id);
    return { entitlement: ent(), ttlMs: 5_000 };
  };
  const r = new PlatformEntitlementResolver(CFG, { fetchImpl, now: () => clock });

  await r.resolve(WS);
  clock += 4_000;
  await r.resolve(WS);
  assert.equal(calls.length, 1, "still within the 5s this response asked for");

  clock += 2_000;
  await r.resolve(WS);
  assert.equal(calls.length, 2, "expired at 5s, not at the 45s default");
});

test("two workspaces never share a cached entitlement", async () => {

  const answers = new Map([
    ["ws_a", makeEntitlement("ws_a", "bsmoss", { tier: "enterprise", status: "active" })],
    ["ws_b", makeEntitlement("ws_b", "bsmoss", { tier: null, status: null })],
  ]);
  const fetchImpl = async (_c: PlatformClientConfig, id: string) => ({ entitlement: answers.get(id)!, ttlMs: DEFAULT_CACHE_TTL_MS });
  const r = new PlatformEntitlementResolver(CFG, { fetchImpl, now: at(1_000) });

  assert.equal((await r.resolve("ws_a")).tier, "enterprise");
  assert.equal((await r.resolve("ws_b")).tier, null);
  assert.equal((await r.resolve("ws_a")).tier, "enterprise", "and neither overwrote the other");
});

test("invalidate drops the entry, which is what the C3 webhook relies on", async () => {

  const { fetchImpl, calls } = platform([ent({ tier: "pro" }), ent({ tier: null, status: "cancelled" })]);
  const r = new PlatformEntitlementResolver(CFG, { fetchImpl, now: at(1_000) });

  assert.equal((await r.resolve(WS)).tier, "pro");
  r.invalidate(WS);
  assert.equal((await r.resolve(WS)).tier, null, "the change took effect immediately");
  assert.equal(calls.length, 2);
});

test("invalidating one workspace leaves the others cached", async () => {

  const fetched: string[] = [];
  const r = new PlatformEntitlementResolver(CFG, {
    fetchImpl: async (_c, id) => {
      fetched.push(id);
      return { entitlement: makeEntitlement(id, "bsmoss", { tier: "pro", status: "active" }), ttlMs: DEFAULT_CACHE_TTL_MS };
    },
    now: at(1_000),
  });

  await r.resolve("ws_a");
  await r.resolve("ws_b");
  assert.deepEqual(fetched, ["ws_a", "ws_b"]);

  r.invalidate("ws_a");
  await r.resolve("ws_a");
  await r.resolve("ws_b");

  assert.deepEqual(fetched, ["ws_a", "ws_b", "ws_a"], "only the named workspace re-fetched");
});

test("a cancelled subscription is a real answer and is cached like one", async () => {

  const { fetchImpl } = platform([ent({ tier: null, status: "cancelled" })]);
  const r = new PlatformEntitlementResolver(CFG, { fetchImpl, now: at(1_000) });

  const result = await r.resolve(WS);
  assert.equal(result.tier, null);
  assert.equal(result.status, "cancelled", "the reason survives even though the decision matches");
});
