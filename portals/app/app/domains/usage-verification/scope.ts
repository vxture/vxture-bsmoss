import type {ReviewCase} from "./demo";
import type {ReviewQuery} from "./query";
import {calendarWindow} from "../map-demo/period-rules";
import {inSelection} from "../map-demo/geometry";
export function scopedReviewCases(cases: readonly ReviewCase[], q: ReviewQuery): ReviewCase[] {
  const range = calendarWindow(q.period), s = q.scope, needle = s.search.toLowerCase();
  return cases.filter(c => (!q.site||c.site.id===q.site) && (s.cityId === "all" || c.site.cityId === s.cityId) && (s.countyId === "all" || c.site.countyId === s.countyId) &&
    (s.operator === "all" || c.operator === s.operator) && (!s.selection || inSelection(c.site.lng, c.site.lat, s.selection)) &&
    (!needle || c.site.name.toLowerCase().includes(needle) || c.site.id.toLowerCase().includes(needle)) &&
    Date.parse(c.start) < Date.parse(range.end) && Date.parse(c.end) > Date.parse(range.start));
}
