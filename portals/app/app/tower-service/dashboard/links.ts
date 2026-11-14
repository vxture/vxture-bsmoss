import {snapshotQuery,type SnapshotContext} from '../../domains/tower-service/query';
export function dashboardHref(path:string,context:SnapshotContext,patch:Record<string,string|number>={}){
 const p=new URLSearchParams(snapshotQuery(context));for(const [k,v] of Object.entries(patch))if(String(v)!=='')p.set(k,String(v));else p.delete(k);return path+'?'+p;
}
