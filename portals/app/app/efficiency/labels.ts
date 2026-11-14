import {n} from '../sites/labels';
import {GIB} from '../domains/map-demo/rules';
import {intensityLevel,type EnergyParameters,type EnergyObservation} from '../domains/efficiency/rules';
export {analysisPeriodCaption as energyPeriodCaption} from '../domains/analysis/period';
export const energyTitle='\u8fd0\u884c\u80fd\u6548';
export const energyValue=(wh:number|null)=>wh===null?'--':n(wh/1000,2);
export const trafficValue=(bytes:number)=>n(bytes/GIB,2);
export const intensityValue=(value:number|null)=>value===null?'--':n(value,3);
export const energyLevelNames={normal:'\u6b63\u5e38',warning:'\u5173\u6ce8',critical:'\u4e25\u91cd',unknown:'\u4e0d\u53ef\u8bc4\u4f30'};
export const energyLevelTones={normal:'success',warning:'warning',critical:'danger',unknown:'neutral'} as const;
export function intensityTone(value:number|null,p:EnergyParameters){const level=intensityLevel(value,p);return level==='warning'||level==='critical'?level:undefined;}
export function intensityClass(value:number|null,p:EnergyParameters){const tone=intensityTone(value,p);return tone?'site-analysis-tone-'+tone:value===null?'text-muted-foreground':'text-foreground';}
export const energyFilterNames:Record<string,string>={normal:'\u6b63\u5e38',all:'\u5168\u90e8',warning:'\u5173\u6ce8',critical:'\u4e25\u91cd',zero:'\u96f6\u6d41\u91cf',unknown:'\u7f3a\u6570'};
export function energyReason(row:EnergyObservation){return [row.level==='warning'?'\u80fd\u8017\u5f3a\u5ea6\u504f\u9ad8':row.level==='critical'?'\u80fd\u8017\u5f3a\u5ea6\u4e25\u91cd':null,row.zeroTraffic?'\u6709\u80fd\u8017\u65e0\u6d41\u91cf':null,row.missing?'\u80fd\u8017\u8bb0\u5f55\u7f3a\u5931':null,row.intensity===null&&!row.zeroTraffic&&!row.missing?'\u65e0\u6709\u6548\u6d41\u91cf':null].filter(Boolean).join('\u3001')||'\u672a\u547d\u4e2d\u89c4\u5219';}
