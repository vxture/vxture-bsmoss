import type {ReportJobKind,ReportJobState} from "../domains/supervision/report-jobs";
export interface TaskQuery {kind:ReportJobKind;status:ReportJobState;job:string|null}
type Params=Record<string,string|string[]|undefined>;
export function taskQuery(params:Params):TaskQuery {
 const kind=params.kind??"generation",status=params.status??"all",job=params.job??null;
 if(typeof kind!=="string"||!["generation","export"].includes(kind)||typeof status!=="string"||!["all","pending","dead","succeeded"].includes(status)||job!==null&&(typeof job!=="string"||!job||job.trim()!==job||job.length>2048||job==="*"||job.includes("\0"))||["report","revision","saved"].some(key=>params[key]!==undefined))throw Error("invalid_report_task_link");
 return {kind:kind as ReportJobKind,status:status as ReportJobState,job:job as string|null};
}
export function taskHref(query:TaskQuery,scope:Params={}){const q=taskQuery({kind:query.kind,status:query.status,...(query.job!==null?{job:query.job}:{})}),p=new URLSearchParams({view:"tasks",kind:q.kind,status:q.status});if(q.job)p.set("job",q.job);for(const key of ["city","county","operator"]){const value=scope[key];if(typeof value==="string")p.set(key,value);}return "/reports?"+p;}
export function taskFromUrl(url:string){const p=new URL(url).searchParams,params:Params={};for(const key of ["kind","status","job","report","revision","saved"]){const values=p.getAll(key);if(values.length)params[key]=values.length===1?values[0]:values;}return taskQuery(params);}
export function legacyTasksHref(params:Params){try{return taskHref(taskQuery(params));}catch{return "/reports?view=tasks&invalid=task";}}
export function centreSectionHref(section:"library"|"tasks",scope:Params={}) {
 const p=new URLSearchParams();if(section==="tasks")p.set("view","tasks");
 for(const key of ["city","county","operator"]){const value=scope[key];if(typeof value==="string")p.set(key,value);}
 return "/reports"+(p.size?"?"+p:"");
}

export function towerReportCentreHref(scope:Params={}) {
 const p=new URLSearchParams({view:"tower"});
 for(const key of ["snapshotId","compareSnapshotId","city","county","operator","report"]){
  const value=scope[key];if(typeof value==="string"&&value)p.set(key,value);
 }
 return "/reports?"+p;
}
