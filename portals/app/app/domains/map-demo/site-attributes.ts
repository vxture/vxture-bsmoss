import { sharingType } from "../business-parameters/classification.ts";
import type {DemoSite} from './types.ts';
export type { SiteType as HistorySiteType, SharingType as HistorySharing } from '../business-parameters/classification.ts';
import type { SiteType as HistorySiteType, SharingType as HistorySharing } from '../business-parameters/classification.ts';
// Same immutable synthetic attributes as the site registry, independent of usage.
export const syntheticSiteType=(site:DemoSite):HistorySiteType=>site.profile==='urban'?'rooftop':'ground';
export function syntheticSharing(site:DemoSite):HistorySharing {
  const result=sharingType(site.operators.length);
  if(result===null)throw Error('synthetic_site_without_operator');
  return result;
}
