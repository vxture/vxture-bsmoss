import type {BusinessReport} from './business-snapshot';
import {usageMetrics} from '../domains/business-usage/rules';
import {usageNames,compactUsageValue} from '../operator-usage/labels';
import {analysisSections,reportSummary} from './analysis-content';

import {reportDocumentStyle} from './document-style';
const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderBusinessReport(r:BusinessReport){
 const values=(row:BusinessReport['total'])=>usageMetrics.map(key=>'<td>'+escape(compactUsageValue(row[key],key))+'</td>').join('');
 const headers=usageMetrics.map(key=>'<th>'+escape(usageNames[key])+'</th>').join('');
 const table=(name:string,head:string,rows:string)=>'<section><h2>'+escape(name)+'</h2><div class="scroll"><table><thead><tr>'+head+headers+'</tr></thead><tbody>'+rows+'</tbody></table></div></section>';
 return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(r.scopeLabel+' \u7efc\u5408\u8fd0\u8425\u62a5\u544a')+'</title><style>'+reportDocumentStyle+'</style></head><body><main><header><h1>'+escape(r.scopeLabel)+' \u00b7 \u7efc\u5408\u8fd0\u8425\u62a5\u544a</h1><p>'+escape(r.coverage.label)+' \u00b7 '+escape(r.operatorNames[r.scope.operator])+'</p><p>\u6f14\u793a\u6570\u636e \u00b7 \u5df2\u8986\u76d6 '+r.sites+' \u7ad9 \u00b7 \u6709\u6548 '+r.coverage.observed+'/'+r.coverage.expected+(r.coverage.daily?' \u5929':' \u5c0f\u65f6')+'</p></header>'
 +(r.analysis?'<section><h2>\u62a5\u544a\u6458\u8981</h2><p>'+escape(reportSummary(r))+'</p></section>':'')
 +table('\u7528\u91cf\u6982\u51b5','<th>\u8303\u56f4</th>','<tr><th>\u5408\u8ba1</th>'+values(r.total)+'</tr>')
 +table('\u8fd0\u8425\u5546\u7528\u91cf','<th>\u8fd0\u8425\u5546</th>',r.operators.map(row=>'<tr><th>'+escape(r.operatorNames[row.code]??row.code)+'</th>'+values(row)+'</tr>').join(''))
 +table('\u533a\u57df\u7528\u91cf','<th>\u533a\u57df</th>',r.regions.map(row=>'<tr><th>'+escape(row.name)+'</th>'+values(row)+'</tr>').join(''))
 +table('\u5468\u671f\u53d8\u5316','<th>\u65f6\u95f4</th>',r.series.map(row=>'<tr><th>'+escape(row.key)+'</th>'+values(row)+'</tr>').join(''))
 +analysisSections(r).map(s=>'<section><h2>'+escape(s.title)+'</h2><p>'+escape(s.description)+'</p><div class="scroll"><table><thead><tr>'+s.headers.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+s.rows.map(row=>'<tr>'+row.map(value=>'<td>'+escape(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>').join('')
 +table('\u7ad9\u5740\u660e\u7ec6','<th>\u7ad9\u5740</th><th>\u7f16\u53f7</th><th>\u533a\u57df</th>',r.stations.map(row=>'<tr><th>'+escape(row.name)+'</th><td>'+escape(row.id)+'</td><td>'+escape(row.cityName+' / '+row.countyName)+'</td>'+values(row)+'</tr>').join(''))
 +'<footer><p>\u62a5\u544a\u7f16\u53f7 '+escape(r.id)+'</p><p>\u6570\u636e\u533a\u95f4 '+escape(r.window.start)+' \u2014 '+escape(r.window.end)+'\uff08\u7ed3\u675f\u8fb9\u754c\u4e0d\u542b\uff09</p><p>\u6765\u6e90\u7248\u672c '+escape(r.sourceVersion)+' \u00b7 \u6a21\u677f\u7248\u672c '+escape(r.templateVersion)+'</p></footer></main></body></html>';
}
