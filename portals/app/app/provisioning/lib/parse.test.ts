import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProvisioning } from "./parse";
const event = { id: "delivery-1", type: "tenant.provisioned", workspace_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", application: "bsmoss", seq: 1 };
test("provisioning validates delivery binding, workspace and exact sequence", () => {
  assert.equal(parseProvisioning(JSON.stringify(event), event.id).seq, 1);
  for (const patch of [{ seq: undefined }, { seq: -1 }, { seq: 1.5 }, { seq: Number.MAX_SAFE_INTEGER + 1 }, { workspace_id: "client-workspace" }]) {
    assert.throws(() => parseProvisioning(JSON.stringify({ ...event, ...patch }), event.id));
  }
  assert.throws(() => parseProvisioning(JSON.stringify(event), "other-delivery"));
  assert.throws(() => parseProvisioning("null", event.id));
});
test("notifications have no sequencing authority", () => {
  assert.equal(parseProvisioning(JSON.stringify({ ...event, type: "subscription_changed", seq: undefined }), event.id).seq, 0);
});
