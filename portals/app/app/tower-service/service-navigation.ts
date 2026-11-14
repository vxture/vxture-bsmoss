import type {QueryInput} from '../domains/tower-service/query';

export const SERVICE_PATH='/tower-service/services';
export const serviceViews=[
 {value:'operators',label:'\u6309\u8fd0\u8425\u5546'},
 {value:'periods',label:'\u5468\u671f\u53d8\u5316'},
 {value:'comparison',label:'\u53d8\u5316\u5bf9\u6bd4'},
 {value:'summary',label:'\u4f9d\u636e\u6c47\u603b'},
 {value:'details',label:'\u8ba1\u91cf\u660e\u7ec6'},
] as const;
export const isEvidenceView=(view:unknown)=>view==='summary'||view==='details';
const globals=['snapshotId','compareSnapshotId','operator','city','county'];
const analysisKeys=[...globals,'view','metric','category','ownership','search','page','pageSize','comparisonMode'];

// A return address is presentation context, never an authorization input.
export function serviceReturnHref(value:unknown):string|null{
 if(typeof value!=='string'||value.length>2048||!value.startsWith(SERVICE_PATH+'?'))return null;
 const url=new URL(value,'http://local');
 if(url.pathname!==SERVICE_PATH||url.hash)return null;
 for(const [key,item] of url.searchParams)if(!analysisKeys.includes(key)||url.searchParams.getAll(key).length!==1||item.length>160)return null;
 if(!['operators','periods','comparison'].includes(url.searchParams.get('view')??'operators'))return null;
 return SERVICE_PATH+'?'+url.searchParams;
}

export function serviceViewHref(values:Record<string,string|number>,view:string,currentHref:string,returnTo?:string|null){
 const current=String(values.view),sameKind=isEvidenceView(current)===isEvidenceView(view);
 const previous=serviceReturnHref(returnTo);
 if(isEvidenceView(current)&&!isEvidenceView(view)&&previous){
  const p=new URL(previous,'http://local');
  if((p.searchParams.get('view')??'operators')===view)return previous;
 }
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(values))if(sameKind||globals.includes(key))params.set(key,String(value));
 params.set('view',view);params.set('page','1');params.set('search','');
 if(!sameKind&&isEvidenceView(view)){params.set('dimension','all');params.set('service','all');}
 if(['periods','comparison'].includes(view)&&!['periods','comparison'].includes(current)){params.set('comparisonMode','previous');params.delete('compareSnapshotId');}
 const back=isEvidenceView(view)?previous??(!isEvidenceView(current)?serviceReturnHref(currentHref):null):null;
 if(back)params.set('returnTo',back);
 return SERVICE_PATH+'?'+params;
}

// Preserve every legacy query (including duplicates for the normal validator).
export function legacyEvidenceHref(input:QueryInput){
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(input))if(value!==undefined)for(const item of Array.isArray(value)?value:[value])params.append(key,item);
 if(!params.has('view'))params.set('view','summary');
 return SERVICE_PATH+'?'+params;
}
