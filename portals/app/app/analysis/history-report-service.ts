import tokenBundle from './generated-report-tokens.json';
import {createHash} from 'node:crypto';
import {historyAnalysis,historyPresentation,contextForHistory} from './history-model';
import {parseHistoryQuery} from '../domains/map-demo/history-service';
import {CALENDAR_RULE_VERSION} from '../domains/map-demo/period-rules';
import {historyHref,historyReportHref} from './history-links';
export const HISTORY_REPORT_VERSION='bsmoss-history-report-v1';
export function buildHistoryReport(input:Record<string,string|string[]|undefined>){
 const scope=parseHistoryQuery(input),analysis=historyAnalysis(scope),context=contextForHistory(analysis),data=historyPresentation(analysis,context);
 const payload={version:HISTORY_REPORT_VERSION,templateVersion:'bsmoss-history-report-html-v1',designTokensDigest:tokenBundle.digest,sourceVersion:CALENDAR_RULE_VERSION,
  data:{...data,cross:context},coverageBasis:'fixed_resource_cohort' as const,status:'unpublished_synthetic' as const};
 const digest=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 return {id:'HR-'+digest.slice(0,24),revision:1,digest,payload,returnHref:historyHref(scope),
  pageHref:historyReportHref(scope)+'&snapshot='+digest,
  downloadHref:'/api/product-preview/history-report?'+historyHref(scope).split('?')[1]+'&snapshot='+digest};
}
export type HistoryReport=ReturnType<typeof buildHistoryReport>;
export function assertHistorySnapshot(snapshot:string,digest:string){
 if(!/^[a-f0-9]{64}$/.test(snapshot))throw Error('invalid_history_snapshot');
 if(snapshot!==digest)throw Error('history_snapshot_changed');
}
