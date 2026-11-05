import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHistoryQuery} from '../domains/map-demo/history-service';
import {historyHref} from './history-links';
test('history navigation preserves temporal and metric context and removes conflicting windows',()=>{
  const scope=parseHistoryQuery({city:'610100',county:'610113',range:'custom',from:'2025-12-31',to:'2026-01-01',metric:'sms',operator:'mobile'});
  const site=new URL(historyHref(scope,{site:'SX-DEMO-001'}),'http://localhost');
  assert.equal(site.searchParams.get('metric'),'sms');assert.equal(site.searchParams.get('from'),'2025-12-31');
  assert.equal(site.searchParams.get('to'),'2026-01-01');assert.equal(site.searchParams.get('county'),'610113');
  const month=new URL(historyHref(scope,{range:'month',month:'2026-02'}),'http://localhost');
  assert.equal(month.searchParams.get('month'),'2026-02');assert.equal(month.searchParams.has('from'),false);
  const back=new URL(historyHref({...scope,site:'SX-DEMO-001'},{city:'all',county:'all',site:undefined}),'http://localhost');
  assert.equal(back.searchParams.has('site'),false);assert.equal(back.searchParams.get('metric'),'sms');
});
