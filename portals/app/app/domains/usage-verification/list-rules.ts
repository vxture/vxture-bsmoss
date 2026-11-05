import type {ReviewCase} from './demo';
import type {ReviewQuery} from './query';
import type {CaseLog} from './events';
import {recordProjection} from './event-service';
export function reviewRows(cases:readonly ReviewCase[],q:ReviewQuery,logs:readonly CaseLog[],recordsOnly=false,reason='all'){
 const byId=new Map(logs.map(l=>[l.caseId,l]));
 const rows=cases.map(c=>({...c,review:recordProjection(byId.get(c.id),c)})).filter(c=>
  (!recordsOnly||c.review.revision>0)&&(q.metric==='all'||c.metric===q.metric)&&(q.category==='all'||c.category===q.category)&&
  (q.status==='all'||c.review.state===q.status)&&(reason==='all'||c.review.reason===reason)).sort((a,b)=>recordsOnly?
   (b.review.last?.recordedAt??'').localeCompare(a.review.last?.recordedAt??'')||a.id.localeCompare(b.id):b.start.localeCompare(a.start)||a.id.localeCompare(b.id));
 const pages=Math.max(1,Math.ceil(rows.length/20)),page=Math.min(q.page,pages);
 return {rows:rows.slice((page-1)*20,page*20),pages,page,total:rows.length,counts:{business:rows.filter(c=>c.category==='business').length,quality:rows.filter(c=>c.category==='quality').length,insufficient:rows.filter(c=>c.category==='insufficient').length}};
}
