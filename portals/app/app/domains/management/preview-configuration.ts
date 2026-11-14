export const PREVIEW_CONFIGURATION_KEY = "bsmoss-preview-configuration-v1";
export const categoryNames = { usage: "\u7ecf\u8425\u7528\u91cf", runtime: "\u8fd0\u884c\u72b6\u6001", energy: "\u80fd\u6e90\u73af\u5883" };
export const methodNames = { file: "\u6587\u4ef6\u5bfc\u5165", api: "\u63a5\u53e3\u63a5\u5165" };
export const objectNames = { station: "\u7ad9\u5740", cell: "\u5c0f\u533a", device: "\u8bbe\u5907" };
export interface PreviewStation { id: string; name: string; region: string }
export interface PreviewSource {
  id: string; name: string; category: keyof typeof categoryNames; method: keyof typeof methodNames;
  status: "active" | "paused"; note: string; updatedAt: string;
}
export interface PreviewMapping {
  id: string; sourceId: string; externalType: keyof typeof objectNames; externalId: string;
  stationId: string; status: "active" | "paused"; note: string; updatedAt: string;
}
export interface PreviewConfiguration { version: 1; sources: PreviewSource[]; mappings: PreviewMapping[] }
const text = (v: unknown, max: number, optional = false): v is string => typeof v === "string" && v.length <= max && (optional || !!v.trim());
function sourceValid(r: PreviewSource) {
  return r && text(r.id, 64) && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(r.id) && text(r.name, 80) &&
    Object.hasOwn(categoryNames, r.category) && Object.hasOwn(methodNames, r.method) &&
    ["active", "paused"].includes(r.status) && text(r.note, 500, true) && Number.isFinite(Date.parse(r.updatedAt));
}
function mappingValid(r: PreviewMapping, sources: PreviewSource[], stations: PreviewStation[]) {
  return r && text(r.id, 80) && sources.some(s => s.id === r.sourceId) && stations.some(s => s.id === r.stationId) &&
    Object.hasOwn(objectNames, r.externalType) && text(r.externalId, 120) && ["active", "paused"].includes(r.status) &&
    text(r.note, 500, true) && Number.isFinite(Date.parse(r.updatedAt));
}
const mappingKey = (r: PreviewMapping) => JSON.stringify([r.sourceId, r.externalType, r.externalId]);
export function readPreviewConfiguration(raw: string | null, seed: PreviewConfiguration, stations: PreviewStation[]): PreviewConfiguration {
  if (raw === null) return structuredClone(seed);
  try {
    const data = JSON.parse(raw) as PreviewConfiguration;
    if (data.version !== 1 || !Array.isArray(data.sources) || !Array.isArray(data.mappings) ||
      !data.sources.every(sourceValid) || !data.mappings.every(r => mappingValid(r, data.sources, stations)) ||
      new Set(data.sources.map(r => r.id)).size !== data.sources.length ||
      new Set(data.mappings.map(r => r.id)).size !== data.mappings.length ||
      new Set(data.mappings.map(mappingKey)).size !== data.mappings.length) throw Error();
    return data;
  } catch { throw Error("\u672c\u673a\u914d\u7f6e\u65e0\u6cd5\u8bfb\u53d6\uff0c\u539f\u8bb0\u5f55\u5df2\u4fdd\u7559\u3002\u8bf7\u68c0\u67e5\u6d4f\u89c8\u5668\u5b58\u50a8\u6216\u8054\u7cfb\u7ba1\u7406\u5458\u3002"); }
}
export function savePreviewSource(data: PreviewConfiguration, draft: PreviewSource, expected: string | null): PreviewConfiguration {
  const next = { ...draft, id: draft.id.trim(), name: draft.name.trim(), note: draft.note.trim() };
  if (!sourceValid(next)) throw Error("\u8bf7\u586b\u5199\u5b8c\u6574\u7684\u6765\u6e90\u540d\u79f0\u3001\u7f16\u7801\u3001\u4e1a\u52a1\u7c7b\u522b\u548c\u63a5\u5165\u65b9\u5f0f\u3002\u7f16\u7801\u53ea\u80fd\u5305\u542b\u5b57\u6bcd\u3001\u6570\u5b57\u3001\u4e0b\u5212\u7ebf\u6216\u77ed\u6a2a\u7ebf\u3002");
  const old = data.sources.find(r => r.id === next.id);
  if (expected === null && old) throw Error("\u6765\u6e90\u7f16\u7801\u5df2\u5b58\u5728\uff0c\u8bf7\u4f7f\u7528\u5176\u4ed6\u7f16\u7801\u3002");
  if (expected !== null && old?.updatedAt !== expected) throw Error("\u8be5\u6765\u6e90\u5df2\u5728\u5176\u4ed6\u9875\u9762\u53d8\u66f4\uff0c\u8bf7\u91cd\u65b0\u8bfb\u53d6\u540e\u518d\u7f16\u8f91\u3002");
  return { ...data, sources: old ? data.sources.map(r => r.id === old.id ? next : r) : [...data.sources, next] };
}
export function savePreviewMapping(data: PreviewConfiguration, draft: PreviewMapping, expected: string | null, stations: PreviewStation[]): PreviewConfiguration {
  const next = { ...draft, externalId: draft.externalId.trim(), note: draft.note.trim() };
  if (!mappingValid(next, data.sources, stations)) throw Error("\u8bf7\u9009\u62e9\u6709\u6548\u7684\u6570\u636e\u6765\u6e90\u3001\u5bf9\u8c61\u7c7b\u578b\u548c\u7ad9\u5740\uff0c\u5e76\u586b\u5199\u6765\u6e90\u5bf9\u8c61\u7f16\u7801\u3002");
  const old = data.mappings.find(r => r.id === next.id);
  if (expected === null && old || expected !== null && old?.updatedAt !== expected) throw Error("\u8be5\u6620\u5c04\u5df2\u5728\u5176\u4ed6\u9875\u9762\u53d8\u66f4\uff0c\u8bf7\u91cd\u65b0\u8bfb\u53d6\u540e\u518d\u7f16\u8f91\u3002");
  if (data.mappings.some(r => r.id !== next.id && mappingKey(r) === mappingKey(next))) throw Error("\u8be5\u6765\u6e90\u5bf9\u8c61\u5df2\u6709\u7ad9\u5740\u5173\u8054\uff0c\u8bf7\u7f16\u8f91\u539f\u6620\u5c04\u3002");
  return { ...data, mappings: old ? data.mappings.map(r => r.id === old.id ? next : r) : [...data.mappings, next] };
}
