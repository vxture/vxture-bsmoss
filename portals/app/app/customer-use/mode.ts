export function readCustomerMode(input:Record<string,string|string[]|undefined>){
 const {section,...rest}=input;
 if(section!==undefined&&(typeof section!=='string'||!['resources','performance','legacy'].includes(section)))throw Error('invalid_customer_section');
 // Existing period/metric links retain their original business meaning.
 const legacy=section==='legacy'||section===undefined&&['usageSort','compare','tenancy','sharing','period','asOf','view'].some(key=>rest[key]!==undefined);
 return {mode:section==='performance'?'performance' as const:legacy?'legacy' as const:'resources' as const,input:rest,explicit:section!==undefined};
}
