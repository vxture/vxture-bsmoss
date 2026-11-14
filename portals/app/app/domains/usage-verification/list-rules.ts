import type {ReviewCase} from './demo';
import type {ReviewQuery} from './query';
import type {CaseLog} from './events';
import {recordProjection} from './event-service';
import {scopedReviewCases} from './scope';
export function reviewRows(cases:readonly ReviewCase[],q:ReviewQuery,logs:readonly CaseLog[],recordsOnly=false,reason='all'){
 const byId=new Map(logs.map(l=>[l.caseId,l])),current=new Set(cases.map(c=>c.id));
 // Retain actual historical actions even when a newer policy no longer finds the case.
 const history=recordsOnly?logs.filter(l=>!current.has(l.caseId)).map(l=>l.events.at(-1)!.evidence):[];
 const candidates=scopedReviewCases([...cases,...history],q).map(c=>({...c,retired:!current.has(c.id),review:recordProjection(byId.get(c.id),c)}));
 const matching=candidates.filter(c=>(!recordsOnly||c.review.revision>0)&&(q.metric==='all'||c.metric===q.metric)&&(q.category==='all'||c.category===q.category)&&(!q.kind||q.kind==='all'||c.kind===q.kind)&&(reason==='all'||c.review.reason===reason));
 const states={all:matching.length,open:matching.filter(c=>c.review.state==='open').length,awaiting_review:matching.filter(c=>c.review.state==='awaiting_review').length,closed:matching.filter(c=>c.review.state==='closed').length};
 const rows=matching.filter(c=>q.status==='all'||c.review.state===q.status).sort((a,b)=>recordsOnly?(b.review.last?.recordedAt??'').localeCompare(a.review.last?.recordedAt??'')||a.id.localeCompare(b.id):b.start.localeCompare(a.start)||a.id.localeCompare(b.id));
 const size=q.pageSize??20,pages=Math.max(1,Math.ceil(rows.length/size)),page=Math.min(q.page,pages);
 return {rows:rows.slice((page-1)*size,page*size),states,pages,page,total:rows.length,counts:{business:rows.filter(c=>c.category==='business').length,quality:rows.filter(c=>c.category==='quality').length,insufficient:rows.filter(c=>c.category==='insufficient').length}};
}
