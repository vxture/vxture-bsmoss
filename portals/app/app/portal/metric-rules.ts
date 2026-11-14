import { calendarSampler, calendarWindow, CALENDAR_RULE_VERSION } from "../domains/map-demo/period-rules";
import { DEMO_DATE, DEMO_VERSION, GIB } from "../domains/map-demo/rules";
import type { DemoSite, HourMetrics } from "../domains/map-demo/types";
import { OVERVIEW_CATALOG_VERSION, OVERVIEW_METRICS, type OverviewMetricId } from "./metric-catalog";

export interface OverviewObservation { siteId: string; metrics: HourMetrics }
export function aggregateOverviewObservations(rows: readonly OverviewObservation[], hour: number) {
  const snapshots = rows.filter(row => row.metrics.hour === hour), siteIds = new Set(rows.map(row => row.siteId));
  const total = (key: "bytes" | "upBytes" | "downBytes" | "voiceSeconds" | "attempts" | "connected" | "sms" | "used" | "capacity",
    source = rows) => source.reduce((n, row) => n + row.metrics[key], 0);
  const ratio = (a: number, b: number) => b > 0 ? a / b : null;
  const energySamples = rows.filter(row => row.metrics.energyWh !== null).length;
  const energy = rows.length && energySamples === rows.length ? rows.reduce((n, row) => n + row.metrics.energyWh!, 0) : null;
  const snapshotCount = (predicate: (m: HourMetrics) => boolean) => snapshots.filter(row => predicate(row.metrics)).length;
  const values: Record<OverviewMetricId, number | null> = {
    flow: total("bytes"), uplink: total("upBytes"), downlink: total("downBytes"), voice: total("voiceSeconds"),
    attempts: total("attempts"), connected: total("connected"), sms: total("sms"), perSiteFlow: ratio(total("bytes"), siteIds.size),
    connection: ratio(total("connected", snapshots), total("attempts", snapshots)), load: ratio(total("used", snapshots), total("capacity", snapshots)),
    dailyConnection: ratio(total("connected"), total("attempts")), dailyLoad: ratio(total("used"), total("capacity")),
    latency: snapshots.length ? snapshots.reduce((n, row) => n + row.metrics.latency, 0) / snapshots.length : null,
    highLoad: snapshotCount(m => m.capacity > 0 && m.used / m.capacity >= .85), normal: snapshotCount(m => m.status === "normal"),
    energy, temperature: snapshots.length ? snapshots.reduce((n, row) => n + row.metrics.temperature, 0) / snapshots.length : null,
    temperatureMax: rows.length ? rows.reduce((v, row) => Math.max(v, row.metrics.temperature), -Infinity) : null,
    hot: snapshotCount(m => m.temperature >= 35), battery: snapshotCount(m => m.power === "battery"), mains: snapshotCount(m => m.power === "mains"),
    batterySites: new Set(rows.filter(row => row.metrics.power === "battery").map(row => row.siteId)).size,
    batteryHours: rows.filter(row => row.metrics.power === "battery").length,
    intensity: energy !== null && total("bytes") > 0 ? energy / 1000 / (total("bytes") / GIB) : null,
  };
  if (!rows.length) for (const id of Object.keys(values) as OverviewMetricId[]) values[id] = null;
  if (!snapshots.length) for (const def of OVERVIEW_METRICS.filter(d => d.basis === "snapshot")) values[def.id] = null;
  return { values, samples: rows.length, snapshotSamples: snapshots.length, energySamples };
}
export function metricChange(current: number | null, previous: number | null, mode: "rate" | "points" | "delta", covered = true) {
  if (!covered || current === null || previous === null) return { status: "unavailable" as const, amount: null };
  if (mode !== "rate") return { status: "comparable" as const, amount: (current - previous) * (mode === "points" ? 100 : 1) };
  return previous === 0 ? { status: current === 0 ? "both_zero" as const : "from_zero" as const, amount: null } :
    { status: "comparable" as const, amount: (current - previous) / previous };
}
export function overviewMetricFacts(sites: readonly DemoSite[], hour: number) {
  const previousDate = calendarWindow("day", "previous").dates[0];
  const current: OverviewObservation[] = [], previous: OverviewObservation[] = [];
  for (const site of sites) {
    const sample = calendarSampler(site);
    for (let h = 0; h < 24; h++) {
      current.push({ siteId: site.id, metrics: sample(DEMO_DATE, h) });
      previous.push({ siteId: site.id, metrics: sample(previousDate, h) });
    }
  }
  const c = aggregateOverviewObservations(current, hour), p = aggregateOverviewObservations(previous, hour);
  return {
    version: OVERVIEW_CATALOG_VERSION, sourceVersion: DEMO_VERSION, ruleVersion: CALENDAR_RULE_VERSION, previousDate,
    currentDate: DEMO_DATE, hour, physicalSites: sites.length, serviceRelations: sites.reduce((n, site) => n + site.operators.length, 0),
    rows: OVERVIEW_METRICS.map(def => {
      const expected = sites.length * (def.basis === "day" ? 24 : 1);
      const observed = def.basis === "snapshot" ? c.snapshotSamples : def.id === "energy" || def.id === "intensity" ? c.energySamples : c.samples;
      const previousObserved = def.basis === "snapshot" ? p.snapshotSamples : def.id === "energy" || def.id === "intensity" ? p.energySamples : p.samples;
      const covered = expected > 0 && observed === expected && previousObserved === expected;
      return { id: def.id, current: c.values[def.id], previous: p.values[def.id], expected, observed, previousObserved,
        change: metricChange(c.values[def.id], p.values[def.id], def.change, covered) };
    }),
  };
}
export type OverviewMetricFacts = ReturnType<typeof overviewMetricFacts>;
