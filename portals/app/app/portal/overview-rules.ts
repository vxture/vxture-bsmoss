import { DEMO_DATE, DEMO_VERSION, GIB, siteHour } from "../domains/map-demo/rules";
import { evaluateTopic, TOPIC_KINDS, TOPIC_POLICY } from "../domains/map-demo/topic-rules";
import type { DemoSite, HourMetrics, TopicKind, TopicLevel } from "../domains/map-demo/types";

export type Trigger = "load" | "connection" | "battery" | "temperature" | "intensity";
export function overviewTriggers(topic: TopicKind, m: HourMetrics): Trigger[] {
  if (topic === "capacity") return [
    ...(m.capacity > 0 && m.used / m.capacity >= .85 ? ["load" as const] : []),
    ...(m.attempts > 0 && m.connected / m.attempts < .98 ? ["connection" as const] : []),
  ];
  if (topic === "power") return [
    ...(m.power === "battery" ? ["battery" as const] : []),
    ...(m.temperature >= 35 ? ["temperature" as const] : []),
  ];
  const value = evaluateTopic(topic, m).value;
  return value !== null && value >= .15 ? ["intensity"] : [];
}
export function overviewSignals(sites: readonly DemoSite[], hour: number) {
  const severity = { critical: 0, warning: 1, unknown: 2, normal: 3 };
  return TOPIC_KINDS.map(topic => {
    const rows = sites.map(site => {
      const m = siteHour(site, hour), signal = evaluateTopic(topic, m);
      return { site, m, ...signal };
    });
    const counts = { total: rows.length, normal: 0, warning: 0, critical: 0, unknown: 0 };
    for (const row of rows) counts[row.level]++;
    const priority = rows.filter(row => row.level === "warning" || row.level === "critical")
      .sort((a, b) => severity[a.level] - severity[b.level] ||
        (topic === "power" ? Number(b.m.power === "battery") - Number(a.m.power === "battery") || b.m.temperature - a.m.temperature :
          topic === "capacity" ? (a.secondary ?? 100) - (b.secondary ?? 100) || (b.value ?? 0) - (a.value ?? 0) :
            (b.value ?? 0) - (a.value ?? 0)) || a.site.id.localeCompare(b.site.id))
      .slice(0, 5).map(row => {
        const series = Array.from({ length: hour + 1 }, (_, h) => {
          const m = siteHour(row.site, h), signal = evaluateTopic(topic, m);
          return { hour: h, level: signal.level, value: signal.value, secondary: signal.secondary };
        });
        let streak = 0;
        for (const slot of [...series].reverse()) {
          if (slot.level !== "critical" && slot.level !== "warning") break;
          streak++;
        }
        return { id: topic + ":" + row.site.id, topic, site: { id: row.site.id, name: row.site.name, cityId: row.site.cityId, countyId: row.site.countyId },
          level: row.level as Extract<TopicLevel, "warning" | "critical">, value: row.value, secondary: row.secondary,
          load: row.m.capacity ? row.m.used / row.m.capacity : null, connection: row.m.attempts ? row.m.connected / row.m.attempts : null,
          energyKWh: row.m.energyWh === null ? null : row.m.energyWh / 1000, temperature: row.m.temperature, power: row.m.power,
          triggers: overviewTriggers(topic, row.m), streak, series,
          operators: row.site.operators.map(code => {
            const m = siteHour(row.site, hour, code);
            return { code, bytes: m.bytes, share: row.m.bytes ? m.bytes / row.m.bytes : null,
              load: m.capacity ? m.used / m.capacity : null, connection: m.attempts ? m.connected / m.attempts : null };
          }),
          sourceVersion: DEMO_VERSION, policyVersion: TOPIC_POLICY, evidenceKey: [DEMO_VERSION, TOPIC_POLICY, row.site.id, topic, DEMO_DATE, hour].join("/"),
          flowGiB: row.m.bytes / GIB };
      });
    return { topic, counts, rows: priority };
  });
}
