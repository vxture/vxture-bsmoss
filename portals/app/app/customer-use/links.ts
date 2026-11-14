// Preserve duplicates for canonical validation; never silently discard filters.
export function customerUseDestination(input:Record<string,string|string[]|undefined>){
 const params=new URLSearchParams();
 for(const [key,raw] of Object.entries(input))for(const value of Array.isArray(raw)?raw:raw===undefined?[]:[raw])params.append(key,value);
 if(!params.has('section'))params.set('section','legacy');
 return '/customer-use'+(params.size?'?'+params:'');
}
