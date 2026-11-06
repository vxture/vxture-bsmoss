import { sourceIdentity, sourceRevision } from "./source-rules.ts";
import type { MeasurementScope } from "../measurements/store.ts";

export type MappingKind = "site" | "service" | "network" | "device";
export interface MappingQuery { search: string; kind: "all" | MappingKind; limit: number; after?: string }
export interface MappingRecord {
  id: string; sourceId: string; externalType: string; externalId: string;
  stationId: string; stationName: string; serviceId: string | null;
  networkObjectId: string | null; networkKind: string | null; deviceId: string | null;
  version: string; validFrom: string; validTo: string; kind: MappingKind;
  serviceFrom: string | null; serviceTo: string | null; serviceCoversMapping: boolean | null;
}
export function mappingQuery(p: URLSearchParams): MappingQuery {
  if (p.toString().length > 24000 || [...p.keys()].some(k => !["search", "kind", "limit", "after"].includes(k) || p.getAll(k).length !== 1)) throw Error("invalid_management_query");
  const search = p.get("search") ?? "", kind = p.get("kind") ?? "all", limit = p.get("limit") ?? "20", after = p.get("after") ?? undefined;
  if (search.length > 100 || search !== search.trim() || search === "*" || /[\x00-\x1f\x7f]/.test(search) || !["all", "site", "service", "network", "device"].includes(kind) || !/^([1-9]|[1-4][0-9]|50)$/.test(limit)) throw Error("invalid_management_query");
  if (after !== undefined) sourceIdentity(after);
  return { search, kind: kind as MappingQuery["kind"], limit: +limit, ...(after === undefined ? {} : { after }) };
}
function identifier(v: unknown): asserts v is string { if (typeof v !== "string") throw Error(); sourceIdentity(v); }
function at(v: unknown): asserts v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v.replace(/(\.\d{3})\d{3}Z$/, "$1Z")) throw Error();
}
// Definition visibility follows the same object scope as measurement ingestion.
// No metric compatibility or business approval is inferred from this record.
export function mappingRecord(row: any, scope: MeasurementScope): MappingRecord {
  try {
    for (const key of ["id", "source_id", "external_type", "external_id", "station_id", "station_name"]) identifier(row[key]);
    for (const key of ["service_id", "network_object_id", "device_id"]) if (row[key] !== null) identifier(row[key]);
    sourceRevision(row.version); at(row.valid_from); at(row.valid_to);
    if (row.workspace_id !== scope.workspaceId || !scope.sourceIds.includes(row.source_id) || !scope.stationIds.includes(row.station_id) ||
        row.service_id && !scope.serviceIds.includes(row.service_id) || row.device_id && !scope.deviceIds.includes(row.device_id) ||
        !row.service_id && !row.device_id && !scope.allowSiteParameters) throw Error();
    if (row.valid_from >= row.valid_to || row.linked_station !== row.station_id ||
        row.network_object_id && (!row.service_id || row.device_id || row.network_station !== row.station_id || row.network_service !== row.service_id || !["base_station", "cell", "statistic_point"].includes(row.network_kind)) ||
        !row.network_object_id && row.network_kind !== null || row.device_id && row.device_station !== row.station_id) throw Error();
    if (row.service_id) {
      at(row.service_from); at(row.service_to);
      if (row.service_station !== row.station_id || row.service_from >= row.service_to) throw Error();
    } else if (row.service_from !== null || row.service_to !== null) throw Error();
    return { id: row.id, sourceId: row.source_id, externalType: row.external_type, externalId: row.external_id,
      stationId: row.station_id, stationName: row.station_name, serviceId: row.service_id, networkObjectId: row.network_object_id,
      networkKind: row.network_kind, deviceId: row.device_id, version: row.version, validFrom: row.valid_from, validTo: row.valid_to,
      kind: row.device_id ? "device" : row.network_object_id ? "network" : row.service_id ? "service" : "site",
      serviceFrom: row.service_from, serviceTo: row.service_to,
      serviceCoversMapping: row.service_id ? row.service_from <= row.valid_from && row.service_to >= row.valid_to : null };
  } catch { throw Error("invalid_mapping_record"); }
}
