import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerprintOf } from "../aggregation/intervals.ts";
import type { AccessPorts, LocalGrant, VerifiedIdentity } from "../access/resolve.ts";
import { prepareSourceUpdate } from "./service.ts";
import { PULL_LIMITS, planSourcePull, sourceBinding, sourceHead } from "./rules.ts";
import type { SourceBinding, SourceHead, SourceItem, SourcePage, SourcePosition, SourceReadPort } from "./contracts.ts";

const at = (day: number, hour = 0) => `2026-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;
const clock = Date.parse(at(6, 15));
function fixture() {
  const binding: SourceBinding = { id: "binding-a", revision: "1", sourceId: "source-a", adapterVersion: "adapter-v1", transformVersion: "transform-v1", coverageStart: at(1),
    scope: { workspaceId: "w1", sourceIds: ["source-a"], stationIds: ["station-a"], serviceIds: ["service-a"], deviceIds: [], metricKeys: ["service.data.uplink_bytes@1"], allowSiteParameters: false } };
  const head: SourceHead = { sourceId: "source-a", snapshotId: "snapshot-2", dataRevision: "v2", availableThrough: at(6, 14), changeCursor: "changes-2", completionClaim: null };
  const position: SourcePosition = { bindingSha256: fingerprintOf(sourceBinding(binding)), through: at(6, 12), dataRevision: "v1", changeCursor: "changes-1" };
  let identity: VerifiedIdentity = { sub: "user-a", activeWorkspace: "w1", accountStatus: "active", governanceRoles: [], expiresAt: clock + 60000 };
  const grant: LocalGrant = { workspaceId: "w1", sub: "user-a", active: true, permissions: ["metering.ingest"], scope: structuredClone(binding.scope), expiresAt: clock + 60000 };
  const ports: AccessPorts = { now: () => clock, readVerifiedIdentity: async () => identity,
    readCoverage: async () => ({ workspaceId: "w1", product: "bsmoss", tier: "fixture", bundled: false, expiresAt: clock + 60000 }),
    readLocalGrant: async () => grant, featuresFor: () => ["metering"] };
  const calls: Array<{ after: string | null; from: string; changesAfter: string | null }> = [];
  let heads = 0;
  const connector: SourceReadPort = { head: async () => { heads++; return head; }, page: async ({ plan, after }) => {
    calls.push({ after, from: plan.from, changesAfter: plan.changesAfter });
    return { planId: plan.id, snapshotId: plan.snapshotId, after, items: [item()], next: null };
  } };
  function item(start = at(6, 13), end = at(6, 14), kind: SourceItem["kind"] = "window"): SourceItem {
    return { kind, measurement: { sourceId: "source-a", eventId: "event-a", revision: "1", previousRevision: null, payloadSha256: "a".repeat(64), payloadUri: "evidence://source-a/event-a",
      occurredAt: end, metric: { code: "service.data.uplink_bytes", version: 1 }, componentKey: "uplink", stationId: "station-a", mappingId: "mapping-a", transformVersion: "transform-v1",
      periodStart: start, periodEnd: end, value: { kind: "integer_delta", value: "9007199254740993" } } };
  }
  return { binding, head, position, ports, grant, connector, calls, item, heads: () => heads, setIdentity: (value: VerifiedIdentity) => { identity = value; } };
}

test("incremental plan overlaps exactly 72h and pins historical change position and closed hour", () => {
  const f = fixture(); f.head.availableThrough = "2026-11-06T14:45:00+00:00";
  const plan = planSourcePull(f.binding, f.head, f.position, clock);
  assert.equal(plan.from, at(3, 12)); assert.equal(plan.to, at(6, 14)); assert.equal(plan.changesAfter, "changes-1");
  assert.equal(plan.changesThrough, "changes-2"); assert.equal(plan.snapshotId, "snapshot-2");
  assert.equal(plan.id, planSourcePull(f.binding, f.head, f.position, clock).id);
});
test("initial intake is explicit and bounded; backlog is rejected rather than truncated", () => {
  const f = fixture(); const plan = planSourcePull(f.binding, f.head, null, clock);
  assert.equal(plan.from, at(1)); assert.equal(plan.changesAfter, null);
  f.binding.coverageStart = "2026-01-01T00:00:00Z";
  assert.throws(() => planSourcePull(f.binding, f.head, null, clock), /source_bootstrap_window_required/);
});
test("changed configuration, unknown/regressed/future watermarks cannot advance a plan", () => {
  const f = fixture();
  for (const [value, reason] of [[null, "unknown"], [at(6, 11), "regressed"], [at(6, 16), "future"]] as const) {
    assert.throws(() => planSourcePull(f.binding, { ...f.head, availableThrough: value }, f.position, clock), new RegExp(`source_.*${reason}`));
  }
  assert.throws(() => planSourcePull({ ...f.binding, revision: "2" }, f.head, f.position, clock), /source_configuration_changed/);
  assert.throws(() => planSourcePull(f.binding, { ...f.head, sourceId: "source-b" }, f.position, clock), /source_configuration_changed/);
});
test("canonical timezone identities and incomplete or extra protocol fields are checked", () => {
  const f = fixture();
  assert.equal(sourceHead({ ...f.head, availableThrough: "2026-11-06T22:00:00+08:00" }).availableThrough, at(6, 14));
  assert.throws(() => sourceHead({ ...f.head, availableThrough: "2026-02-30T14:00:00Z" }));
  assert.throws(() => sourceHead({ ...f.head, actor: "forged" }), /invalid_source_contract/);
  assert.throws(() => sourceHead({ ...f.head, changeCursor: "*" }));
  assert.throws(() => sourceBinding({ ...f.binding, scope: { ...f.binding.scope, sourceIds: ["source-a", "source-b"] } }), /invalid_source_scope/);
});
test("preparation keeps exact integer evidence pending and never impersonates an upstream quality decision", async () => {
  const f = fixture(), original = structuredClone(f.position);
  const result = await prepareSourceUpdate(f.ports, f.connector, f.binding, f.position);
  assert.equal(result.state, "prepared"); assert.equal(result.applied, false); assert.equal(result.publishesAvailability, false);
  assert.deepEqual(result.records[0].value, { kind: "integer_delta", value: "9007199254740993" });
  assert.equal(result.records[0].quality.status, "pending"); assert.equal(Object.hasOwn(result.records[0], "workspaceId"), false);
  assert.equal(Object.hasOwn(result.records[0].quality, "decidedBy"), false); assert.deepEqual(f.position, original);
});
test("same-through correction still pulls, unchanged data avoids page traffic", async () => {
  const f = fixture(); f.head.availableThrough = f.position.through;
  f.connector.page = async ({ plan, after }) => { f.calls.push({ after, from: plan.from, changesAfter: plan.changesAfter });
    return { planId: plan.id, snapshotId: plan.snapshotId, after, items: [f.item(at(6, 11), at(6, 12))], next: null }; };
  const correction = await prepareSourceUpdate(f.ports, f.connector, f.binding, f.position);
  assert.equal(correction.state, "prepared"); assert.equal(correction.plan.to, f.position.through);
  f.head.dataRevision = f.position.dataRevision; f.head.changeCursor = f.position.changeCursor;
  const result = await prepareSourceUpdate(f.ports, f.connector, f.binding, f.position);
  assert.equal(result.state, "current"); assert.equal(result.pages, 0); assert.equal(f.calls.length, 1);
});
test("no records is a successful empty preparation, not a committed update or completion proof", async () => {
  const f = fixture();
  f.connector.page = async ({ plan, after }) => ({ planId: plan.id, snapshotId: plan.snapshotId, after, items: [], next: null });
  const result = await prepareSourceUpdate(f.ports, f.connector, f.binding, f.position);
  assert.equal(result.state, "prepared"); assert.equal(result.records.length, 0); assert.equal(result.applied, false);
});
test("page responses with actor fields or malformed numeric records are rejected before any result", async () => {
  const f = fixture();
  f.connector.page = async ({ plan, after }) => ({ planId: plan.id, snapshotId: plan.snapshotId, after, items: [], next: null, actor: "forged" });
  await assert.rejects(prepareSourceUpdate(f.ports, f.connector, f.binding, f.position), /invalid_source_contract/);
  f.connector.page = async ({ plan, after }) => { const item = f.item(); item.measurement.value = { kind: "integer_delta", value: "1.2" };
    return { planId: plan.id, snapshotId: plan.snapshotId, after, items: [item], next: null }; };
  await assert.rejects(prepareSourceUpdate(f.ports, f.connector, f.binding, f.position), /invalid_integer/);
});
test("older late first arrivals and revisions come from the change feed outside overlap", async () => {
  const f = fixture();
  f.connector.page = async ({ plan, after }) => ({ planId: plan.id, snapshotId: plan.snapshotId, after, items: [f.item(at(1), at(1, 1), "change")], next: null });
  const result = await prepareSourceUpdate(f.ports, f.connector, f.binding, f.position);
  assert.equal(result.records[0].periodStart, at(1)); assert.equal(result.records[0].previousRevision, null);
  await assert.rejects(prepareSourceUpdate(f.ports, f.connector, f.binding, null), /invalid_source_item/);
});
test("overlap/change-feed duplicates coalesce; conflicting same-revision replay rejects the whole preparation", async () => {
  const f = fixture(); let conflict = false;
  f.connector.page = async ({ plan, after }) => {
    const item = f.item(); if (after && conflict) item.measurement.value = { kind: "integer_delta", value: "3" };
    return { planId: plan.id, snapshotId: plan.snapshotId, after, items: [item], next: after ? null : "page-2" };
  };
  const result = await prepareSourceUpdate(f.ports, f.connector, f.binding, f.position);
  assert.equal(result.pages, 2); assert.equal(result.received, 2); assert.equal(result.records.length, 1);
  conflict = true; await assert.rejects(prepareSourceUpdate(f.ports, f.connector, f.binding, f.position), /source_conflicting_replay/);
});
test("record manifest is order independent and includes every revision rather than replacing old evidence", async () => {
  const f = fixture(), a = f.item(), b = f.item(); b.measurement.revision = "2"; b.measurement.previousRevision = "1";
  let reverse = false;
  f.connector.page = async ({ plan, after }) => ({ planId: plan.id, snapshotId: plan.snapshotId, after, items: reverse ? [b, a] : [a, b], next: null });
  const first = await prepareSourceUpdate(f.ports, f.connector, f.binding, f.position); reverse = true;
  const second = await prepareSourceUpdate(f.ports, f.connector, f.binding, f.position);
  assert.equal(first.records.length, 2); assert.equal(first.recordsSha256, second.recordsSha256);
});
test("all records must remain in reviewed source, station, metric, transform and window scope", async () => {
  for (const mutate of [
    (m: any) => { m.sourceId = "source-b"; }, (m: any) => { m.stationId = "station-b"; },
    (m: any) => { m.metric.code = "service.sms.success_count"; }, (m: any) => { m.transformVersion = "unreviewed"; },
    (m: any) => { m.periodStart = at(1); }, (m: any) => { m.periodEnd = at(6, 15); },
    (m: any) => { m.workspaceId = "w2"; }, (m: any) => { m.quality = { status: "verified" }; },
  ]) {
    const f = fixture(); f.connector.page = async ({ plan, after }) => { const item = f.item(); mutate(item.measurement);
      return { planId: plan.id, snapshotId: plan.snapshotId, after, items: [item], next: null }; };
    await assert.rejects(prepareSourceUpdate(f.ports, f.connector, f.binding, f.position));
  }
});
test("snapshot or cursor changes, empty continuation and cursor cycles never produce a prepared batch", async () => {
  for (const mode of ["snapshot", "plan", "after", "empty", "cycle"]) {
    const f = fixture(); f.connector.page = async ({ plan, after }) => ({ planId: mode === "plan" ? "wrong" : plan.id,
      snapshotId: mode === "snapshot" ? "wrong" : plan.snapshotId, after: mode === "after" ? "wrong" : after,
      items: mode === "empty" ? [] : [f.item()], next: mode === "empty" || mode === "cycle" ? "again" : null });
    await assert.rejects(prepareSourceUpdate(f.ports, f.connector, f.binding, f.position), /source_snapshot_changed|invalid_source_page|source_cursor_cycle/);
  }
});
test("source claim remains unverified even with a claimed complete watermark", async () => {
  const f = fixture(); f.head.completionClaim = { status: "confirmed", through: at(6, 14), evidenceRef: "evidence://completion/2", evidenceSha256: "b".repeat(64) };
  const result = await prepareSourceUpdate(f.ports, f.connector, f.binding, f.position);
  assert.deepEqual(result.unverifiedCompletionClaim, f.head.completionClaim); assert.equal(result.publishesAvailability, false);
  f.head.completionClaim.through = at(6, 15);
  await assert.rejects(prepareSourceUpdate(f.ports, f.connector, f.binding, f.position), /invalid_source_claim/);
});
test("gate and full required scope are checked before source contact; service ingest remains denied", async () => {
  for (const mode of ["permission", "scope", "service"]) {
    const f = fixture();
    if (mode === "permission") f.grant.permissions = [];
    if (mode === "scope") f.grant.scope.serviceIds = [];
    if (mode === "service") f.setIdentity({ kind: "service", sub: "s2s:bsmoss", callerProduct: "bsmoss", activeWorkspace: "w1", expiresAt: clock + 60000, tokenId: "token" });
    await assert.rejects(prepareSourceUpdate(f.ports, f.connector, f.binding, f.position)); assert.equal(f.heads(), 0);
  }
});
test("revocation during head, page and final recheck discards prepared data", async () => {
  for (const phase of ["head", "page", "final"]) {
    const f = fixture(); let reads = 0;
    if (phase === "head") f.connector.head = async () => { f.grant.active = false; return f.head; };
    if (phase === "page") f.connector.page = async ({ plan, after }) => { f.grant.scope.deviceIds = []; f.grant.scope.stationIds = [];
      return { planId: plan.id, snapshotId: plan.snapshotId, after, items: [f.item()], next: null }; };
    if (phase === "final") f.ports.readLocalGrant = async () => { reads++; if (reads >= 6) f.grant.active = false; return f.grant; };
    await assert.rejects(prepareSourceUpdate(f.ports, f.connector, f.binding, f.position), /permission_denied|report_scope_denied/);
  }
});
test("adapter failure on a later page returns no partial success and retry restarts the same plan", async () => {
  const f = fixture(); let fail = true; const plans: string[] = [];
  f.connector.page = async ({ plan, after }) => { plans.push(plan.id); if (after && fail) throw Error("source_unavailable");
    return { planId: plan.id, snapshotId: plan.snapshotId, after, items: [f.item()], next: after ? null : "page-2" }; };
  await assert.rejects(prepareSourceUpdate(f.ports, f.connector, f.binding, f.position), /source_unavailable/);
  fail = false; assert.equal((await prepareSourceUpdate(f.ports, f.connector, f.binding, f.position)).records.length, 1);
  assert.equal(new Set(plans).size, 1);
});
test("cancellation is propagated even when the adapter ignores its signal", async () => {
  const f = fixture(), controller = new AbortController();
  f.connector.page = async () => { controller.abort(Error("cancelled")); return new Promise(() => {}); };
  await assert.rejects(prepareSourceUpdate(f.ports, f.connector, f.binding, f.position, controller.signal), /cancelled/);
});
test("adapter mutation of request copies cannot change the binding or service plan", async () => {
  const f = fixture();
  f.connector.head = async ({ binding }) => { binding.sourceId = "mutated"; return f.head; };
  f.connector.page = async ({ plan, after, binding }) => { const id = plan.id, snapshotId = plan.snapshotId;
    binding.scope.stationIds = ["mutated"]; plan.to = at(6, 1);
    return { planId: id, snapshotId, after, items: [f.item()], next: null }; };
  assert.equal((await prepareSourceUpdate(f.ports, f.connector, f.binding, f.position)).plan.to, at(6, 14));
  assert.equal(f.binding.sourceId, "source-a");
});
test("page, byte, total record and page count limits reject overflow rather than acknowledging a prefix", async () => {
  for (const mode of ["page", "bytes", "records", "pages", "totalBytes"]) {
    const f = fixture(); let page = 0;
    f.connector.page = async ({ plan, after }) => {
      const count = mode === "page" ? 201 : mode === "records" ? 200 : 1;
      const items = Array.from({ length: count }, () => f.item());
      if (mode === "bytes") items[0].measurement.payloadUri = "x".repeat(PULL_LIMITS.pageBytes);
      if (mode === "totalBytes") items[0].measurement.payloadUri = "x".repeat(700000);
      return { planId: plan.id, snapshotId: plan.snapshotId, after, items, next: `page-${++page}` } satisfies SourcePage;
    };
    await assert.rejects(prepareSourceUpdate(f.ports, f.connector, f.binding, f.position), /invalid_source_page|source_.*(?:bound|bytes)_exceeded/);
  }
});
