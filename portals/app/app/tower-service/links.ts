export function resourceSliceHref(oldHref:string){
 const source=new URL(oldHref,'http://local'),params=new URLSearchParams();
 for(const key of ['city','county','operator','search','operatorCount','pageSize']){const value=source.searchParams.get(key);if(value!==null)params.set(key,value);}
 return '/tower-service/resources?'+params;
}

export function serviceSliceHref(oldHref:string){const source=new URL(oldHref,'http://local'),params=new URLSearchParams();for(const key of ['city','county','operator']){const value=source.searchParams.get(key);if(value!==null)params.set(key,value);}return '/tower-service/services?'+params;}

export function evidenceSliceHref(oldHref:string){return serviceSliceHref(oldHref)+'&view=summary';}

// New business boards share only global context. Local table/map filters never
// leak into another board, and old pages keep their original query semantics.
const businessBoards=['/tower-service/overview','/tower-service/network','/tower-service/resources','/tower-service/services','/tower-service/evidence','/tower-service/judgment'];
const isBusiness=(path:string)=>businessBoards.some(p=>path===p||path.startsWith(p+'/'));
export function towerNavigationHref(target:string,currentPath:string,query:string){
 const destination=new URL(target,'http://local'),p=new URLSearchParams(destination.search),source=new URLSearchParams(query);
 // The full-canvas map has its own observation model, not frozen A/B snapshots.
 if(destination.pathname==='/product-preview'||destination.pathname==='/monitoring'){
  for(const key of destination.pathname==='/monitoring'?['city','county']:['city','county','operator'])if(!p.has(key)){const values=source.getAll(key);if(values.length===1&&values[0])p.set(key,values[0]);}
  return destination.pathname+(p.size?'?'+p:'');
 }
 if(isBusiness(currentPath)&&isBusiness(destination.pathname))for(const key of ['snapshotId','compareSnapshotId','operator']){const values=source.getAll(key);if(values.length===1&&values[0])p.set(key,values[0]);}
 for(const key of ['city','county'])if(isBusiness(destination.pathname)&&!p.has(key)){const values=source.getAll(key);if(values.length===1)p.set(key,values[0]);}
 return destination.pathname+(p.size?'?'+p:'');
}
