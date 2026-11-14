import { cookies } from "next/headers";
import { readTowerPreview } from "../domains/tower-service/history-reader";
import { historyId, parseHistoryId, DAY } from "../domains/tower-service/history-calendar";
import { PREVIEW_COOKIE } from "../domains/tower-service/preview";
import type { PortalDemo } from "./demo";

// Compare distinct sites with effective service at each month end.
export async function homeGrowth(demo: PortalDemo) {
 const month = demo.report.window.start.slice(0, 10);
 const snapshotId = historyId("month", month);
 const period = parseHistoryId(snapshotId);
 if (!period?.complete) return null;
 const { history, scope } = await readTowerPreview({ snapshotId }, (await cookies()).get(PREVIEW_COOKIE)?.value);
 const start = Date.parse(history.start);
 const before = (Date.parse(period.start) - start - 1) / DAY;
 const after = (Date.parse(period.to) - start - 1) / DAY;
 if (before < 0 || after >= history.days) return null;
 const current = new Set<number>(), baseline = new Set<number>();
 const { cityId, countyId } = demo.query;
 for (const relation of history.relations) {
  const site = history.sites[relation.site];
  if (!scope.siteIds.has(site.id) || !scope.operators.includes(relation.operator) ||
      (cityId !== "all" && site.city !== cityId) || (countyId !== "all" && site.county !== countyId)) continue;
  if (relation.from <= before && before < relation.to) baseline.add(relation.site);
  if (relation.from <= after && after < relation.to) current.add(relation.site);
 }
 return { net: current.size - baseline.size, entered: [...current].filter(id => !baseline.has(id)).length,
  exited: [...baseline].filter(id => !current.has(id)).length, current: current.size };
}
export type HomeGrowth = Awaited<ReturnType<typeof homeGrowth>>;
