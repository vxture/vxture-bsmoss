// Observed station tenancy, not contract validity or rentable capacity.
export interface SharingSite {id:string;allOperators:readonly string[]}
export function tenantCodes(codes:readonly string[]) {
 return [...new Set(codes.filter(code=>code!=="tower"&&code.trim()!==""))];
}
export function sharingSummary(records:readonly SharingSite[]) {
 // A repeated inventory row must not create another physical station.
 const sites=new Map<string,Set<string>>();
 for(const record of records) {
  const codes=sites.get(record.id)??new Set<string>();
  for(const code of tenantCodes(record.allOperators))codes.add(code);
  sites.set(record.id,codes);
 }
 const occupied=[...sites.values()].filter(codes=>codes.size>0);
 const occupiedSites=occupied.length;
 const sharedSites=occupied.filter(codes=>codes.size>=2).length;
 const relationships=occupied.reduce((sum,codes)=>sum+codes.size,0);
 return {occupiedSites,sharedSites,relationships,
  sharingRate:occupiedSites?sharedSites/occupiedSites:null,
  averageTenants:occupiedSites?relationships/occupiedSites:null,
  distribution:[
   {key:"single",tenants:1,sites:occupied.filter(codes=>codes.size===1).length},
   {key:"double",tenants:2,sites:occupied.filter(codes=>codes.size===2).length},
   {key:"multi",tenants:3,sites:occupied.filter(codes=>codes.size>=3).length},
  ]};
}
