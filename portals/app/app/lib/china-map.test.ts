import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CHINA_MAP_BOUNDS, CHINA_MAP_SOURCE, chinaMinimumZoom } from './china-map.ts';

test('wide overview uses half the viewport width and short screens retain vertical margins', () => {
  const zoom = chinaMinimumZoom(1440, 1000);
  const width = 512 * 63 / 360 * 2 ** zoom;
  assert.ok(Math.abs(width - 720) < 0.001);
  assert.ok(chinaMinimumZoom(1440, 500) < zoom);
});

test('China basemap is local and includes all province-level resources', () => {
  assert.equal(CHINA_MAP_SOURCE.data, '/geo/china-provinces.geojson');
  const data = JSON.parse(readFileSync(new URL('../../public/geo/china-provinces.geojson', import.meta.url), 'utf8'));
  assert.equal(data.type, 'FeatureCollection');
  const codes = data.features.map((feature: { properties: { adcode: number | string } }) => String(feature.properties.adcode));
  assert.equal(codes.filter((code: string) => /^\d{6}$/.test(code)).length, 34);
  for (const code of ['610000', '710000', '810000', '820000']) assert.ok(codes.includes(code));
  const [[west, south], [east, north]] = CHINA_MAP_BOUNDS as [[number, number], [number, number]];
  function checkCoordinates(value: unknown): void {
    if (!Array.isArray(value)) throw Error('Invalid geometry');
    if (typeof value[0] === 'number') {
      assert.ok(value[0] >= west && value[0] <= east, `Longitude outside camera scope: ${value[0]}`);
      assert.ok(value[1] >= south && value[1] <= north, `Latitude outside camera scope: ${value[1]}`);
    } else value.forEach(checkCoordinates);
  }
  data.features.forEach((feature: { geometry: { coordinates: unknown } }) => checkCoordinates(feature.geometry.coordinates));
});

test('map entries retain padded camera bounds and workbench restores detailed map and opt-in imagery', () => {
  for (const path of ['../board/network-map.tsx', '../product-preview/workbench/map-canvas.tsx']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /maxBounds:\s*CHINA_CAMERA_BOUNDS/);
  }
  const source = readFileSync(new URL('../product-preview/workbench/map-canvas.tsx', import.meta.url), 'utf8');
  assert.match(source, /World_Topo_Map/);
  assert.match(source, /World_Imagery/);
  assert.match(source, /basemap==='satellite'&&!map.getSource\('satellite'\)/);
  assert.match(source, /onBasemap=\{setBasemap\}/);
  assert.match(source, /cluster:true/);
  assert.match(source, /type:'heatmap'/);
});
