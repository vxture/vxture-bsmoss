export const OPERATOR_CODES = ['mobile', 'telecom', 'unicom', 'broadcast', 'other'] as const;
export type Operator = typeof OPERATOR_CODES[number];
export type OperatorFilter = Operator | 'all';
export type { Scene as Profile } from '../business-parameters/classification.ts';
import type { Scene as Profile } from '../business-parameters/classification.ts';
export type Theme = 'status' | 'traffic' | 'energy';
export type Bounds = [number, number, number, number];
export interface CircleSelection { kind:'circle'; center:[number,number]; radiusMeters:number }
export interface PolygonSelection { kind:'polygon'; vertices:[number,number][] }
export type Selection = Bounds | CircleSelection | PolygonSelection;
export interface RegionDefinition {
  id: string; name: string; parentId: string; center: [number, number]; bounds: Bounds; boundaryUrl: string;
  counties: {id: string; cityId: string; name: string; center: [number, number]; bounds: Bounds}[];
  cities: {boundaryUrl: string; id: string; name: string; center: [number, number]; bounds: Bounds}[];
}
export interface DemoSite {
  id: string; name: string; regionId: string; cityId: string; countyId: string; lng: number; lat: number;
  profile: Profile; operators: Operator[]; capacity: number; seed: number;
}
export interface HourMetrics {
  hour: number; bytes: number; upBytes: number; downBytes: number; voiceSeconds: number;
  attempts: number; connected: number; sms: number; used: number; capacity: number;
  energyWh: number | null; temperature: number; latency: number;
  status: 'normal' | 'warning' | 'critical'; power: 'mains' | 'battery'; health: number;
}
export type TopicKind='capacity'|'power'|'efficiency';
export type TopicLevel='normal'|'warning'|'critical'|'unknown';
export interface MapQuery { regionId: string; cityId: string; countyId: string; operator: OperatorFilter; hour: number; bbox?: Bounds; selection?: Selection; search: string; topic?:TopicKind }
export interface SitePoint { id: string; name: string; cityId: string; countyId: string; lng: number; lat: number; status: HourMetrics['status']; trafficGiB: number; load: number; energyKWh: number | null; topicLevel?:TopicLevel }
export interface DemoSummary {
  count: number; normal: number; warning: number; critical: number; bytes: number;
  voiceSeconds: number; sms: number; connectionRate: number | null; load: number | null; energyWh: number | null;
}
export interface MapSnapshot {
  contextKey: string; area: AreaAnalysis | null; topic:TopicAnalysis|null; version: string; mode: 'demo'; hour: number; summary: DemoSummary; points: SitePoint[];
  ranking: SitePoint[]; visibleCount: number; truncated: boolean;
}
export interface DemoFinding { severity: 'info' | 'warning' | 'critical'; title: string; detail: string; hour: number }
export interface StationDetail {
  version: string; site: DemoSite; current: HourMetrics; series: HourMetrics[];
  operators: {code: Operator; bytes: number; connected: number; attempts: number; load: number}[];
  findings: DemoFinding[];
}

export interface AreaHour {
  hour:number; bytes:number; voiceSeconds:number; connectionRate:number|null; load:number|null; energyWh:number|null;
}
export interface AreaAnalysis {
  bounds:Bounds;
  selection:Selection;
  operators:{code:Operator; sites:number; bytes:number; voiceSeconds:number; sms:number; connectionRate:number|null}[];
  series:AreaHour[];
}

export interface ComparisonSnapshot {
  contextKey:string; version:string; mode:'demo'; hour:number;
  entries:{id:string;detail:StationDetail|null}[];
}

export interface TopicSignal {level:TopicLevel;value:number|null;secondary:number|null}
export interface TopicCounts {total:number;normal:number;warning:number;critical:number;unknown:number}
export interface TopicAnalysis {
  kind:TopicKind;policyVersion:string;counts:TopicCounts;affectedBytes:number;
  series:(TopicCounts&{hour:number})[];
  cities:(TopicCounts&{cityId:string})[];
  priority:(TopicSignal&{id:string;name:string;cityId:string;bytes:number})[];
}
