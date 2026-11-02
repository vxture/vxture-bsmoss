import {test} from 'node:test';
import assert from 'node:assert/strict';
import {useWorkbench} from './workbench-store.ts';
import {mapInsets} from '../../product-preview/workbench/map-layout.ts';

test('report drill-down keeps period and exact scope, independent panels and safe return context',()=>{
 const state=()=>useWorkbench.getState(),selection=[108.8,34.1,109.1,34.5] as const;
 state().set({cityId:'610100',countyId:'610113',operator:'other',selection:[...selection],reportOpen:true,reportPeriod:'month'});
 state().set({selectedId:'SX-DEMO-006',detailOpen:true,tab:'business',runtimeOpen:false,businessOpen:true,stationPeriods:{runtime:'month',business:'month'},returnToReport:true});
 assert.ok(state().businessOpen&&!state().reportOpen&&state().returnToReport);assert.equal(state().stationPeriods.business,'month');assert.deepEqual(state().selection,selection);
 state().set({stationPeriods:{...state().stationPeriods,runtime:'week'},hour:7});assert.equal(state().stationPeriods.business,'month');assert.equal(state().stationPeriods.runtime,'week');assert.ok(state().returnToReport);
 state().set({reportOpen:true,selectedId:null,returnToReport:false});assert.ok(state().reportOpen&&!state().detailOpen);assert.equal(state().reportPeriod,'month');assert.equal(state().operator,'other');assert.deepEqual(state().selection,selection);
 state().set({selectedId:'SX-DEMO-001',detailOpen:true});assert.equal(state().stationPeriods.business,'snapshot');assert.equal(state().returnToReport,false);
 state().set({returnToReport:true});state().set({operator:'mobile'});assert.equal(state().returnToReport,false);
});
test('daily report panel pauses playback, retains selection, and yields to other analysis tools',()=>{
 const state=()=>useWorkbench.getState();state().set({cityId:'610100',countyId:'610113',selection:[108.8,34.1,109.1,34.5],compareIds:['a','b'],playing:true,usageOpen:true});
 state().set({reportOpen:true});assert.ok(state().reportOpen&&!state().usageOpen&&!state().topicOpen&&!state().detailOpen&&!state().playing);assert.ok(state().selection);assert.deepEqual(state().compareIds,['a','b']);
 state().set({hour:12});assert.ok(state().reportOpen);
 state().set({usageOpen:true});assert.ok(!state().reportOpen&&state().usageOpen);
 state().set({reportOpen:true});state().set({selectedId:'SX-DEMO-001'});state().openPanel('business');assert.ok(!state().reportOpen&&state().businessOpen);
 state().set({reportOpen:true});state().set({cityId:'610300',selectedId:null});assert.ok(state().reportOpen);assert.equal(state().selection,null);
 state().beginSelection();assert.ok(!state().reportOpen&&state().drawing);state().cancelSelection();
});
test('usage replaces analysis windows, retains scope, and yields to station, topic and selection tools',()=>{
  const state=()=>useWorkbench.getState();
  state().set({cityId:'610100',countyId:'610113',selection:[108.8,34.1,109.1,34.5],hour:12,operator:'mobile',compareIds:['a','b'],topicOpen:true});
  state().set({usageOpen:true,usagePeriod:'day'});
  assert.ok(state().usageOpen&&!state().topicOpen&&!state().compareOpen&&!state().detailOpen&&!state().selectionOpen);
  assert.equal(state().hour,12);assert.equal(state().operator,'mobile');assert.equal(state().usagePeriod,'day');
  assert.deepEqual(state().compareIds,['a','b']);assert.ok(state().selection);
  state().set({usageOpen:false});state().set({usageOpen:true});assert.equal(state().usagePeriod,'day');
  state().set({selectedId:'SX-DEMO-001'});state().openPanel('runtime');assert.ok(!state().usageOpen&&state().runtimeOpen);
  state().set({usageOpen:true});state().set({topicOpen:true});assert.ok(!state().usageOpen&&state().topicOpen);
  state().set({usageOpen:true});state().beginSelection();assert.ok(!state().usageOpen&&state().drawing);state().cancelSelection();
  state().set({usageOpen:true});state().set({cityId:'610300',selectedId:null});assert.ok(state().usageOpen);assert.equal(state().selection,null);
});
test('independent panels retain shared context when opening, closing, switching and expanding',()=>{
  const state=()=>useWorkbench.getState();
  state().set({selectedId:'SX-DEMO-004',hour:12,detailOpen:false});
  state().openPanel('runtime');state().openPanel('business');
  assert.ok(state().runtimeOpen&&state().businessOpen&&state().detailOpen);
  state().expandPanel('runtime');assert.equal(state().expandedPanel,'runtime');
  state().closePanel('runtime');assert.ok(!state().runtimeOpen&&state().businessOpen);assert.equal(state().expandedPanel,null);
  assert.equal(state().selectedId,'SX-DEMO-004');assert.equal(state().hour,12);
  state().openPanel('runtime',true);assert.ok(state().runtimeOpen&&!state().businessOpen);
  state().closePanel('runtime');assert.equal(state().detailOpen,false);assert.equal(state().selectedId,'SX-DEMO-004');
  state().openPanel('business');state().set({selectedId:null});assert.ok(!state().businessOpen&&!state().detailOpen);
});
test('changing city clears stale county and selection reset closes both windows',()=>{
  const state=()=>useWorkbench.getState();
  state().set({cityId:'610100',countyId:'610113',selectedId:'SX-DEMO-001'});state().openPanel('runtime');
  state().set({cityId:'610300',selectedId:null});assert.equal(state().countyId,'all');assert.equal(state().detailOpen,false);
});
test('camera padding preserves usable map width for widened independent windows',()=>{
  for(const width of [390,760,1000,1200,1440,1920])for(const dual of [false,true])for(const expanded of [false,true]){
    const p=mapInsets(width,true,true,expanded,dual);assert.ok(p.left>=0&&p.right>=0);assert.ok(width-p.left-p.right>=Math.min(280,width-80));
  }
});

