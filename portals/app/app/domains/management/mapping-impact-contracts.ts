import type { MeasurementScope } from "../measurements/store.ts";
export interface MappingImpactScopes { aggregates?: MeasurementScope; reports?: MeasurementScope }
export type ImpactPage<T> = { status: "not_authorized" } | { status: "authorized_current_heads"; items: T[]; hasMore: boolean };
export interface AggregateImpact { id: string; revision: string; metricKey: string; grain: string; period: { start: string; end: string } }
export interface ReportImpact { id: string; revision: string; title: string; grain: string; period: { start: string; end: string } }
export interface MappingImpacts { aggregates: ImpactPage<AggregateImpact>; reports: ImpactPage<ReportImpact> }
