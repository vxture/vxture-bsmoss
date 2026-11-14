import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveUsageFindings, type ReviewWindow } from "./rules";
import { reviewDemoCases, reviewDemo, reviewDemoDetail } from "./demo";
import { parseReviewQuery } from "./query";
import { reviewHref, reviewMapHref } from "./links";
import { evaluateWave, WAVE_POLICY } from "../map-demo/station-period-rules";
import { quantity } from "../../usage-review/labels";
function window(hour: number, value: string | null = "0"): ReviewWindow {
  const at = Date.parse("2026-10-25T00:00:00+08:00") + hour * 3600000;
  return { start: new Date(at).toISOString(), end: new Date(at + 3600000).toISOString(), value,
    quality: value === null ? "missing" : "verified", complete: value !== null, expected: true, due: true, reason: "", eventId: "fixture-" + hour,
    references: [1, 2, 3, 4].map(weeks => ({ start: new Date(at - weeks * 7 * 86400000).toISOString(), end: new Date(at - weeks * 7 * 86400000 + 3600000).toISOString(), value: "100", quality: "verified", complete: true, reason: "" })) };
}
test("continuous verified zeros form one event, while gaps, inactive, incomplete and quality inputs break the run", () => {
  const complete = [window(0), window(1), window(2)], result = deriveUsageFindings(complete, "sms");
  assert.equal(result.length, 1); assert.equal(result[0].kind, "zero_run"); assert.equal(result[0].windows.length, 3);
  assert.equal(result[0].current, "0"); assert.equal(result[0].referenceNumerator, "600");
  for (const patch of [{ value: null, quality: "missing", complete: false }, { quality: "pending" }, { quality: "rejected" }, { complete: false }, { due: false }, { expected: false }]) {
    const input = structuredClone(complete); Object.assign(input[1], patch);
    const findings = deriveUsageFindings(input, "sms");
    assert.ok(!findings.some(f => f.kind === "zero_run"));
    if (!("expected" in patch) && !("due" in patch)) assert.equal(findings.find(f => f.kind === "missing")?.current, null);
  }
  assert.ok(!deriveUsageFindings([window(0), window(2), window(3)], "sms").some(f => f.kind === "zero_run"));
});
test("quality and baseline precedence never manufacture business changes or finite zero-baseline rates", () => {
  const current = window(0, "150");
  current.references[3] = { ...current.references[3], quality: "missing", value: null, complete: false };
  assert.equal(deriveUsageFindings([current], "sms")[0].kind, "up");
  current.references[2] = { ...current.references[2], quality: "missing", value: null, complete: false };
  assert.equal(deriveUsageFindings([current], "sms")[0].kind, "insufficient");
  current.complete = false;
  assert.equal(deriveUsageFindings([current], "sms")[0].kind, "missing");
  assert.equal(deriveUsageFindings([current], "sms")[0].referenceNumerator, null);
  const zero = [window(0), window(1), window(2)];
  zero.forEach(w => w.references.forEach(r => r.value = "0"));
  assert.deepEqual(deriveUsageFindings(zero, "sms"), []);
  zero[0].value = "20"; const added = deriveUsageFindings(zero, "sms");
  assert.equal(added[0].kind, "from_zero"); assert.equal(added[0].windows[0].wave!.rate, null);
});
test("references are causal distinct same-slot samples, with valid counters and unique normalized windows", () => {
  for (const mutate of [(w: ReviewWindow) => w.references[0].start = w.start, (w: ReviewWindow) => w.references[0] = w.references[1],
    (w: ReviewWindow) => w.value = "-1", (w: ReviewWindow) => w.value = "NaN", (w: ReviewWindow) => w.end = w.start]) {
    const w = window(0); mutate(w); assert.throws(() => deriveUsageFindings([w], "sms"));
  }
  const duplicate = window(0); duplicate.start = "2026-10-25T00:00:00+08:00";
  assert.throws(() => deriveUsageFindings([window(0), duplicate], "sms"));
  const n = "9007199254740993", huge = window(0, n);
  huge.references.forEach(r => r.value = "1");
  const result = deriveUsageFindings([huge], "sms")[0];
  assert.equal(result.current, n); assert.equal(result.deltaNumerator, "18014398509481984");
  assert.equal(quantity(n, "sms"), "9,007,199,254,740,993.00 \u6761");
});
test("versioned demo cases are reproducible and every case is independently reconstructed from exposed windows", () => {
  const cases = reviewDemoCases();
  assert.deepEqual(reviewDemoCases(), cases); assert.equal(new Set(cases.map(c => c.id)).size, cases.length);
  assert.deepEqual([...new Set(cases.map(c => c.kind))].sort(), ["down", "from_zero", "insufficient", "missing", "up", "zero_run"]);
  for (const c of cases) {
    assert.match(c.evidenceDigest, /^[a-f0-9]{64}$/); assert.notEqual(c.operator, "all"); assert.equal(c.state, "open");
    const result = deriveUsageFindings(c.windows, c.metric)[0]; assert.equal(result.kind, c.kind); assert.equal(result.current, c.current);
    for (const w of c.windows.filter(w => w.usable)) {
      assert.deepEqual(w.wave, evaluateWave(w.value!, w.references.filter(r => r.complete && r.quality === "verified").map(r => r.value!), WAVE_POLICY.minimum[c.metric]));
    }
  }
});
test("scope precedes pagination, case identity survives day/week/month and filters have no invented reviewed states", () => {
  const day = reviewDemo({}), week = reviewDemo({ period: "week" }), month = reviewDemo({ period: "month" });
  assert.ok(month.total > week.total && week.total > day.total); assert.equal(day.rows.length, 20);
  assert.equal(day.counts.business + day.counts.quality + day.counts.insufficient, day.total);
  assert.equal(reviewDemo({ page: "9999" }).query.page, day.pages);
  for (const state of ["closed", "awaiting_review"]) assert.equal(reviewDemo({ status: state }).total, 0);
  const first = day.rows[0], scoped = reviewDemo({ city: first.site.cityId, county: first.site.countyId, operator: first.operator, search: first.site.id });
  assert.ok(scoped.total > 0); assert.ok(scoped.rows.every(c => c.site.id === first.site.id && c.operator === first.operator));
  for (const period of ["day", "week", "month"]) assert.equal(reviewDemoDetail(first.id, { period })?.item.evidenceDigest, first.evidenceDigest);
  assert.equal(reviewDemoDetail(first.id, { operator: first.operator === "mobile" ? "telecom" : "mobile" }), null);
  assert.equal(reviewDemoDetail(first.id, { selection: "circle:105,32,1000" }), null);
  assert.equal(reviewDemoDetail("UV-" + "0".repeat(24), {}), null);
  assert.equal(reviewDemoDetail(first.id, { metric: "all", category: "insufficient", page: "3" })?.item.id, first.id);
  const listPage2 = reviewDemo({ page: "2" }); assert.ok(!listPage2.rows.some(c => day.rows.some(d => d.id === c.id)));
});
test("strict queries reject ambiguous scope, unsupported periods and forged authority; links preserve exact supported context", () => {
  for (const bad of [{ city: "110100" }, { county: "610113" }, { city: "610300", county: "610113" }, { city: ["610100", "610200"] },
    { metric: "energy" }, { period: "hour" }, { status: "fixed" }, { category: "critical" }, { page: "0" }, { page: "01" }, { page: "10000" },
    { workspaceId: "forged" }, { evidence: "forged" }, { permissions: "all" }, { hour: "24" }, { search: "a".repeat(81) }]) assert.throws(() => parseReviewQuery(bad));
  const q = parseReviewQuery({ city: "610100", county: "610113", operator: "mobile", period: "week", category: "quality", page: "2", selection: "circle:108.95,34.26,10000" });
  assert.deepEqual(parseReviewQuery(Object.fromEntries(new URL(reviewHref(q), "http://localhost").searchParams)), q);
  const map = new URL(reviewMapHref(q), "http://localhost"); assert.equal(map.searchParams.get("site"), null); assert.equal(map.searchParams.get("selection"), "circle:108.95,34.26,10000");
  assert.throws(() => reviewHref(q, "../settings"));
});
