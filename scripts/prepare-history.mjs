import {writeFileSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {queryHistory,parseHistoryQuery} from '../portals/app/app/domains/map-demo/history-service.ts';
import {HISTORY_VERSION} from '../portals/app/app/domains/map-demo/history-calendar.ts';
import {CALENDAR_RULE_VERSION} from '../portals/app/app/domains/map-demo/period-rules.ts';
import {queryHistoryContext} from '../portals/app/app/domains/map-demo/history-context-service.ts';
// Build-only public synthetic province rollup. No database or authorized source.
const analysis=queryHistory(parseHistoryQuery({}));
// Bundle the published runtime tokens for an offline report. No copied token
// values, dependency internals, network fonts or runtime filesystem reads.
const appRequire=createRequire(new URL('../portals/app/package.json',import.meta.url));
const dsRequire=createRequire(appRequire.resolve('@vxture/design-system'));
const visited=new Set();
function tokenCss(path){
 if(visited.has(path))return '';visited.add(path);
 return readFileSync(path,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/@import\s+"([^"]+)";/g,(_,relative)=>tokenCss(resolve(dirname(path),relative)))
  .replace(/@theme[^{}]*\{[^{}]*\}/g,'').replace(/\s+/g,' ').trim();
}
const css=tokenCss(dsRequire.resolve('@vxture/design-tokens/styles/tokens.css'));
writeFileSync(new URL('../portals/app/app/analysis/generated-report-tokens.json',import.meta.url),JSON.stringify({digest:createHash('sha256').update(css).digest('hex'),css})+'\n');
writeFileSync(new URL('../portals/app/app/analysis/generated-history.json',import.meta.url),
  JSON.stringify({version:HISTORY_VERSION,calendarVersion:CALENDAR_RULE_VERSION,analysis,context:queryHistoryContext(analysis)},null,2).replace(/[^\x00-\x7f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))+'\n');
console.log('[history] prepared 12-month province analysis with 12-month prior baseline');
