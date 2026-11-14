export function physicalEnergy(value:string|null,compact=false){
 if(value===null)return {value:'--',unit:'kWh',text:'\u5f85\u63a5\u5165'};
 const wh=BigInt(value),scale=compact&&wh>=1000000n?1000000n:1000n,unit=scale===1000000n?'MWh':'kWh',rounded=(wh*100n+scale/2n)/scale;
 const formatted=(rounded/100n).toLocaleString('en-US')+'.'+String(rounded%100n).padStart(2,'0');
 return {value:formatted,unit,text:formatted+' '+unit};
}
export const supplyNames:Record<string,string>={all:'\u5168\u90e8',battery:'\u84c4\u7535\u6c60',missing:'\u7535\u91cf\u7f3a\u5931'};
