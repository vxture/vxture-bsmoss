import { test } from "node:test";
import assert from "node:assert/strict";
import { intakeFailure, intakeTaskCommand, intakeRecoveryCommand } from "./intake-tasks.ts";
test("intake task commands admit no caller identity, cursor or configuration", () => {
  assert.deepEqual(intakeTaskCommand({ bindingId: "source-binding", commandId: "command-1" }), { bindingId: "source-binding", commandId: "command-1" });
  for (const extra of ["actor", "workspaceId", "bindingSha256", "cursor", "position"]) assert.throws(() => intakeTaskCommand({ bindingId: "b", commandId: "c", [extra]: "spoof" }));
  for (const value of [null, [], {}, { bindingId: "*", commandId: "c" }]) assert.throws(() => intakeTaskCommand(value as any));
  assert.throws(() => intakeTaskCommand({ bindingId: "b", commandId: "x".repeat(513) }));
});
test("intake recovery pins an exact task and event revision with a review reference", () => {
  const c = { taskId: "a".repeat(64), expectedRevision: "3", commandId: "recover-1", reasonRef: "review://failure" };
  assert.deepEqual(intakeRecoveryCommand(c), c);
  for (const patch of [{ taskId: "../task" }, { expectedRevision: "0" }, { expectedRevision: "01" }, { reasonRef: "" }, { lease: "spoof" }]) assert.throws(() => intakeRecoveryCommand({ ...c, ...patch }));
});
test("intake operational failures never retain upstream secrets or raw exceptions", () => {
  assert.equal(intakeFailure(Error("https://upstream?token=secret")), "intake_failed");
  assert.equal(intakeFailure(Error("database password=secret")), "intake_failed");
  assert.equal(intakeFailure(Error("source_conflicting_replay")), "evidence_invalid");
  assert.equal(intakeFailure(Error("source_configuration_changed")), "context_changed");
  assert.equal(intakeFailure(Error("anything"), true), "cancelled");
});
