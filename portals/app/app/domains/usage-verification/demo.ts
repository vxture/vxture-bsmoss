import { createHash } from "node:crypto";
import { DEMO_REGION, DEMO_SITES } from "../map-demo/resources";
import { calendarWindow } from "../map-demo/period-rules";
import { WAVE_POLICY, STATION_PERIOD_VERSION } from "../map-demo/station-period-rules";
import { inSelection } from "../map-demo/geometry";
import type { DemoSite, Operator } from "../map-demo/types";
import type { BusinessMetric } from "../map-demo/period-contribution-rules";
import { deriveUsageFindings, VERIFICATION_POLICY_VERSION, type ReviewWindow, type ReferenceSlot, type UsageFinding, type FindingKind } from "./rules";
import { parseReviewQuery, type ReviewQuery } from "./query";
export const REVIEW_DATASET = "bsmoss-demo-review-scenarios-v1";
export const REVIEW_CUTOFF = "2026-11-01T00:00:00+08:00";
export interface ReviewCase extends UsageFinding {
  id: string; evidenceRevision: 1; evidenceDigest: string; source: typeof REVIEW_DATASET; policyVersion: string; baselineVersion: string;
  site: Pick<DemoSite, "id" | "name" | "cityId" | "countyId" | "lng" | "lat">; operator: Operator; metric: BusinessMetric;
  serviceRelation: string; mappingVersion: string; state: "open";
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function fixtureWindow(site: DemoSite, date: string, hour: number, metric: BusinessMetric, kind: FindingKind, variant: number): ReviewWindow {
  const start = date + "T" + String(hour).padStart(2, "0") + ":00:00+08:00", at = Date.parse(start), minimum = BigInt(WAVE_POLICY.minimum[metric]);
  const end = new Date(at + 3600000).toISOString();
  const base = minimum * BigInt(100 + site.seed % 17);
  const references: ReferenceSlot[] = [97n, 99n, 101n, 103n].map((scale, index) => ({
    start: new Date(at - (index + 1) * 7 * 86400000).toISOString(), end: new Date(at - (index + 1) * 7 * 86400000 + 3600000).toISOString(),
    value: String(kind === "from_zero" ? 0n : base * scale / 100n), quality: "verified", complete: true, reason: "",
  }));
  if (kind === "insufficient") for (const r of references.slice(2)) Object.assign(r, { value: null, quality: "missing", complete: false, reason: "history_unavailable" });
  if (kind === "up" && variant % 2 === 0) Object.assign(references[3], { value: null, quality: "missing", complete: false, reason: "history_unavailable" });
  const quality = kind === "missing" ? (["missing", "pending", "rejected"] as const)[variant % 3] : "verified";
  const value = kind === "zero_run" ? "0" : kind === "from_zero" ? String(minimum * 2n) : kind === "up" ? String(base * 135n / 100n) :
    kind === "down" ? String(base * 60n / 100n) : quality === "missing" ? null : String(base);
  return { start, end, value, quality, complete: kind !== "missing", expected: true, due: true,
    reason: kind === "missing" ? quality === "pending" ? "verification_pending" : quality === "rejected" ? "quality_rejected" : "source_gap" : "",
    eventId: ["REVIEW", site.id, metric, date, hour].join("-"), references };
}
// A bounded, versioned scenario corpus. It does not assert province-wide detection coverage,
// and never replaces the independent station-map or measurement snapshots.
export function reviewDemoCases(): ReviewCase[] {
  const result: ReviewCase[] = [], kinds: FindingKind[] = ["up", "down", "from_zero", "zero_run", "missing", "insufficient"];
  const metrics: BusinessMetric[] = ["bytes", "voiceSeconds", "sms"], dates = ["2026-10-25", "2026-10-22", "2026-10-10"], hours = [18, 17, 16, 12, 10, 9];
  for (const [cityIndex, city] of DEMO_REGION.cities.entries()) {
    const sites = DEMO_SITES.filter(s => s.cityId === city.id).slice(0, 3);
    for (const [variant, site] of sites.entries()) for (const [index, kind] of kinds.entries()) {
      const metric = metrics[(index + variant) % metrics.length], operator = site.operators[(index + variant) % site.operators.length];
      const windows = Array.from({ length: kind === "zero_run" ? 3 : 1 }, (_, h) => fixtureWindow(site, dates[variant], hours[index] + h, metric, kind, cityIndex + variant));
      const findings = deriveUsageFindings(windows, metric);
      if (findings.length !== 1 || findings[0].kind !== kind) throw Error("review_fixture_mismatch");
      const identity = { dataset: REVIEW_DATASET, station: site.id, operator, metric, start: windows[0].start, end: windows[windows.length - 1].end, kind, policy: VERIFICATION_POLICY_VERSION };
      const { id, name, cityId, countyId, lng, lat } = site;
      const evidenceDigest = hash({ identity, windows, baselineVersion: STATION_PERIOD_VERSION });
      result.push({ ...findings[0], id: "UV-" + hash(identity).slice(0, 24), evidenceRevision: 1, evidenceDigest, source: REVIEW_DATASET,
        policyVersion: VERIFICATION_POLICY_VERSION, baselineVersion: STATION_PERIOD_VERSION, site: { id, name, cityId, countyId, lng, lat }, operator, metric,
        serviceRelation: "DEMO-" + id + "-" + operator, mappingVersion: "review-scenario-mapping-v1", state: "open" });
    }
  }
  return result;
}
export function scopedReviewCases(cases: readonly ReviewCase[], q: ReviewQuery): ReviewCase[] {
  const range = calendarWindow(q.period), s = q.scope, needle = s.search.toLowerCase();
  return cases.filter(c => (s.cityId === "all" || c.site.cityId === s.cityId) && (s.countyId === "all" || c.site.countyId === s.countyId) &&
    (s.operator === "all" || c.operator === s.operator) && (!s.selection || inSelection(c.site.lng, c.site.lat, s.selection)) &&
    (!needle || c.site.name.toLowerCase().includes(needle) || c.site.id.toLowerCase().includes(needle)) &&
    Date.parse(c.start) < Date.parse(range.end) && Date.parse(c.end) > Date.parse(range.start));
}
export function reviewDemo(input: Record<string, string | string[] | undefined>) {
  const query = parseReviewQuery(input), scoped = scopedReviewCases(reviewDemoCases(), query);
  const rows = scoped.filter(c => (query.metric === "all" || c.metric === query.metric) && (query.category === "all" || c.category === query.category) && (query.status === "all" || c.state === query.status))
    .sort((a, b) => b.start.localeCompare(a.start) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(rows.length / 20)), page = Math.min(query.page, pages);
  return { query: { ...query, page }, total: rows.length, pages, rows: rows.slice((page - 1) * 20, page * 20), region: DEMO_REGION,
    counts: { business: rows.filter(c => c.category === "business").length, quality: rows.filter(c => c.category === "quality").length, insufficient: rows.filter(c => c.category === "insufficient").length },
    cutoff: REVIEW_CUTOFF, dataset: REVIEW_DATASET,
    scopeName: DEMO_REGION.counties.find(c => c.id === query.scope.countyId)?.name ?? DEMO_REGION.cities.find(c => c.id === query.scope.cityId)?.name ?? DEMO_REGION.name };
}
export function reviewDemoDetail(id: string, input: Record<string, string | string[] | undefined>) {
  const query = parseReviewQuery(input);
  if (!/^UV-[a-f0-9]{24}$/.test(id)) return null;
  // List-only status/category/metric filters must not hide a directly selected case.
  const item = scopedReviewCases(reviewDemoCases(), query).find(c => c.id === id);
  return item ? { query, item, region: DEMO_REGION, cutoff: REVIEW_CUTOFF } : null;
}
export type ReviewListModel = ReturnType<typeof reviewDemo>;
export type ReviewDetailModel = NonNullable<ReturnType<typeof reviewDemoDetail>>;
