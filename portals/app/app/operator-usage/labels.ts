import {n} from '../sites/labels';
import type {BusinessCounters,UsageMetric} from '../domains/business-usage/rules';
import type {IconName} from '@vxture/design-system';
export const usageTitle='\u4e1a\u52a1\u7528\u91cf';
export const usageNames:Record<UsageMetric,string>={bytes:'\u6d41\u91cf',voiceSeconds:'\u901a\u8bdd\u65f6\u957f',connected:'\u63a5\u901a\u6b21\u6570',sms:'\u77ed\u4fe1'};
export const usageUnits:Record<UsageMetric,string>={bytes:'GiB',voiceSeconds:'\u5c0f\u65f6',connected:'\u6b21',sms:'\u6761'};
export const usageIcons:Record<UsageMetric,IconName>={bytes:'chart-bar',voiceSeconds:'clock',connected:'phone',sms:'chat-circle'};
export const usageShortNames:Record<UsageMetric,string>={bytes:'\u6d41\u91cf',voiceSeconds:'\u901a\u8bdd',connected:'\u63a5\u901a',sms:'\u77ed\u4fe1'};
export function usageNumber(value:number|string,metric:UsageMetric){return Number(value)/(metric==='bytes'?1073741824:metric==='voiceSeconds'?3600:1);}
export function usageValue(value:number|string,metric:UsageMetric){return n(usageNumber(value,metric),metric==='bytes'||metric==='voiceSeconds'?2:0);}
export const usageMetricValue=(row:BusinessCounters,metric:UsageMetric)=>usageValue(row[metric],metric)+' '+usageUnits[metric];
// Display scaling only; original counters remain exact and retain their units.
export function compactUsage(value:number|string,metric:UsageMetric){
 let amount=usageNumber(value,metric),unit=usageUnits[metric];
 if(metric==='bytes'){
  const units=['GiB','TiB','PiB'];let index=0;
  while(index<units.length-1&&Math.round(amount*100)/100>=1024){amount/=1024;index++;}
  unit=units[index];
 }else{
  const rounded=Math.round(amount*100)/100;
  if(Math.round(amount/10000*100)/100>=10000){amount/=100000000;unit='\u4ebf'+unit;}
  else if(rounded>=10000){amount/=10000;unit='\u4e07'+unit;}
 }
 return {value:amount.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}),unit};
}
export const compactUsageValue=(value:number|string,metric:UsageMetric)=>{const result=compactUsage(value,metric);return result.value+' '+result.unit;};
