// Minimal catalogue contract: no map engine, router or data-store dependency.
export interface RegionCatalog {
  id: string;
  name: string;
  cities: readonly { id: string; name: string }[];
  counties: readonly { id: string; cityId: string; name: string }[];
}
export interface RegionSelection { cityId: string; countyId: string }
export function normalizeRegion(region: RegionCatalog, value: RegionSelection): RegionSelection {
  const cityId = region.cities.some(city => city.id === value.cityId) ? value.cityId : "all";
  const countyId = region.counties.some(county => county.id === value.countyId && county.cityId === cityId) ? value.countyId : "all";
  return { cityId, countyId };
}
export function regionLabel(region: RegionCatalog, value: RegionSelection): string {
  const valid = normalizeRegion(region, value);
  return [region.name, region.cities.find(city => city.id === valid.cityId)?.name,
    region.counties.find(county => county.id === valid.countyId)?.name].filter(Boolean).join("\u00b7");
}
export function regionOptions(region: RegionCatalog, search: string) {
  const options = [
    { cityId: "all", countyId: "all" },
    ...region.cities.map(city => ({ cityId: city.id, countyId: "all" })),
    ...region.counties.map(county => ({ cityId: county.cityId, countyId: county.id })),
  ];
  const words = search.trim().toLocaleLowerCase().split(/[\s\u00b7/\u3001>]+/).filter(Boolean);
  return options.filter(value => {
    const haystack = (regionLabel(region, value) + " " + region.id + " " + value.cityId + " " + value.countyId).toLocaleLowerCase();
    return words.every(word => haystack.includes(word));
  }).map(value => ({ ...value, label: regionLabel(region, value) }));
}
