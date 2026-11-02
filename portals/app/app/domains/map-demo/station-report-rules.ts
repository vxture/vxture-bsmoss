import type {StationPeriod} from './station-period-rules.ts';
import type {MapQuery} from './types.ts';
export const STATION_REPORT_TEMPLATE='bsmoss-demo-station-report-v1';
export interface StationReportReference {id:string;templateVersion:string}
export interface StationReport extends StationReportReference {
  mode:'demo';status:'draft';analysis:StationPeriod;
  scope:Pick<MapQuery,'regionId'|'cityId'|'countyId'|'operator'|'search'> & {selection:MapQuery['selection']|null};
}