test('selection lifecycle preserves geometry on cancel and site drill-down, but clears stale regional geometry',()=>{
  const state=()=>useWorkbench.getState();
  state().set({cityId:'610100',countyId:'all',selectedId:'SX-DEMO-001'});state().openPanel('runtime');
  state().beginSelection();assert.ok(state().drawing&&!state().detailOpen&&!state().selectionOpen);
  state().finishSelection([108.8,34.1,109.1,34.5]);assert.ok(state().selectionOpen&&!state().drawing);assert.equal(state().selectedId,null);
  state().beginSelection();state().cancelSelection();assert.deepEqual(state().selection,[108.8,34.1,109.1,34.5]);assert.ok(state().selectionOpen);
  state().set({selectedId:'SX-DEMO-001',detailOpen:true});assert.equal(state().selectionOpen,false);assert.ok(state().selection);
  state().set({hour:12,operator:'mobile'});assert.ok(state().selection);
  state().set({cityId:'610300',selectedId:null});assert.equal(state().selection,null);assert.equal(state().selectionOpen,false);
  state().finishSelection([107,34,108,35]);state().clearSelection();assert.equal(state().selection,null);assert.equal(state().selectionOpen,false);
  assert.throws(()=>state().finishSelection([109,35,108,34]));
});

test('comparison pins are unique, capped, removable and retained when switching panels or hour',()=>{
  const state=()=>useWorkbench.getState();state().clearComparison();state().set({cityId:'all',countyId:'all',selection:null});
  for(const id of ['a','b','c','d','e','a','invalid/'])state().addComparison(id);
  assert.deepEqual(state().compareIds,['a','b','c','d']);assert.ok(state().compareOpen&&!state().detailOpen&&!state().selectionOpen);
  state().removeComparison('b');state().addComparison('e');assert.deepEqual(state().compareIds,['a','c','d','e']);
  state().set({hour:12,operator:'mobile'});assert.equal(state().compareIds.length,4);
  state().set({selectedId:'a',detailOpen:true});assert.ok(!state().compareOpen&&state().detailOpen);assert.equal(state().compareIds.length,4);
  state().set({compareOpen:true});assert.ok(!state().detailOpen&&state().compareOpen);
  state().clearComparison();assert.equal(state().compareIds.length,0);assert.ok(state().compareOpen);
});
test('regional and spatial scope changes clear comparison pins, URL restoration keeps explicit valid pins',()=>{
  const state=()=>useWorkbench.getState();state().set({cityId:'all',countyId:'all',selection:null});state().addComparison('a');
  state().set({cityId:'610100'});assert.deepEqual(state().compareIds,[]);
  state().addComparison('a');state().set({countyId:'610113'});assert.deepEqual(state().compareIds,[]);
  state().addComparison('a');state().finishSelection([108.8,34.1,109.1,34.5]);assert.deepEqual(state().compareIds,[]);assert.ok(!state().compareOpen);
  state().set({cityId:'610300',countyId:'all',compareIds:['b','c'],compareOpen:true});assert.deepEqual(state().compareIds,['b','c']);assert.ok(state().compareOpen&&!state().selectionOpen);
  for(const width of [390,760,1000,1440]){const padding=mapInsets(width,false,false,false,false,false,true);assert.ok(width-padding.left-padding.right>=Math.min(280,width-80));}
});

test('topics replace other analysis windows while retaining selection, comparison pins, hour and operator',()=>{
  const state=()=>useWorkbench.getState();
  state().set({cityId:'610100',countyId:'610113',selection:[108.8,34.1,109.1,34.5],selectedId:'SX-DEMO-001',hour:12,operator:'mobile',compareIds:['a','b']});
  state().openPanel('runtime');state().openPanel('business');state().expandPanel('runtime');
  state().set({topicOpen:true,topic:'power',search:'stale'});
  assert.ok(state().topicOpen&&!state().detailOpen&&!state().compareOpen&&!state().selectionOpen&&!state().leftOpen);
  assert.equal(state().expandedPanel,null);assert.equal(state().search,'');assert.equal(state().hour,12);assert.equal(state().operator,'mobile');
  assert.deepEqual(state().selection,[108.8,34.1,109.1,34.5]);assert.deepEqual(state().compareIds,['a','b']);
  state().set({topicOpen:false});state().set({topicOpen:true});assert.equal(state().topic,'power');
  state().openPanel('business');assert.ok(!state().topicOpen&&state().businessOpen);
  state().set({topicOpen:true});state().addComparison('c');assert.ok(!state().topicOpen&&state().compareOpen);assert.deepEqual(state().compareIds,['a','b','c']);
  state().set({topicOpen:true});state().set({cityId:'610300',selectedId:null});
  assert.ok(state().topicOpen);assert.equal(state().selection,null);assert.equal(state().countyId,'all');assert.deepEqual(state().compareIds,[]);
  state().beginSelection();assert.ok(!state().topicOpen&&state().drawing);state().cancelSelection();
  for(const width of [390,760,1000,1440]){const p=mapInsets(width,false,false,false,false,false,false,true);assert.ok(width-p.left-p.right>=Math.min(280,width-80));}
});
