import type {CounterChange,PeriodComparison} from './period-comparison-rules.ts';
export const COMPARISON_REASONS:Record<PeriodComparison['reason'],string>={matched:'\u540c\u8303\u56f4\u5b8c\u6574\u6837\u4f8b',empty_scope:'\u65e0\u5339\u914d\u7ad9\u5740',scope_mismatch:'\u7edf\u8ba1\u8303\u56f4\u4e0d\u4e00\u81f4',cohort_mismatch:'\u7ad9\u5740\u6216\u670d\u52a1\u5173\u7cfb\u4e0d\u4e00\u81f4',incomplete_samples:'\u6837\u672c\u4e0d\u5b8c\u6574',rule_mismatch:'\u89c4\u5219\u7248\u672c\u4e0d\u4e00\u81f4',window_mismatch:'\u5468\u671f\u7a97\u53e3\u4e0d\u4e00\u81f4'};
export const COMPARISON_METRICS=[{key:'bytes',label:'\u6d41\u91cf',unit:'GiB',scale:1073741824},{key:'voiceSeconds',label:'\u901a\u8bdd',unit:'\u5c0f\u65f6',scale:3600},{key:'sms',label:'\u77ed\u4fe1',unit:'\u6761',scale:1}] as const;
export function changeLabel(change:CounterChange,daily=false):string {
  if(change.status==='from_zero')return '\u4ece\u96f6\u65b0\u589e';
  if(change.status==='both_zero')return '\u53cc\u671f\u5747\u96f6';
  const rate=daily?change.dailyRate:change.rate;
  return rate===null?'\u4e0d\u53ef\u6bd4':signed(rate*100)+'%';
}
export function signed(value:number):string {
  const rounded=Number(value.toFixed(2))||0;
  return (rounded>0?'+':'')+rounded.toLocaleString('zh-CN',{maximumFractionDigits:2});
}
export function windowLabel(window:{start:string;end:string}):string {
  const end=new Date(Date.parse(window.end)-86400000+8*3600000).toISOString().slice(0,10);
  return window.start.slice(0,10)===end?end:window.start.slice(0,10)+' \u2014 '+end;
}
