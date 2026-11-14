import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAuthorityRevisions, type AuthorityRevision } from "./authority-revisions.ts";

test("authority revision evidence is canonical detached and preserves large exact generations", () => {
  const rows: AuthorityRevision[] = [{ kind: "station_service", id: "svc", revision: "999999999999999999999999999999" },
    { kind: "source_mapping", id: "map", revision: "2" }];
  const actual = normalizeAuthorityRevisions([...rows, rows[0]!]);
  assert.deepEqual(actual, [rows[1], rows[0]]);
  rows[1]!.revision = "3";
  assert.equal(actual[0]!.revision, "2");
});
test("authority revision evidence rejects conflicting generations malformed entries and overflow", () => {
  const row: AuthorityRevision = { kind: "source_mapping", id: "map", revision: "1" };
  assert.throws(() => normalizeAuthorityRevisions([row, { ...row, revision: "2" }]), /conflicting_authority/);
  for (const patch of [{ revision: 1 }, { revision: "01" }, { revision: "0" }, { revision: "9".repeat(31) },
    { id: "*" }, { id: " padded " }, { kind: "other" }, { unexpected: true }]) {
    assert.throws(() => normalizeAuthorityRevisions([{ ...row, ...patch } as AuthorityRevision]), /invalid_authority/);
  }
  assert.throws(() => normalizeAuthorityRevisions(Array(10011).fill(row)), /invalid_authority/);
});
