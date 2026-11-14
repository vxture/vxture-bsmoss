import { taskFromUrl, taskHref } from "./client";
export type TaskSelection = {kind:"received"|"aggregation";id:string|null};
function validJob(id:unknown):id is string {return typeof id==="string"&&!!id&&id.trim()===id&&id.length<=2048&&id!=="*"&&!id.includes("\0");}
export function selectionFromUrl(url:string):TaskSelection {
 const p=new URL(url).searchParams,task=taskFromUrl(url),job=p.get("job"),view=p.get("view");
 if(p.getAll("view").length>1||view!==null&&view!=="received"&&view!=="aggregation"||p.getAll("job").length>1||p.has("job")&&!validJob(job)||task&&p.has("job")||task&&view==="aggregation"||p.has("job")&&view==="received")throw Error("invalid_task_link");
 return task?{kind:"received",id:task}:{kind:p.has("job")||view==="aggregation"?"aggregation":"received",id:job};
}
export function selectionHref(selection:TaskSelection):string {
 if(selection.kind==="received")return selection.id?taskHref(selection.id):"/operations/data-updates";
 if(selection.id!==null&&!validJob(selection.id))throw Error("invalid_task_link");
 return "/operations/data-updates?view=aggregation"+(selection.id?"&job="+encodeURIComponent(selection.id):"");
}
export function legacyAggregationHref(params:Record<string,string|string[]|undefined>):string {
 const p=new URLSearchParams();const value=params.job;if(Array.isArray(value))value.forEach(v=>p.append("job",v));else if(value!==undefined)p.set("job",value);
 try {return selectionHref(selectionFromUrl("https://local/?view=aggregation&"+p));}catch{return "/operations/data-updates?view=aggregation";}
}
