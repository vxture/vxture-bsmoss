import { DEMO_SITES, DEMO_REGION } from "../domains/map-demo/resources";
import type { PreviewConfiguration, PreviewStation } from "../domains/management/preview-configuration";

// Only loaded by the server's explicit product-preview branch. No credentials,
// platform identities or formal configuration records enter this catalogue.
export function previewConfigurationCatalog() {
  const stations: PreviewStation[] = DEMO_SITES.map(r => ({ id: r.id, name: r.name, region:
    (DEMO_REGION.cities.find(c => c.id === r.cityId)?.name ?? "") + "\u00b7" + (DEMO_REGION.counties.find(c => c.id === r.countyId)?.name ?? "") }));
  const updatedAt = "2026-10-25T10:00:00.000Z";
  const seed: PreviewConfiguration = { version: 1, sources: [
    { id: "shaanxi-usage", name: "\u9655\u897f\u4e1a\u52a1\u7528\u91cf", category: "usage", method: "file", status: "active", note: "\u6d41\u91cf\u3001\u901a\u8bdd\u3001\u77ed\u4fe1\u7edf\u8ba1", updatedAt },
    { id: "shaanxi-runtime", name: "\u9655\u897f\u8fd0\u884c\u72b6\u6001", category: "runtime", method: "api", status: "active", note: "\u7ad9\u5740\u4e0e\u8bbe\u5907\u8fd0\u884c\u72b6\u6001", updatedAt },
    { id: "shaanxi-energy", name: "\u9655\u897f\u80fd\u6e90\u73af\u5883", category: "energy", method: "file", status: "paused", note: "\u7535\u91cf\u3001\u6e29\u5ea6\u4e0e\u73af\u5883\u6307\u6807", updatedAt },
  ], mappings: stations.slice(0, 12).map((s, i) => ({ id: "mapping-" + (i + 1), sourceId: "shaanxi-usage", externalType: "station", externalId: "SX-SITE-" + String(i + 1).padStart(4, "0"), stationId: s.id, status: "active", note: "", updatedAt })) };
  return { seed, stations };
}
