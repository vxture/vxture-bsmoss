import {overviewDisplayHref} from "./overview-display-links";
// Fixed internal destinations only. Preserve task deep-link parameters verbatim;
// the destination retains validation of duplicate or invalid task identities.
const destinations = {
  updates: "/operations/data-updates",
  aggregation: "/operations/aggregation",
  reports: "/reports/tasks",
  preferences: "/",
} as const;
export function legacyDestination(kind: keyof typeof destinations, input: Record<string, string | string[] | undefined>) {
  if (kind === "preferences") return overviewDisplayHref();
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(input)) {
    for (const value of Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]) query.append(key, value);
  }
  return destinations[kind] + (query.size ? "?" + query : "");
}
