import type {PeriodComparison} from './period-comparison-rules.ts';
import {COMPARISON_METRICS,signed} from './period-comparison-display.ts';
const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const n=(v:number)=>v.toLocaleString('zh-CN',{maximumFractionDigits:2});
export function renderPeriodContribution(data:PeriodComparison):string {
  const source=data.contribution;if(!source)return '';
  if(source.status!=='matched'||!source.levels)return '<p>\u5f53\u524d\u5206\u9879\u4e0d\u53ef\u6bd4\u6216\u6838\u67e5\u4e0d\u4e00\u81f4\uff0c\u6682\u505c\u8d21\u732e\u62c6\u89e3\u3002</p>';
  const sections=(['city','county','site'] as const).map(level=>{
    const metrics=COMPARISON_METRICS.map(m=>{
      const g=source.levels![level][m.key];
      const ranking=g.ranking.map(r=>`<tr><th>${esc(r.name)}<small>${esc(r.id)} / ${r.sites} \u7ad9</small></th><td>${n(Number(r.current)/m.scale)}</td><td>${n(Number(r.previous)/m.scale)}</td><td>${r.share===null?'\u2014':n(r.share*100)+'%'}</td><td class="evidence">${esc(r.current)} / ${esc(r.previous)}</td></tr>`).join('');
      const movements=([false,true] as const).map(daily=>{
        const v=daily?g.daily:g.total,unit=m.unit+(daily?' / \u65e5':'');
        const rows=[...v.increase,...v.decrease].map(r=>`<tr><th>${esc(r.name)}<small>${esc(r.id)}</small></th><td>${n(Number(r.delta)/v.denominator/m.scale)}</td><td>${r.points===null?'\u2014':signed(r.points)+' \u4e2a\u767e\u5206\u70b9'}</td><td class="evidence">${esc(r.current)} / ${esc(r.previous)} / ${esc(r.delta)}</td></tr>`).join('');
        return `<h5>${daily?'\u65e5\u5747':'\u603b\u91cf'}\u53d8\u5316\u8d21\u732e / ${unit}</h5><p>\u51c0\u53d8\u5316 ${n(Number(v.net)/v.denominator/m.scale)}\uff1b\u589e\u91cf ${n(Number(v.positive)/v.denominator/m.scale)}\uff1b\u51cf\u91cf ${n(Number(v.negative)/v.denominator/m.scale)}\uff1b\u589e\u52a0 ${v.increased} / \u51cf\u5c11 ${v.decreased} / \u6301\u5e73 ${v.unchanged}\u3002</p><div class="scroll"><table><thead><tr><th>\u5206\u9879</th><th>\u53d8\u5316</th><th>\u62c9\u52a8\u6574\u4f53\u73af\u6bd4</th><th>\u539f\u59cb\u672c\u671f / \u57fa\u671f / \u53d8\u5316\u5206\u5b50</th></tr></thead><tbody>${rows}</tbody></table></div><p class="evidence">${esc(v.positive)} + (${esc(v.negative)}) = ${esc(v.net)} / denominator ${v.denominator}\uff1b\u5176\u4f59\u589e\u91cf ${esc(v.increaseRemainder)}\uff1b\u5176\u4f59\u51cf\u91cf ${esc(v.decreaseRemainder)}\u3002</p>`;
      }).join('');
      return `<h4>${m.label} / ${m.unit}</h4><p>\u5f53\u524d\u8303\u56f4 ${g.count} \u4e2a\u5206\u9879\uff0c\u6392\u884c\u53ca\u589e\u51cf\u6765\u6e90\u5404\u5c55\u793a\u6700\u591a ${source.limit} \u4e2a\uff1b\u6392\u884c\u5176\u4f59\u539f\u59cb\u5408\u8ba1 ${esc(g.rankingRemainder)}\u3002</p><div class="scroll"><table><thead><tr><th>\u672c\u671f\u7528\u91cf\u6392\u884c</th><th>\u672c\u671f</th><th>\u57fa\u671f</th><th>\u672c\u671f\u5360\u6bd4</th><th>\u539f\u59cb\u8ba1\u6570</th></tr></thead><tbody>${ranking}</tbody></table></div>${movements}`;
    }).join('');
    return `<details><summary>${level==='city'?'\u5e02\u7ea7':level==='county'?'\u53bf\u7ea7':'\u7ad9\u5740'}\u6392\u884c\u4e0e\u53d8\u5316\u8d21\u732e</summary>${metrics}</details>`;
  }).join('');
  return `<section aria-label="\u6392\u884c\u4e0e\u53d8\u5316\u8d21\u732e"><h3>\u6392\u884c\u4e0e\u53d8\u5316\u8d21\u732e</h3><p>\u62c9\u52a8\u767e\u5206\u70b9\uff1d\u5206\u9879\u53d8\u5316 / \u540c\u8303\u56f4\u57fa\u671f\u603b\u91cf \u00d7 100\uff1b\u65e5\u5747\u6309\u4e24\u671f\u5929\u6570\u5f52\u4e00\u5316\u3002\u6b63\u8d1f\u8d21\u732e\u76f8\u52a0\u7b49\u4e8e\u6574\u4f53\u73af\u6bd4\u3002\u533a\u57df\u53ea\u8986\u76d6\u5f53\u524d\u7b5b\u9009\u8303\u56f4\uff1b\u56fa\u5b9a\u7ad9\u5740\u4e0e\u670d\u52a1\u5173\u7cfb\u7684\u5408\u6210\u6837\u4f8b\u4e0d\u4ee3\u8868\u771f\u5b9e\u6765\u6e90\u5b8c\u6210\u786e\u8ba4\uff0c\u4e0d\u63a8\u65ad\u4e1a\u52a1\u539f\u56e0\u3002</p>${sections}<p class="evidence">${esc(source.version)}</p></section>`;
}
