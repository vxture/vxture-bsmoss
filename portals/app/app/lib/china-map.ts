import type { FillLayerSpecification, LineLayerSpecification, GeoJSONSourceSpecification, LngLatBoundsLike } from 'maplibre-gl';

// The basemap contains China resources only. No worldwide tile fallback.
export const CHINA_MAP_BOUNDS: LngLatBoundsLike = [[73, 3], [136, 54]];
// Camera bounds include empty margins; data coverage remains China only.
export const CHINA_CAMERA_BOUNDS: LngLatBoundsLike = [[10, -65], [179, 80]];
export function chinaMinimumZoom(width: number, height: number): number {
  const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
  const countryWidth = 512 * (136 - 73) / 360;
  const countryHeight = 512 * (mercatorY(54) - mercatorY(3)) / (2 * Math.PI);
  // Half of a wide viewport, with vertical breathing room on short screens.
  return Math.log2(Math.max(1, Math.min(width * 0.5 / countryWidth, height * 0.75 / countryHeight)));
}
export const CHINA_MAP_SOURCE: GeoJSONSourceSpecification = {
  type: 'geojson', data: '/geo/china-provinces.geojson',
  attribution: '<a href="https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json" target="_blank" rel="noopener noreferrer">China boundaries: Aliyun DataV</a>',
};

export function chinaMapLayers(fill: string, line: string): [FillLayerSpecification, LineLayerSpecification] {
  return [
    { id: 'china-land', type: 'fill', source: 'china', paint: { 'fill-color': fill, 'fill-opacity': 0.22 } },
    { id: 'china-boundaries', type: 'line', source: 'china', paint: { 'line-color': line, 'line-width': 0.8, 'line-opacity': 0.45 } },
  ];
}
