// Read-only preview adapter. No queue, fake sync completion, or wall-clock data.
import { DEMO_DATE, DEMO_VERSION } from "../map-demo/rules.ts";
import { SAMPLE_CUTOFF, CALENDAR_RULE_VERSION } from "../map-demo/period-rules.ts";
import { HISTORY_END, HISTORY_VERSION } from "../map-demo/history-calendar.ts";
import { REVIEW_CUTOFF, REVIEW_DATASET } from "../usage-verification/demo.ts";
import { AVAILABILITY_SCHEMA, readAvailability, type UpdateFamily, type SourceWatermark } from "./rules.ts";
const dayEnd = new Date(Date.parse(DEMO_DATE + "T00:00:00+08:00") + 86400000).toISOString();
const station: SourceWatermark = { id: "station-day", label: "\u7ad9\u7f51\u65e5\u6570\u636e", version: DEMO_VERSION, through: dayEnd, confirmed: true, syncedAt: null };
const calendar: SourceWatermark = { id: "calendar", label: "\u5468\u671f\u7528\u91cf", version: DEMO_VERSION + "/" + CALENDAR_RULE_VERSION, through: SAMPLE_CUTOFF, confirmed: true, syncedAt: null };
const history: SourceWatermark = { id: "history", label: "\u7ecf\u8425\u5386\u53f2", version: DEMO_VERSION + "/" + HISTORY_VERSION + "/" + CALENDAR_RULE_VERSION, through: HISTORY_END + "T00:00:00+08:00", confirmed: true, syncedAt: null };
// Corpus availability is independent of individual cases' missing/late values.
const verification: SourceWatermark = { id: "verification", label: "\u6838\u9a8c\u573a\u666f\u5e93", version: REVIEW_DATASET, through: REVIEW_CUTOFF, confirmed: true, syncedAt: null };
export function previewAvailability(family: UpdateFamily) {
  const sources = { overview: [station, calendar, verification], station: [station], calendar: [calendar], history: [history], verification: [verification] }[family];
  return readAvailability({ schema: AVAILABILITY_SCHEMA, family, mode: "fixed_synthetic", sources });
}
