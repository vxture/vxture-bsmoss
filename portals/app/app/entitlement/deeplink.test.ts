// Adapted from the yucer engineering reference for product bsmoss.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pricingUrl } from "./deeplink";

const KEY = "NEXT_PUBLIC_WEBSITE_URL";

function withEnv(value: string | undefined, fn: () => void): void {
  const saved = process.env[KEY];
  if (value === undefined) delete process.env[KEY];
  else process.env[KEY] = value;
  try {
    fn();
  } finally {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  }
}

test("carries product and nothing else - no intent, no workspace_id, no target_tier, no metric", () => {
  withEnv(undefined, () => {
    const u = new URL(pricingUrl());
    assert.equal(u.pathname, "/pricing");
    assert.equal(u.searchParams.get("product"), "bsmoss");
    assert.equal(u.searchParams.get("intent"), null);
    assert.equal(u.searchParams.get("workspace_id"), null);
    assert.equal(u.searchParams.get("target_tier"), null);
    assert.equal(u.searchParams.get("metric"), null);

    assert.equal([...u.searchParams.keys()].length, 1);
  });
});

test("unset means the public default, because a stack that never declares it still sells somewhere real", () => {
  withEnv(undefined, () => assert.equal(new URL(pricingUrl()).origin, "https://vxture.com"));
});

test("empty does NOT disable this exit, unlike websiteUrl()'s decorative-link opt-out", () => {

  withEnv("", () => assert.equal(new URL(pricingUrl()).origin, "https://vxture.com"));
});

test("a configured base is honoured, trailing slash dropped", () => {
  withEnv("https://example.test/", () => assert.equal(new URL(pricingUrl()).origin, "https://example.test"));
  withEnv("https://example.test", () => assert.equal(new URL(pricingUrl()).origin, "https://example.test"));
});
