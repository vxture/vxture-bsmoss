import {localReportQuery} from '../reports/local-rules';
import {reviewDemoDetail} from '../domains/usage-verification/demo';
import {parseRecordReason} from '../domains/usage-verification/events';
import {parseReviewQuery} from '../domains/usage-verification/query';
import {validSession} from '../domains/usage-verification/indexeddb-store';
import {parseSiteQuery} from '../domains/site-registry/rules';
import {DEMO_REGION,DEMO_SITES} from '../domains/map-demo/resources';
import {parseMapQuery} from '../domains/map-demo/service';
import {parseComparisonIds} from '../domains/map-demo/comparison-rules';
import {parseHistoryQuery,selectHistorySites} from '../domains/map-demo/history-service';
import {parseBusinessQuery} from '../business-analysis/model';
import type {Investigation} from './investigation-links';
export function readInvestigation(input:Record<string,string|string[]|undefined>){
 const {investigation,...rest}=input;
 if(investigation===undefined)return {input:rest,journey:undefined};
 try{
  if(typeof investigation!=='string'||investigation.length>8192)throw Error();
  const v=JSON.parse(investigation);
  if(!v||v.v!==1||typeof v.href!=='string'||Object.keys(v).sort().join(',')!=='href,v'||v.href.length>6000||/[\\#\u0000-\u001f]/.test(v.href))throw Error();
  const [path,query='',extra]=v.href.split('?');if(extra!==undefined)throw Error();
  const p=new URLSearchParams(query),q:Record<string,string>=Object.create(null);
  for(const [key,value] of p){if(Object.hasOwn(q,key)||key==='investigation'||/[\u0000-\u001f]/.test(key+value))throw Error();q[key]=value;}
  let label:string,source:Investigation['source'];
  if(path==='/usage-review/history'||path==='/analysis'||path==='/analysis/report'||(['/capacity','/efficiency'].includes(path)&&q.history==='1')){
   const {snapshot,history,...filter}=q;
   if(snapshot!==undefined&&(path!=='/analysis/report'||!/^[a-f0-9]{64}$/.test(snapshot))||history!==undefined&&!['/capacity','/efficiency'].includes(path))throw Error();
   const scope=parseHistoryQuery(filter);if(path==='/usage-review/history'&&!scope.site)throw Error();selectHistorySites(scope);source='history';label=path==='/analysis'?'\u8fd4\u56de\u7ecf\u8425\u5206\u6790':path==='/analysis/report'?'\u8fd4\u56de\u5386\u53f2\u62a5\u544a':'\u8fd4\u56de\u5386\u53f2\u4f9d\u636e';
  }else if(path==='/usage-review'||path==='/review-history'||/^\/usage-review\/UV-[a-f0-9]{24}$/.test(path)){
   const {recordSession,event,recordReason,...filter}=q;if(recordReason!==undefined){if(path!=='/review-history')throw Error();parseRecordReason(recordReason);}
   if(recordSession!==undefined&&!validSession(recordSession)||event!==undefined&&(!/^\/usage-review\/UV-/.test(path)||!(/^[1-9]\d{0,5}$/).test(event)))throw Error();
   parseReviewQuery(filter);if(path.startsWith('/usage-review/UV-')&&!reviewDemoDetail(path.slice(14),filter))throw Error();source='uv';label=path==='/review-history'?'\u8fd4\u56de\u6838\u9a8c\u8bb0\u5f55':path==='/usage-review'?'\u8fd4\u56de\u6838\u9a8c\u5217\u8868':'\u8fd4\u56de\u539f\u6838\u9a8c';
  }else if(path==='/reports'){
   const f=localReportQuery(q);parseMapQuery(new URLSearchParams({cityId:f.city,countyId:f.county,operator:f.operator}));source='history';label='\u8fd4\u56de\u62a5\u544a\u5e93';
  }else if(path==='/sites'||/^\/sites\/[A-Za-z0-9-]{1,40}$/.test(path)){
   parseSiteQuery(q,DEMO_REGION);if(path!=='/sites'&&!DEMO_SITES.some(s=>s.id===path.slice(7)))throw Error();
   source='snapshot';label=path==='/sites'?'\u8fd4\u56de\u7ad9\u5740\u53f0\u8d26':'\u8fd4\u56de\u7ad9\u5740\u6863\u6848';
  }else if(['/operator-usage','/capacity','/efficiency','/usage-reports'].includes(path)){
   parseBusinessQuery(path.slice(1) as 'operator-usage'|'capacity'|'efficiency'|'usage-reports',q);source='snapshot';label='\u8fd4\u56de\u539f\u5206\u6790';
  }else if(path==='/product-preview'){
   const {site,compare,usage,report,...scope}=q;
   if(site!==undefined&&!DEMO_SITES.some(s=>s.id===site)||usage!==undefined&&!['hour','day','week','month'].includes(usage)||report!==undefined&&!['day','week','month'].includes(report))throw Error();
   if(compare!==undefined)parseComparisonIds(compare);
   const api=new URLSearchParams();for(const [k,val] of Object.entries(scope))api.set(k==='city'?'cityId':k==='county'?'countyId':k,val);
   parseMapQuery(api);source='snapshot';label='\u8fd4\u56de\u7ad9\u7f51\u5730\u56fe';
  }else throw Error();
  return {input:rest,journey:{value:investigation,href:v.href,label,source} as Investigation};
 }catch{throw Error('invalid_investigation');}
}
