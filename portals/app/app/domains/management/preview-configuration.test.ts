import { test } from "node:test";
import assert from "node:assert/strict";
import { readPreviewConfiguration, savePreviewSource, savePreviewMapping, type PreviewConfiguration, type PreviewMapping } from "./preview-configuration.ts";
const stations = [{ id: "st1", name: "Station", region: "Shaanxi" }, { id: "st2", name: "Station 2", region: "Shaanxi" }];
const source = { id: "usage", name: "Usage", category: "usage" as const, method: "file" as const, status: "active" as const, note: "", updatedAt: "2026-11-07T00:00:00.000Z" };
const seed: PreviewConfiguration = { version: 1, sources: [source], mappings: [] };
const mapping: PreviewMapping = { id: "m1", sourceId: "usage", externalType: "station", externalId: "external-1", stationId: "st1", status: "active", note: "", updatedAt: source.updatedAt };
test("configuration create edit serialize and reload preserve sources and linked stations", () => {
  let data = savePreviewSource(readPreviewConfiguration(null, seed, stations), { ...source, id: "energy", name: "Energy" }, null);
  data = savePreviewMapping(data, mapping, null, stations);
  data = savePreviewMapping(data, { ...mapping, stationId: "st2", updatedAt: "2026-11-07T01:00:00.000Z" }, mapping.updatedAt, stations);
  data = savePreviewSource(data, { ...source, status: "paused", updatedAt: "2026-11-07T01:00:00.000Z" }, source.updatedAt);
  const reloaded = readPreviewConfiguration(JSON.stringify(data), seed, stations);
  assert.equal(reloaded.sources.length, 2); assert.equal(reloaded.sources[0].status, "paused");
  assert.equal(reloaded.mappings.length, 1); assert.equal(reloaded.mappings[0].stationId, "st2");
  assert.equal(seed.sources[0].status, "active"); assert.equal(seed.mappings.length, 0);
});
test("duplicate source codes and source-object mappings are rejected while editing the original works", () => {
  assert.throws(() => savePreviewSource(seed, source, null));
  const data = savePreviewMapping(seed, mapping, null, stations);
  assert.throws(() => savePreviewMapping(data, { ...mapping, id: "duplicate", stationId: "st2" }, null, stations));
  assert.equal(savePreviewMapping(data, { ...mapping, externalId: "updated" }, mapping.updatedAt, stations).mappings[0].externalId, "updated");
  for (const patch of [{ sourceId: "missing" }, { stationId: "missing" }, { stationId: "" }, { externalId: " " }]) assert.throws(() => savePreviewMapping(seed, { ...mapping, ...patch }, null, stations));
});
test("stale edits and corrupt saved configuration never overwrite or silently reset records", () => {
  assert.throws(() => savePreviewSource(seed, source, "old-time"));
  const data = savePreviewMapping(seed, mapping, null, stations);
  assert.throws(() => savePreviewMapping(data, mapping, "old-time", stations));
  for (const raw of ["{broken", JSON.stringify({ ...seed, version: 99 }), JSON.stringify({ ...seed, sources: [source, source] }), JSON.stringify({ ...data, sources: [] }), JSON.stringify({ ...data, mappings: [mapping, { ...mapping, id: "duplicate" }] })]) assert.throws(() => readPreviewConfiguration(raw, seed, stations));
});
