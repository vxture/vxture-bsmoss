// Explicit resource refresh; never download geography during app startup/build.
import { writeFile } from 'node:fs/promises';
const source = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';
const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw Error(`China boundaries unavailable: ${response.status}`);
const data = await response.json();
const provinces = data.features?.filter(feature => /^\d{6}$/.test(String(feature.properties?.adcode)));
if (data.type !== 'FeatureCollection' || provinces?.length !== 34 ||
    !provinces.some(feature => Number(feature.properties.adcode) === 610000) ||
    data.features.some(feature => !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type))) {
  throw Error('Unexpected China boundary resource; existing file retained');
}
const ascii = JSON.stringify(data).replace(/[^\x00-\x7f]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
await writeFile(new URL('../portals/app/public/geo/china-provinces.geojson', import.meta.url), ascii + '\n');
console.log(`Saved ${provinces.length} China province-level boundaries and associated map geometry`);
