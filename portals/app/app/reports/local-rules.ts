export const LIBRARY_DATASET='bsmoss-synthetic-report-library-v1';
export const FILE_LIMIT=24*1024*1024;
export interface ReportFiles {
 dataset:typeof LIBRARY_DATASET;familyKey:string;kind:'history'|'calendar';reportId:string;period:string;start:string;end:string;
 city:string;county:string;operator:string;site:string|null;scopeLabel:string;sourceVersion:string;templateVersion:string;
 analysisHref:string;reportHref:string;totals:{bytes:string;voiceSeconds:string;sms:string};json:string;html:string;
}
export interface ReportArtifact {schema:1;digest:string;content:string}
export interface SavedReport extends ReportArtifact {savedAt:string}
export const sha256=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');
export function localReportQuery(input:Record<string,string|string[]|undefined>){
 const allowed=['city','county','operator','period','search','saved'];
 for(const [k,v] of Object.entries(input))if(!allowed.includes(k)||typeof v!=='string')throw Error('invalid_library_query');
 const raw=input as Record<string,string|undefined>;
 const city=raw.city??'all',county=raw.county??'all',operator=raw.operator??'all',period=raw.period??'all',search=raw.search??'',saved=raw.saved;
 if(!['all','day','week','month','history'].includes(period)||search.length>100||saved!==undefined&&!/^[a-f0-9]{64}$/.test(saved))throw Error('invalid_library_query');
 return {city,county,operator,period,search,...(saved?{saved}:{})} as {city:string;county:string;operator:string;period:string;search:string;saved?:string};
}
export type LibraryQuery=ReturnType<typeof localReportQuery>;
export function libraryHref(q:LibraryQuery,patch:Partial<LibraryQuery>={}){const p=new URLSearchParams();for(const [k,v] of Object.entries({...q,...patch}))if(v!==undefined)p.set(k,v);return '/reports?'+p;}
export function fileMetadata(content:string):ReportFiles {
 if(typeof content!=='string'||content.length>FILE_LIMIT)throw Error('invalid_report_file');
 const f=JSON.parse(content) as ReportFiles;
 const keys=['dataset','familyKey','kind','reportId','period','start','end','city','county','operator','site','scopeLabel','sourceVersion','templateVersion','analysisHref','reportHref','totals','json','html'];
 if(!f||Object.keys(f).sort().join()!==keys.sort().join()||f.dataset!==LIBRARY_DATASET||!['history','calendar'].includes(f.kind))throw Error('invalid_report_file');
 for(const key of keys.filter(k=>!['site','totals'].includes(k)))if(typeof f[key as keyof ReportFiles]!=='string')throw Error('invalid_report_file');
 if(!/^[a-f0-9]{64}$/.test(f.familyKey))throw Error('invalid_report_file');
 if(f.site!==null&&(typeof f.site!=='string'||!/^[A-Za-z0-9-]{1,40}$/.test(f.site))||f.reportId.length>100||f.scopeLabel.length>500||!/^\d{4}-\d{2}-\d{2}/.test(f.start)||!/^\d{4}-\d{2}-\d{2}/.test(f.end))throw Error('invalid_report_file');
 for(const href of [f.analysisHref,f.reportHref])if(!/^\/(analysis(?:\/report)?|usage-reports|operator-usage)\?[^#\\\u0000-\u001f]*$/.test(href)||href.length>6000)throw Error('invalid_report_link');
 if(!f.totals||Object.keys(f.totals).sort().join()!=='bytes,sms,voiceSeconds'||Object.values(f.totals).some(v=>typeof v!=='string'||!/^\d+$/.test(v)))throw Error('invalid_report_file');
 const json=JSON.parse(f.json);if(!json||json.id!==f.reportId||!f.html.startsWith('<!doctype html>'))throw Error('invalid_report_file');
 return f;
}
export async function checkArtifact(value:unknown):Promise<{artifact:ReportArtifact;files:ReportFiles}>{
 const a=value as ReportArtifact;
 if(!a||a.schema!==1||typeof a.digest!=='string'||!/^[a-f0-9]{64}$/.test(a.digest)||typeof a.content!=='string'||a.content.length>FILE_LIMIT||Object.keys(a).sort().join()!=='content,digest,schema')throw Error('invalid_report_artifact');
 if(await sha256(a.content)!==a.digest)throw Error('report_file_changed');
 return {artifact:a,files:fileMetadata(a.content)};
}
export function filterLibrary(rows:{saved:SavedReport;files:ReportFiles}[],q:LibraryQuery){
 const words=q.search.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return rows.filter(({files:f})=>(q.city==='all'||q.city===f.city)&&(q.county==='all'||q.county===f.county)&&(q.operator==='all'||q.operator===f.operator)
  &&(q.period==='all'||(q.period==='history'?f.kind==='history':f.kind==='calendar'&&f.period===q.period))
  &&words.every(w=>(f.scopeLabel+' '+f.reportId+' '+f.start+' '+f.end).toLowerCase().includes(w))).sort((a,b)=>b.saved.savedAt.localeCompare(a.saved.savedAt)||a.saved.digest.localeCompare(b.saved.digest));
}
