import type {DemoSite} from './types.ts';
export type HistorySiteType='ground'|'rooftop';
export type HistorySharing='single'|'dual'|'multi';
// Same immutable synthetic attributes as the site registry, independent of usage.
export const syntheticSiteType=(site:DemoSite):HistorySiteType=>site.profile==='urban'?'rooftop':'ground';
export const syntheticSharing=(site:DemoSite):HistorySharing=>site.operators.length===1?'single':site.operators.length===2?'dual':'multi';
