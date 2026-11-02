import { test } from "node:test";
import assert from "node:assert/strict";
import { ttlMsFromCacheControl, parseEntitlementEnvelope } from "./platform-client";
import { PlatformEntitlementResolver } from "./platform-resolver";
import { makeEntitlement } from "./resolver";

test("explicit cache prohibitions and zero freshness are respected", () => {
  for (const value of ["private, no-store", "no-cache", "max-age=0"]) assert.equal(ttlMsFromCacheControl(value), 0);
  assert.equal(ttlMsFromCacheControl("max-age=900"), 45_000);
});

test("cross-workspace and cross-product envelopes are rejected", () => {
  assert.throws(() => parseEntitlementEnvelope("a", "bsmoss", { workspace_id: "b" }), /scope_mismatch/);
  assert.throws(() => parseEntitlementEnvelope("a", "bsmoss", { product: "other" }), /scope_mismatch/);
});

test("invalidation prevents an in-flight response from restoring an old grant", async () => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const resolver = new PlatformEntitlementResolver({ baseUrl: "https://platform.internal", product: "bsmoss", accessToken: async () => "token" }, {
    fetchImpl: async () => { await waiting; return { entitlement: makeEntitlement("w", "bsmoss", { tier: "pro" }), ttlMs: 45_000 }; },
  });
  const pending = resolver.resolve("w");
  resolver.invalidate("w");
  release();
  assert.equal((await pending).tier, null);
});

test("callers cannot mutate a cached grant", async () => {
  const resolver = new PlatformEntitlementResolver({ baseUrl: "https://platform.internal", product: "bsmoss", accessToken: async () => "token" }, {
    fetchImpl: async () => ({ entitlement: makeEntitlement("w", "bsmoss", { tier: "pro", limits: { stations: 1 } }), ttlMs: 45_000 }),
  });
  (await resolver.resolve("w")).limits.stations = 110_000;
  assert.equal((await resolver.resolve("w")).limits.stations, 1);
});

test("concurrent requests share one entitlement fetch", async () => {
  let calls = 0;
  const resolver = new PlatformEntitlementResolver({ baseUrl: "https://platform.internal", product: "bsmoss", accessToken: async () => "token" }, {
    fetchImpl: async () => { calls++; return { entitlement: makeEntitlement("w", "bsmoss", { tier: "pro" }), ttlMs: 45_000 }; },
  });
  const answers = await Promise.all(Array.from({ length: 10 }, () => resolver.resolve("w")));
  assert.equal(calls, 1);
  assert.ok(answers.every(answer => answer.tier === "pro"));
});
