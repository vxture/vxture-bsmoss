// Adapted from the yucer engineering reference for product bsmoss.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REFUSAL_CODES,
  envelope,
  errorResponse,
  isValidErrorCode,
  violationEnvelope,
} from "./envelope";

test("retryable is always present, and defaults to false rather than absent", async () => {

  const e = envelope("JOB_TOKEN_INVALID", "nope");
  assert.equal(e.retryable, false);
  assert.equal("retryable" in e, true);
  assert.equal(envelope("X_Y", "m", { retryable: true }).retryable, true);
});

test("field is omitted rather than set to undefined when there is none", () => {

  assert.equal("field" in envelope("A_B", "m"), false);
  assert.equal(envelope("A_B", "m", { field: "body" }).field, "body");
});

test("the two gates map onto the two reserved refusal codes, and stay distinct", () => {

  for (const code of ["no_product_access", "no_data_access", "feature_not_in_tier"]) {
    assert.equal(violationEnvelope(code, "m", "COPILOT").code, "NOT_ENTITLED", code);
  }
  assert.equal(violationEnvelope("permission_denied", "m", "COPILOT").code, "POLICY_DENIED");

  assert.equal(violationEnvelope("quota_exceeded", "m", "COPILOT").code, "QUOTA_EXCEEDED");
});

test("violationEnvelope passes retryable through instead of always forcing false", () => {

  assert.equal(violationEnvelope("model_timeout", "m", "COPILOT", true).retryable, true);
  assert.equal(violationEnvelope("model_timeout", "m", "COPILOT", false).retryable, false);

  assert.equal(violationEnvelope("model_timeout", "m", "COPILOT").retryable, false);

  assert.equal(violationEnvelope("no_product_access", "m", "COPILOT", true).retryable, true);
  assert.equal(violationEnvelope("permission_denied", "m", "COPILOT", true).retryable, true);
  assert.equal(violationEnvelope("quota_exceeded", "m", "COPILOT", true).retryable, true);
});

test("a non-refusal is prefixed, never squeezed into a reserved code", () => {

  assert.equal(violationEnvelope("not_found", "m", "COPILOT").code, "COPILOT_NOT_FOUND");
  assert.equal(
    (REFUSAL_CODES as readonly string[]).includes(violationEnvelope("not_found", "m", "C").code),
    false,
  );
});

test("code validity requires a prefix, not merely upper case", () => {

  assert.equal(isValidErrorCode("COPILOT_NOT_AUTHENTICATED"), true);
  assert.equal(isValidErrorCode("NOT_ENTITLED"), true);
  assert.equal(isValidErrorCode("FORBIDDEN"), false, "one segment is not prefixed");
  assert.equal(isValidErrorCode("copilot_not_found"), false);
  assert.equal(isValidErrorCode("Copilot_NotFound"), false);
});

test("every reserved refusal code is itself legal", () => {
  for (const c of REFUSAL_CODES) assert.equal(isValidErrorCode(c), true, c);
});

test("the response carries the envelope as JSON with the right status", async () => {
  const res = errorResponse(403, "JOB_TOKEN_INVALID", "wrong token");
  assert.equal(res.status, 403);
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(await res.json(), {
    code: "JOB_TOKEN_INVALID",
    message: "wrong token",
    retryable: false,
  });
});
