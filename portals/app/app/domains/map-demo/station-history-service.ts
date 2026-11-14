import {createHash} from 'node:crypto';
import {DEMO_SITES} from './resources';
import {CALENDAR_RULE_VERSION} from './period-rules';
import {DAY_MS,HISTORY_END,dateNumber,isoDay} from './history-calendar';
import {queryHistory,selectHistorySites} from './history-service';
import type {HistoryAnalysis,HistoryScope} from './history-rules';
import {syntheticSharing,syntheticSiteType} from './site-attributes';
import {peerPortrait,stationDayEvidence,STATION_HISTORY_VERSION} from './station-history-rules';
import {VERIFICATION_POLICY_VERSION} from '../usage-verification/rules';

export function stationEvidence(scope:HistoryScope) {
  if(!scope.site)throw Error('invalid_history_evidence_site');
  const site=selectHistorySites(scope).find(s=>s.id===scope.site);
  if(!site)return null;
  const date=scope.evidence??isoDay(dateNumber(scope.window.end)-DAY_MS);
  const result=stationDayEvidence(site,date,scope.query.operator,scope.metric);
  const peak=result.hours.reduce((best,row)=>BigInt(row.values[scope.metric])>BigInt(result.hours[best].values[scope.metric])?row.hour:best,0);
  const slot=scope.slot??peak;
  // Digest binds the exact same source counters and reference slots as the panel.
  // It does not represent a persisted case, a publication or an approved cause.
  const digest=createHash('sha256').update(JSON.stringify({calendar:CALENDAR_RULE_VERSION,policy:VERIFICATION_POLICY_VERSION,result})).digest('hex');
  return {...result,slot,selected:result.services.map(s=>({code:s.code,...s.hours[slot]})),
    sourceVersion:CALENDAR_RULE_VERSION,policyVersion:VERIFICATION_POLICY_VERSION,evidenceDigest:digest,
    cutoff:HISTORY_END,referenceId:'HE-'+digest.slice(0,24),revision:1 as const};
}
export function stationHistory(scope:HistoryScope,analysis:HistoryAnalysis) {
  const site=DEMO_SITES.find(s=>s.id===scope.site);
  if(!site||analysis.physicalSites!==1)return null;
  const query=scope.peerLevel==='province'?{...scope.query,cityId:'all',countyId:'all'}:
    scope.peerLevel==='city'?{...scope.query,cityId:site.cityId,countyId:'all'}:scope.query;
  const peerScope={...scope,query,site:undefined,scene:site.profile,siteType:syntheticSiteType(site),sharing:syntheticSharing(site)};
  const cohort=queryHistory(peerScope),portrait=peerPortrait(cohort,analysis.totals,site.id);
  return {portrait,peerScope:{level:scope.peerLevel,cityId:query.cityId,countyId:query.countyId,scene:site.profile,siteType:syntheticSiteType(site),sharing:syntheticSharing(site)},
    evidence:stationEvidence(scope)};
}
export type StationEvidence=NonNullable<ReturnType<typeof stationEvidence>>;
