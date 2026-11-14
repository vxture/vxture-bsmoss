import {test} from "node:test";
import assert from "node:assert/strict";
import {taskQuery,taskHref,taskFromUrl,legacyTasksHref,centreSectionHref} from "./centre-links";
import {reportSelection} from "./navigation";
test("report center links preserve job kind, filter and encoded identity",()=>{
 for(const kind of ["generation","export"] as const)for(const status of ["all","pending","dead","succeeded"] as const)for(const job of [null,"source/one?metric=bytes&x=two"]){const query={kind,status,job};assert.deepEqual(taskFromUrl("https://local"+taskHref(query)),query);assert.equal(legacyTasksHref({kind,status,...(job?{job}:{})}),taskHref(query));}
 assert.deepEqual(taskQuery({}),{kind:"generation",status:"all",job:null});
});
test("ambiguous job identities and mixed browser or server report selection are rejected",()=>{
 for(const query of ["kind=bad","kind=generation&kind=export","status=leased","status=dead&status=all","job=one&job=two","job=","job=*","job=%00","job=%20a","job="+"a".repeat(2049),"job=one&saved="+"a".repeat(64),"job=one&report=server&revision=1"]){assert.throws(()=>taskFromUrl("https://local/reports?view=tasks&"+query));}
 assert.equal(legacyTasksHref({job:["a","b"]}),"/reports?view=tasks&invalid=task");
});
test("center switch carries supported region and operator input without task or saved identities",()=>{
 const scope={city:"610100",county:"610116",operator:"mobile",job:"one",kind:"export",saved:"a".repeat(64),next:"https://evil.invalid"};
 assert.equal(centreSectionHref("tasks",scope),"/reports?view=tasks&city=610100&county=610116&operator=mobile");
 assert.equal(centreSectionHref("library",scope),"/reports?city=610100&county=610116&operator=mobile");
 assert.equal(centreSectionHref("library"),"/reports");
 assert.equal(taskHref({kind:"export",status:"dead",job:"one"},scope),"/reports?view=tasks&kind=export&status=dead&job=one&city=610100&county=610116&operator=mobile");
});
test("platform result links bind an exact revision independently from the browser library",()=>{
 assert.deepEqual(reportSelection({report:"report/one",revision:"2"}),{selection:{id:"report/one",revision:"2"},invalid:false});
 for(const params of [{report:["one","two"],revision:"1"},{report:"one",revision:"0"},{report:"one"}])assert.equal(reportSelection(params).invalid,true);
});
