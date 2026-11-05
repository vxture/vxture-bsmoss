import {writeFileSync} from 'node:fs';
import {queryHistory,parseHistoryQuery} from '../portals/app/app/domains/map-demo/history-service.ts';
import {HISTORY_VERSION} from '../portals/app/app/domains/map-demo/history-calendar.ts';
import {CALENDAR_RULE_VERSION} from '../portals/app/app/domains/map-demo/period-rules.ts';
// Build-only public synthetic province rollup. No database or authorized source.
const analysis=queryHistory(parseHistoryQuery({}));
writeFileSync(new URL('../portals/app/app/analysis/generated-history.json',import.meta.url),
  JSON.stringify({version:HISTORY_VERSION,calendarVersion:CALENDAR_RULE_VERSION,analysis},null,2)+'\n');
console.log('[history] prepared 12-month province analysis with 12-month prior baseline');
