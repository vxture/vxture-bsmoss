'use client';
import dynamic from 'next/dynamic';
import RegionSelector from '../../portal/region-selector';
import { rememberBrowserRegion } from '../../portal/header-region';
import type { RegionPreference } from '../../portal/region-scope';
import { useCallback, useEffect, useState } from 'react';
import { RadioTower, Globe2, Activity, BarChart3, Zap, Search, ChevronDown, SlidersHorizontal, Layers, ArrowUpRight, Play, Pause, ChevronLeft, ChevronRight, MapPin, RotateCcw, Check, CircleHelp, X, LoaderCircle, Database, ScanLine, BoxSelect, Columns3, Radar, Table2, FileText } from 'lucide-react';
import { useWorkbench } from '../../domains/map-demo/workbench-store.ts';
import { parseSelection, serializeSelection, selectionLabel, mapContextKey } from '../../domains/map-demo/geometry.ts';
import AreaPanel from './area-panel.tsx';
import OperatorPanel from './operator-panel.tsx';
import ReportPanel from './report-panel.tsx';
import ComparisonPanel from './comparison-panel.tsx';
import TopicPanel, {TOPIC_NAMES} from './topic-panel.tsx';
import {parseTopic} from '../../domains/map-demo/topic-rules.ts';
import { parseComparisonIds } from '../../domains/map-demo/comparison-rules.ts';
import { DEMO_DATE, GIB } from '../../domains/map-demo/rules.ts';
import type { RegionDefinition, MapSnapshot, StationDetail, OperatorFilter } from '../../domains/map-demo/types.ts';
import StationPanel, { OP_NAMES } from './station-panel.tsx';
import './workbench.css';
import './hud.css';
import ActivityTicker from './activity-ticker.tsx';
import {SummaryStrip,SummarySettings} from './display-controls.tsx';
import {DISPLAY_KEY,resolveDisplay,displayedTopicPoints} from '../../domains/map-demo/display-rules.ts';
const MapCanvas=dynamic(()=>import('./map-canvas.tsx'),{ssr:false,loading:()=> <div className="mw-map-loading"><span/>{'\u5730\u56fe\u5f15\u64ce\u52a0\u8f7d\u4e2d'}</div>});
const SCENES=[{id:'SX-DEMO-001',city:'610100',label:'\u5546\u5708\u5fd9\u65f6',icon:Activity},{id:'SX-DEMO-002',city:'610100',label:'\u4ea4\u901a\u6f6e\u6c50',icon:ScanLine},{id:'SX-DEMO-003',city:'610300',label:'\u56ed\u533a\u4e1a\u52a1',icon:BarChart3},{id:'SX-DEMO-004',city:'610100',label:'\u4f9b\u7535\u4fdd\u969c',icon:Zap},{id:'SX-DEMO-005',city:'610400',label:'\u80fd\u6548\u89c2\u5bdf',icon:Layers},{id:'SX-DEMO-006',city:'610100',label:'\u591a\u65b9\u5171\u4eab',icon:RadioTower}];
const n=(value:number,digits=1)=>value.toLocaleString('zh-CN',{maximumFractionDigits:digits});
function queryString(state:ReturnType<typeof useWorkbench.getState>,region:RegionDefinition,viewport=false) {
  const p=new URLSearchParams({regionId:region.id,cityId:state.cityId,countyId:state.countyId,operator:state.operator,hour:String(state.hour)});
  if(state.selection)p.set('selection',serializeSelection(state.selection));
  if(viewport&&state.bounds)p.set('bbox',state.bounds.map(v=>v.toFixed(5)).join(','));
  if(viewport&&state.search)p.set('search',state.search);
  if(viewport&&state.topicOpen)p.set('topic',state.topic);
  return p.toString();
}
export default function Workbench({region,initialSnapshot,scenes,regionPreference}:{scenes:{id:string;countyId:string}[];region:RegionDefinition;initialSnapshot:MapSnapshot;regionPreference:RegionPreference}) {
  const state=useWorkbench();
  const [snapshot,setSnapshot]=useState(initialSnapshot),[detail,setDetail]=useState<StationDetail|null>(null);
  const [mapLoading,setMapLoading]=useState(false),[detailLoading,setDetailLoading]=useState(false),[error,setError]=useState<string|null>(null),[mapError,setMapError]=useState(false);
  const [mapRevision,setMapRevision]=useState(0),[detailRevision,setDetailRevision]=useState(0);
  const [timelineExpanded,setTimelineExpanded]=useState(false);
  const [settings,setSettings]=useState(false),[help,setHelp]=useState(false),[hydrated,setHydrated]=useState(false);
  useEffect(()=>{
    const p=new URLSearchParams(window.location.search);
    const explicit=p.has('city')||p.has('county');
    const hour=Number(p.get('hour')??18),cityId=p.get('city')??(explicit?'all':regionPreference.selection.cityId),operator=p.get('operator')??'all';
    const id=p.get('site'),countyId=p.get('county')??(explicit?'all':regionPreference.selection.countyId);
    const patch:Parameters<typeof state.set>[0]={hour:Number.isInteger(hour)&&hour>=0&&hour<=23?hour:18,
      cityId:region.cities.some(c=>c.id===cityId)?cityId:'all',operator:Object.hasOwn(OP_NAMES,operator)?operator as OperatorFilter:'all'};
    patch.countyId=region.counties.some(c=>c.id===countyId&&c.cityId===patch.cityId)?countyId:'all';
    if(id&&/^[A-Za-z0-9-]{1,40}$/.test(id))patch.selectedId=id;
    else patch.selectedId=null;
    try {const saved=JSON.parse(localStorage.getItem('bsmoss.map-view.v1')??'null');if(saved?.version===1)for(const key of ['showSites','showHeat','showBoundaries','showLabels'] as const)if(typeof saved[key]==='boolean')patch[key]=saved[key];}catch{/* Invalid local preferences use defaults. */}
    try {patch.display=resolveDisplay(JSON.parse(localStorage.getItem(DISPLAY_KEY)??'null'));}catch{patch.display=resolveDisplay(null);}
    if(p.has('selection'))try{patch.selection=parseSelection(p.get('selection')!);patch.drawMode=Array.isArray(patch.selection)?'rectangle':patch.selection.kind;patch.selectionOpen=true;if(!id)patch.selectedId=null;}catch{/* Invalid URL geometry does not become a selection. */}
    if(p.has('compare'))try{patch.compareIds=parseComparisonIds(p.get('compare')!);patch.compareOpen=true;patch.selectionOpen=false;if(!id)patch.selectedId=null;}catch{/* Invalid comparison links are ignored. */}
    if(p.has('topic'))try{patch.topic=parseTopic(p.get('topic')!);patch.topicOpen=true;patch.selectionOpen=false;patch.compareOpen=false;if(!id)patch.selectedId=null;}catch{/* Invalid topic links are ignored. */}
    if(['hour','day','week','month'].includes(p.get('usage')??'')){patch.usageOpen=true;patch.usagePeriod=p.get('usage') as 'hour'|'day'|'week'|'month';patch.topicOpen=false;patch.selectionOpen=false;patch.compareOpen=false;}
    if(['day','week','month'].includes(p.get('report')??'')){patch.reportPeriod=p.get('report') as 'day'|'week'|'month';patch.reportOpen=true;patch.usageOpen=false;patch.topicOpen=false;patch.selectionOpen=false;patch.compareOpen=false;}
    if(window.innerWidth<1000)patch.leftOpen=false;
    const search=(p.get('search')??'').trim();patch.search=search.length<=80?search:'';
    state.set(patch);setHydrated(true);
  // Initialize only from the URL and local display preferences.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[region]);
  useEffect(()=>{
    if(!hydrated)return;
    const p=new URLSearchParams({city:state.cityId,county:state.countyId});if(state.operator!=='all')p.set('operator',state.operator);
    rememberBrowserRegion(regionPreference.cookieName,region,state);
    if(state.selection)p.set('selection',serializeSelection(state.selection));
    if(state.compareIds.length)p.set('compare',state.compareIds.join(','));
    if(state.topicOpen)p.set('topic',state.topic);
    if(state.usageOpen)p.set('usage',state.usagePeriod);
    if(state.reportOpen)p.set('report',state.reportPeriod);
    if(state.search)p.set('search',state.search);
    p.set('hour',String(state.hour));if(state.selectedId)p.set('site',state.selectedId);
    window.history.replaceState(null,'','?'+p.toString());
  },[hydrated,state.cityId,state.countyId,state.operator,state.hour,state.selectedId,state.selection,state.compareIds,state.topic,state.topicOpen,state.usageOpen,state.usagePeriod,state.reportOpen,state.reportPeriod,state.search]);
  useEffect(()=>{
    if(!hydrated)return;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setMapLoading(true);setMapError(false);
      try {const response=await fetch('/api/product-preview/map?'+queryString(useWorkbench.getState(),region,true),{signal:controller.signal});if(!response.ok)throw Error('query_failed');const result=await response.json();if(!controller.signal.aborted)setSnapshot(result);}
      catch {if(!controller.signal.aborted)setMapError(true);}finally{if(!controller.signal.aborted)setMapLoading(false);}
    },150);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[hydrated,state.cityId,state.countyId,state.operator,state.hour,state.bounds,state.search,state.selection,state.topic,state.topicOpen,mapRevision,region]);
  useEffect(()=>{
    if(!hydrated)return;
    if(!state.selectedId){setDetail(null);return;}
    const controller=new AbortController();setDetailLoading(true);setDetail(null);setError(null);
    fetch('/api/product-preview/station/'+encodeURIComponent(state.selectedId)+'?'+queryString(state,region),{signal:controller.signal})
      .then(async response=>{if(!response.ok)throw Error(response.status===404?'\u5f53\u524d\u7b5b\u9009\u8303\u56f4\u5185\u6ca1\u6709\u8be5\u7ad9\u70b9':'\u7ad9\u70b9\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9');return response.json();})
      .then(result=>{if(!controller.signal.aborted)setDetail(result);})
      .catch(err=>{if(!controller.signal.aborted)setError(err.message);}).finally(()=>{if(!controller.signal.aborted)setDetailLoading(false);});
    return ()=>controller.abort();
  // Only query context changes should reload a station.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[hydrated,state.selectedId,state.hour,state.operator,state.cityId,state.countyId,state.selection,detailRevision,region]);
  useEffect(()=>{if(!state.playing)return;const timer=setInterval(()=>{const latest=useWorkbench.getState();latest.set({hour:(latest.hour+1)%24});},1800);return()=>clearInterval(timer);},[state.playing]);
  useEffect(()=>{if(!hydrated)return;try{localStorage.setItem(DISPLAY_KEY,JSON.stringify(state.display));}catch{/* Display works without persistence. */}},[hydrated,state.display]);
  const pick=useCallback((id:string)=>{const current=useWorkbench.getState();current.set({selectedId:id,expanded:false,search:'',detailOpen:true,...(current.reportOpen?{stationPeriods:{runtime:current.reportPeriod,business:current.reportPeriod},returnToReport:true,tab:'business',runtimeOpen:false,businessOpen:true}:{returnToReport:false})});},[]);
  const mapPick=useCallback((id:string)=>{const current=useWorkbench.getState();if(current.compareOpen)current.addComparison(id);else pick(id);},[pick]);
  const contextKey=mapContextKey({regionId:region.id,cityId:state.cityId,countyId:state.countyId,operator:state.operator,hour:state.hour,search:state.search,selection:state.selection??undefined,topic:state.topicOpen?state.topic:undefined});
  const currentSnapshot=snapshot.contextKey===contextKey;
  const summary=snapshot.summary;
  const topicPoints=state.topicOpen?displayedTopicPoints(currentSnapshot?snapshot.points:[],state.display.topics[state.topic].mapScope):[];
  const city=region.cities.find(c=>c.id===state.cityId);
  const county=region.counties.find(c=>c.id===state.countyId);
  const inSceneScope=(scene:typeof SCENES[number])=>(state.cityId==='all'||scene.city===state.cityId)&&(state.countyId==='all'||scenes.some(s=>s.id===scene.id&&s.countyId===state.countyId))&&!state.selection;
  const saveSetting=(key:'showSites'|'showBoundaries'|'showHeat'|'showLabels',value:boolean)=>{
    state.set({[key]:value});const latest=useWorkbench.getState();try {localStorage.setItem('bsmoss.map-view.v1',JSON.stringify({version:1,showSites:latest.showSites,showBoundaries:latest.showBoundaries,showHeat:latest.showHeat,showLabels:latest.showLabels}));}catch{/* The view still works when local storage is disabled. */}
  };
  return <main className={"mw-app mw-hud "+(state.leftOpen?"mw-left-open ":"")+(state.detailOpen?"mw-detail-open ":"")+(state.compareOpen||state.usageOpen||state.reportOpen?"mw-compare-open ":"")+(state.topicOpen?"mw-topic-open ":"")+(state.selectionOpen?"mw-area-open ":"")} data-demo-version={initialSnapshot.version}>
    <nav className="mw-rail" aria-label={'\u5de5\u4f5c\u53f0\u5bfc\u822a'}><div className="mw-rail-brand"><RadioTower size={26}/></div><div className="mw-rail-main"><button className={state.leftOpen?"active":""} title={"\u56fe\u5c42\u4e0e\u7ad9\u70b9"} aria-label={"\u56fe\u5c42\u4e0e\u7ad9\u70b9"} onClick={()=>state.set({leftOpen:!state.leftOpen})}><Layers size={19}/><span>{"\u56fe\u5c42"}</span></button><button className={state.theme==='status'?'active':''} title={'\u7ad9\u7f51\u8fd0\u884c\u6001\u52bf'} aria-label={'\u7ad9\u7f51\u8fd0\u884c\u6001\u52bf'} onClick={()=>{state.set({theme:'status'});state.openPanel('runtime');}}><Globe2 size={21}/><span>{'\u6001\u52bf'}</span></button><button className={state.theme==='traffic'?'active':''} title={'\u7ecf\u8425\u670d\u52a1\u5206\u6790'} aria-label={'\u7ecf\u8425\u670d\u52a1\u5206\u6790'} onClick={()=>{state.set({theme:'traffic'});state.openPanel('business');}}><BarChart3 size={21}/><span>{'\u7ecf\u8425'}</span></button><button className={state.theme==='energy'?'active':''} title={'\u8fd0\u884c\u53c2\u6570\u5206\u6790'} aria-label={'\u8fd0\u884c\u53c2\u6570\u5206\u6790'} onClick={()=>{state.set({theme:'energy'});state.openPanel('runtime');}}><Zap size={21}/><span>{'\u8fd0\u884c'}</span></button><button className={state.drawing||state.selection?'active':''} aria-label={'\u6846\u9009\u5206\u6790'} title={'\u6846\u9009\u5206\u6790'} onClick={()=>state.drawing?state.cancelSelection():state.beginSelection()}><BoxSelect size={19}/></button><button className={state.compareOpen?"active":""} aria-label={"\u7ad9\u70b9\u5bf9\u6bd4"} title={"\u7ad9\u70b9\u5bf9\u6bd4"} onClick={()=>state.set({compareOpen:!state.compareOpen,search:""})}><Columns3 size={19}/>{state.compareIds.length>0&&<small className="mw-compare-count">{state.compareIds.length}</small>}</button><button className={state.topicOpen?"active":""} aria-label={"\u4e13\u9898\u5206\u6790"} title={"\u4e13\u9898\u5206\u6790"} onClick={()=>state.set({topicOpen:!state.topicOpen})}><Radar size={19}/></button><button className={state.usageOpen?"active":""} aria-label={"\u8fd0\u8425\u5546\u4f7f\u7528\u6838\u67e5"} title={"\u8fd0\u8425\u5546\u4f7f\u7528\u6838\u67e5"} onClick={()=>state.set({usageOpen:!state.usageOpen})}><Table2 size={19}/></button><button className={state.reportOpen?"active":""} aria-label={"\u5468\u671f\u5206\u6790\u62a5\u544a"} title={"\u5468\u671f\u5206\u6790\u62a5\u544a"} onClick={()=>state.set({reportOpen:!state.reportOpen})}><FileText size={19}/></button></div><div className="mw-rail-bottom"><button className={settings?'active':''} title={'\u663e\u793a\u8bbe\u7f6e'} aria-label={'\u663e\u793a\u8bbe\u7f6e'} onClick={()=>setSettings(!settings)}><SlidersHorizontal size={19}/></button><button title={'\u4f7f\u7528\u5e2e\u52a9'} aria-label={'\u4f7f\u7528\u5e2e\u52a9'} onClick={()=>setHelp(!help)}><CircleHelp size={19}/></button><div className="mw-avatar">{'\u5854'}</div></div></nav>
    <header className="mw-header"><a href="/" className="mw-product" aria-label={"\u8fd4\u56de\u8fd0\u884c\u603b\u89c8"} title={"\u8fd4\u56de\u8fd0\u884c\u603b\u89c8"}><strong>{'\u89c2\u6f9c'}</strong><div className="mw-product-subline"><span>BS-MOSS</span><small>{'\u7ad9\u5740\u591a\u57df\u8fd0\u8425\u76d1\u7ba1'}</small></div></a><div className="mw-header-divider"/><div className="mw-region-heading"><RegionSelector region={region} value={state} onChange={value=>state.set({...value,selection:null,selectionOpen:false,compareIds:[],compareOpen:false,selectedId:null,expanded:false,search:''})}/></div><div className="mw-header-right"><span className="mw-fixed-date">{'2026.10.25 / \u5468\u65e5'}</span><span className="mw-demo-badge"><i/>{'\u6f14\u793a\u6570\u636e'}</span><span className="mw-header-planning">{'\u9655\u897f\u89c4\u5212 \u00b7 \u7ea6 11 \u4e07\u7ad9\u5740'}</span></div></header>
    <section className="mw-stage">
      <MapCanvas region={region} points={state.topicOpen?topicPoints:currentSnapshot?snapshot.points:[]} selected={detail?.site??null} onPick={mapPick} context={<div className="mw-map-context"><span><i/>{'\u5730\u7406\u89c6\u56fe'}</span><small>{state.topicOpen?TOPIC_NAMES[state.topic]:state.theme==='status'?'\u8fd0\u884c\u72b6\u6001':state.theme==='traffic'?'\u53cc\u5411\u6d41\u91cf \u00b7 GiB':'\u7ad9\u5740\u65f6\u6bb5\u7535\u8017 \u00b7 kWh'}</small>{mapLoading&&<LoaderCircle size={12} className="mw-spin"/>}</div>}/>
      <section className="mw-left-panel"><div className="mw-floating-heading"><span>{"\u56fe\u5c42\u4e0e\u7ad9\u70b9"}</span><small>{summary.count+" \u7ad9"}</small><button className="mw-icon-button" aria-label={"\u6536\u8d77\u56fe\u5c42\u9762\u677f"} onClick={()=>state.set({leftOpen:false})}><X size={13}/></button></div>
        <div className="mw-overview-title"><span className="mw-section-kicker">{'NETWORK OBSERVATORY'}</span><h1>{county?county.name:city?city.name+'\u7ad9\u7f51':'\u9655\u897f\u7ad9\u7f51\u6001\u52bf'}<span>{'\u8fd0\u884c\u4e0e\u7ecf\u8425\uff0c\u5168\u57df\u6d1e\u5bdf'}</span></h1></div>
        <label className="mw-search"><Search size={15}/><input aria-label={'\u68c0\u7d22\u7ad9\u70b9'} value={state.search} onChange={e=>state.set({search:e.target.value})} placeholder={'\u68c0\u7d22\u7ad9\u70b9\u540d\u79f0 / \u7f16\u53f7'}/>{state.search&&<button aria-label={'\u6e05\u9664\u68c0\u7d22'} onClick={()=>state.set({search:''})}><X size={13}/></button>}</label>
        <div className="mw-filter-row"><span>{'\u670d\u52a1\u8fd0\u8425\u5546'}</span><select aria-label={'\u670d\u52a1\u8fd0\u8425\u5546'} value={state.operator} onChange={e=>state.set({operator:e.target.value as OperatorFilter,selectedId:null,expanded:false})}><option value="all">{'\u5168\u90e8\u8fd0\u8425\u5546'}</option>{Object.entries(OP_NAMES).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></div>
        <div className="mw-site-count"><div><span>{'\u5f53\u524d\u8303\u56f4\u7ad9\u70b9'}</span><strong>{n(summary.count,0)}<small>{'\u4e2a'}</small></strong></div><RadioTower size={42}/></div>
        <div className="mw-health-summary"><div><i className="normal"/><strong>{summary.normal}</strong><span>{'\u5e73\u7a33'}</span></div><div><i className="warning"/><strong>{summary.warning}</strong><span>{'\u5173\u6ce8'}</span></div><div><i className="critical"/><strong>{summary.critical}</strong><span>{'\u5f02\u5e38'}</span></div></div>
        <div className="mw-left-section"><div className="mw-panel-label"><span>{'\u5206\u6790\u4e3b\u9898'}</span><Layers size={13}/></div><div className="mw-theme-buttons">{([{key:'status',label:'\u8fd0\u884c\u6001\u52bf',icon:Activity},{key:'traffic',label:'\u4e1a\u52a1\u6d41\u91cf',icon:BarChart3},{key:'energy',label:'\u7ad9\u5740\u80fd\u8017',icon:Zap}] as const).map(item=><button key={item.key} className={state.theme===item.key?'active':''} onClick={()=>state.set({theme:item.key,tab:item.key==='traffic'?'business':'runtime'})}><item.icon size={15}/>{item.label}{state.theme===item.key&&<Check size={12}/>}</button>)}</div></div>
        {!state.search&&<div className="mw-left-section mw-scenes"><div className="mw-panel-label"><span>{'\u573a\u666f\u901f\u89c8'}</span><small>{'6 \u7c7b\u7ad9\u70b9\u753b\u50cf'}</small></div><div className="mw-scene-grid">{SCENES.filter(inSceneScope).map(scene=><button key={scene.id} className={state.selectedId===scene.id?'active':''} onClick={()=>state.set({selectedId:scene.id,operator:'all',search:'',hour:scene.id==='SX-DEMO-004'?12:scene.id==='SX-DEMO-005'?3:18,expanded:false,detailOpen:true})}><scene.icon size={14}/>{scene.label}<ArrowUpRight size={11}/></button>)}</div>{!SCENES.some(inSceneScope)&&<p className="mw-subtle">{'\u70b9\u51fb\u5730\u56fe\u70b9\u4f4d\u67e5\u770b\u533a\u57df\u6837\u4f8b\u7ad9\u3002'}</p>}</div>}
        <div className="mw-left-section mw-attention"><div className="mw-panel-label"><span>{state.search?'\u68c0\u7d22\u7ed3\u679c':'\u91cd\u70b9\u5173\u6ce8'}</span><small>{mapLoading?<LoaderCircle size={12} className="mw-spin"/>:String(state.hour).padStart(2,'0')+':00'}</small></div>{(currentSnapshot?snapshot.ranking:[]).slice(0,3).map((point,i)=><button key={point.id} className={state.selectedId===point.id?'active':''} onClick={()=>pick(point.id)}><span className="mw-rank">{String(i+1).padStart(2,'0')}</span><div><strong>{point.name}</strong><small>{n(point.trafficGiB)+' GiB'}<span>{'\u8d1f\u8f7d '+n(point.load*100)+'%'}</span></small></div><i className={point.status}/></button>)}{currentSnapshot&&!snapshot.ranking.length&&<p className="mw-subtle">{'\u5f53\u524d\u68c0\u7d22\u6761\u4ef6\u4e0b\u65e0\u7ad9\u70b9'}</p>}</div>
        <div className="mw-left-foot"><i/>{mapError?'\u67e5\u8be2\u5931\u8d25\uff0c\u5f53\u524d\u663e\u793a\u4e0a\u6b21\u7ed3\u679c':mapLoading?'\u6b63\u5728\u66f4\u65b0\u5f53\u524d\u89c6\u56fe':'\u6837\u4f8b\u5feb\u7167 \u00b7 '+initialSnapshot.version}</div>
      </section>
      <SummaryStrip summary={summary} current={currentSnapshot}/>
      <div className="mw-selection-chip">{state.selection&&!state.drawing&&<><button onClick={()=>state.set({selectionOpen:!state.selectionOpen})}><BoxSelect size={12}/>{selectionLabel(state.selection)+' \u00b7 '+(currentSnapshot?summary.count:'\u2026')+' \u7ad9'}<span>{state.selectionOpen?'\u6536\u8d77\u5206\u6790':'\u533a\u57df\u5206\u6790'}</span></button><button aria-label={'\u6e05\u9664\u9009\u533a'} onClick={()=>state.clearSelection()}><X size={12}/></button></>}</div>
      {!state.selectionOpen&&!state.drawing&&<div className="mw-panel-launcher" aria-label={'\u7ad9\u70b9\u5206\u6790\u9762\u677f'}><button disabled={!state.selectedId} className={state.runtimeOpen?'active':''} onClick={()=>state.runtimeOpen&&(state.tab==='runtime'||(window.innerWidth>=1200&&!state.expanded))?state.closePanel('runtime'):state.openPanel('runtime')}><Activity size={13}/>{'\u8fd0\u884c\u68c0\u67e5'}</button><button disabled={!state.selectedId} className={state.businessOpen?'active':''} onClick={()=>state.businessOpen&&(state.tab==='business'||(window.innerWidth>=1200&&!state.expanded))?state.closePanel('business'):state.openPanel('business')}><BarChart3 size={13}/>{'\u7ecf\u8425\u7edf\u8ba1'}</button></div>}
      <AreaPanel snapshot={currentSnapshot?snapshot:null} loading={!currentSnapshot||mapLoading} error={mapError} onPick={pick} onRetry={()=>setMapRevision(v=>v+1)}/>
      <ComparisonPanel region={region} candidates={currentSnapshot?snapshot.ranking:[]} pending={!currentSnapshot||mapLoading} onInspect={pick}/>
      <OperatorPanel region={region}/>
      <ReportPanel region={region} onPick={pick}/>
      <TopicPanel region={region} snapshot={currentSnapshot?snapshot:null} loading={!currentSnapshot||mapLoading} error={mapError} onPick={pick} onRetry={()=>setMapRevision(v=>v+1)}/>
      <div className={'mw-panels '+(state.runtimeOpen&&state.businessOpen?'mw-panels-dual ':'')+(state.expanded?'mw-panels-expanded ':'')+'mw-focus-'+state.tab}>
        <StationPanel kind="runtime" detail={detail} loading={detailLoading} error={error} onRetry={()=>setDetailRevision(v=>v+1)}/>
        <StationPanel kind="business" detail={detail} loading={detailLoading} error={error} onRetry={()=>setDetailRevision(v=>v+1)}/>
      </div>
      <div className={"mw-timeline "+(timelineExpanded?"mw-timeline-expanded":"")}><button className="mw-timeline-toggle" aria-label={timelineExpanded?"\u6536\u8d77\u65f6\u5e8f\u56de\u653e":"\u5c55\u5f00\u65f6\u5e8f\u56de\u653e"} aria-expanded={timelineExpanded} onClick={()=>setTimelineExpanded(!timelineExpanded)}><ChevronDown size={12}/></button><div className="mw-timeline-head"><button aria-label={state.playing?'\u6682\u505c\u65f6\u95f4\u56de\u653e':'\u5f00\u59cb\u65f6\u95f4\u56de\u653e'} className={'mw-play '+(state.playing?'active':'')} onClick={()=>state.set({playing:!state.playing})}>{state.playing?<Pause size={14}/>:<Play size={14}/>}</button><div><strong>{'\u65f6\u5e8f\u56de\u653e'}</strong><span>{DEMO_DATE+' \u00b7 \u5c0f\u65f6\u5feb\u7167'}</span></div><div className="mw-current-hour"><button aria-label={'\u4e0a\u4e00\u5c0f\u65f6'} onClick={()=>state.set({hour:(state.hour+23)%24,playing:false})}><ChevronLeft size={15}/></button><strong>{String(state.hour).padStart(2,'0')+':00'}</strong><button aria-label={'\u4e0b\u4e00\u5c0f\u65f6'} onClick={()=>state.set({hour:(state.hour+1)%24,playing:false})}><ChevronRight size={15}/></button></div></div><div className="mw-slider"><input type="range" min="0" max="23" value={state.hour} aria-label={'\u5206\u6790\u65f6\u6bb5'} onChange={e=>state.set({hour:Number(e.target.value),playing:false})} style={{'--progress':state.hour/23*100+'%'} as React.CSSProperties}/><div>{[0,6,12,18,23].map(h=><span key={h}>{String(h).padStart(2,'0')+':00'}</span>)}</div></div></div>
      <div className="mw-map-legend" aria-label={"\u7ad9\u70b9\u56fe\u4f8b\u4e0e\u89c6\u7a97\u6570\u91cf"}><small className="mw-legend-count" title={'\u5f53\u524d\u89c6\u7a97\u5185\u7684\u7ad9\u70b9'}>{!state.showSites?'\u56fe\u5c42\u5df2\u9690\u85cf':<><strong>{(state.topicOpen?topicPoints.length:snapshot.visibleCount).toLocaleString('en-US')}</strong>{' \u7ad9'}</>}</small>{state.topicOpen?<><span><i className="critical"/>{"\u4e25\u91cd"}</span><span><i className="warning"/>{"\u5173\u6ce8"}</span>{state.display.topics[state.topic].mapScope==='all'&&<span><i className="normal"/>{"\u5e73\u7a33"}</span>}<span><i className="unknown"/>{"\u672a\u77e5"}</span></>:<><span><i className="normal"/>{'\u5e73\u7a33'}</span><span><i className="warning"/>{'\u5173\u6ce8'}</span><span><i className="critical"/>{'\u5f02\u5e38'}</span></>}</div>
    </section>
    <ActivityTicker snapshot={snapshot} onPick={pick}/>
    {settings&&<section className="mw-settings" aria-label={'\u5730\u56fe\u663e\u793a\u914d\u7f6e'}><div className="mw-panel-label"><strong>{'\u5730\u56fe\u663e\u793a\u914d\u7f6e'}</strong><button className="mw-icon-button" aria-label={'\u5173\u95ed\u663e\u793a\u914d\u7f6e'} onClick={()=>setSettings(false)}><X size={16}/></button></div>{([{key:'showSites',label:'\u7ad9\u5740\u70b9\u4f4d\u4e0e\u805a\u5408'},{key:'showBoundaries',label:'\u5730\u5e02\u8fb9\u754c\u4e0e\u533a\u57df\u586b\u8272'},{key:'showLabels',label:'\u5730\u5e02\u540d\u79f0\u6807\u7b7e'},{key:'showHeat',label:'\u4e1a\u52a1\u6d41\u91cf\u70ed\u529b'}] as const).map(item=><label key={item.key}><span>{item.label}</span><input type="checkbox" checked={state[item.key]} onChange={e=>saveSetting(item.key,e.target.checked)}/></label>)}<button className="mw-text-button" onClick={()=>{for(const key of ['showSites','showBoundaries','showLabels'] as const)saveSetting(key,true);saveSetting('showHeat',false);}}><RotateCcw size={12}/>{'\u6062\u590d\u9ed8\u8ba4'}</button><SummarySettings/><a href="/product-preview/metrics">{'\u6253\u5f00\u6307\u6807\u4e0e\u89c6\u56fe\u914d\u7f6e'}<ArrowUpRight size={13}/></a></section>}
    {help&&<div className="mw-help-backdrop" onClick={()=>setHelp(false)}><section role="dialog" aria-modal="true" aria-label={'\u4f7f\u7528\u5e2e\u52a9'} className="mw-help" onClick={e=>e.stopPropagation()}><button className="mw-icon-button" aria-label={'\u5173\u95ed\u4f7f\u7528\u5e2e\u52a9'} onClick={()=>setHelp(false)}><X size={18}/></button><span className="mw-section-kicker">{'EXPLORE \u00b7 UNDERSTAND \u00b7 ACT'}</span><h2>{'\u4ece\u5168\u7701\u6001\u52bf\uff0c\u5230\u4e00\u4e2a\u7ad9\u70b9\u7684\u6d1e\u5bdf'}</h2><p>{'\u6309\u5730\u5e02\u3001\u533a\u53bf\u7b5b\u9009\u7ad9\u7f51\u8303\u56f4\uff0c\u5173\u8054\u67e5\u770b\u7ad9\u5740\u8fd0\u884c\u72b6\u6001\u3001\u7ecf\u8425\u7528\u91cf\u4e0e\u8bbe\u5907\u53c2\u6570\u3002'}</p><ol><li>{'\u4ece\u573a\u666f\u901f\u89c8\u9009\u62e9\u7ad9\u70b9\uff0c\u6216\u70b9\u51fb\u5730\u56fe\u805a\u5408\u4e0e\u70b9\u4f4d\u3002'}</li><li>{'\u5207\u6362\u8fd0\u884c\u72b6\u6001\u4e0e\u7ecf\u8425\u5206\u6790\uff0c\u5c55\u5f00\u5b8c\u6574\u7ad9\u70b9\u753b\u50cf\u3002'}</li><li>{'\u62d6\u52a8\u65f6\u5e8f\u56de\u653e\uff0c\u89c2\u5bdf\u4e1a\u52a1\u3001\u8d1f\u8f7d\u548c\u8bbe\u5907\u4e8b\u4ef6\u7684\u5173\u8054\u3002'}</li></ol><small>{'\u53ef\u4ece\u4e13\u9898\u5206\u6790\u3001\u8fd0\u8425\u5546\u7528\u91cf\u4e0e\u5468\u671f\u62a5\u544a\u5c55\u5f00\u8c03\u67e5\u3002\u5728\u7ebf\u5e95\u56fe\u4e0d\u53ef\u7528\u65f6\u4ecd\u53ef\u67e5\u770b\u672c\u5730\u8fb9\u754c\u3001\u7ad9\u70b9\u548c\u5206\u6790\u7ed3\u679c\u3002'}</small><a className="mw-copyright-link" href="/product-preview/copyright" target="_blank" rel="noopener noreferrer">{'\u5730\u56fe\u6765\u6e90\u4e0e\u7248\u6743\u58f0\u660e'}<ArrowUpRight size={12}/></a></section></div>}
  </main>;
}
