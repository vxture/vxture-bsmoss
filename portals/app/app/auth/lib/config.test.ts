import {getS2SConfig} from '../../platform/s2s';
// Adapted from the yucer engineering reference for product bsmoss.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getOidcConfig } from "./config";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("appOrigin derives from the registered redirect path", () => {
  withEnv({ NEXT_PUBLIC_APP_URL: undefined, OIDC_REDIRECT_URI: "https://bsmoss.vxture.com/api/auth/oidc/callback" }, () => {
    assert.equal(getOidcConfig().appOrigin, "https://bsmoss.vxture.com");
  });
});

test("appOrigin still derives from the contract redirect path", () => {
  withEnv({ NEXT_PUBLIC_APP_URL: undefined, OIDC_REDIRECT_URI: "https://bsmoss.vxture.com/auth/callback" }, () => {
    assert.equal(getOidcConfig().appOrigin, "https://bsmoss.vxture.com");
  });
});

test("an explicit NEXT_PUBLIC_APP_URL wins over the derivation", () => {
  withEnv({ NEXT_PUBLIC_APP_URL: "https://beta.example", OIDC_REDIRECT_URI: "https://bsmoss.vxture.com/api/auth/oidc/callback" }, () => {
    assert.equal(getOidcConfig().appOrigin, "https://beta.example");
  });
});

test("OIDC remains disabled until this product's confidential configuration is complete", () => {
  const valid = { OIDC_RP_ENABLED: "on", OIDC_CLIENT_ID: "bsmoss", OIDC_CLIENT_SECRET: "fixture-secret", OIDC_REDIRECT_URI: "https://product.example/api/auth/oidc/callback", REDIS_URL: "redis://redis:6379" };
  withEnv(valid, () => assert.equal(getOidcConfig().enabled, true));
  for (const missing of ["OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URI", "REDIS_URL"]) {
    withEnv({ ...valid, [missing]: "" }, () => assert.equal(getOidcConfig().enabled, false));
  }
  withEnv({ ...valid, OIDC_CLIENT_ID: "another-product" }, () => assert.equal(getOidcConfig().enabled, false));
});

test("explicit third-party mode accepts its registered client without enabling a product identity",()=>{withEnv({OIDC_RP_ENABLED:'on',OIDC_CLIENT_MODE:'third_party',OIDC_CLIENT_ID:'third-party-client',OIDC_CLIENT_SECRET:'fixture',OIDC_REDIRECT_URI:'https://bsmoss.ruyin.work/api/auth/oidc/callback',REDIS_URL:'redis://redis:6379'},()=>assert.equal(getOidcConfig().enabled,true));});

test("third-party OIDC secret cannot silently enable S2S",()=>{assert.equal(getS2SConfig({OIDC_CLIENT_MODE:'third_party',OIDC_CLIENT_ID:'bsmoss',OIDC_CLIENT_SECRET:'fixture'}).enabled,false)});
