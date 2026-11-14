'use client';
import { parseSelection, serializeSelection } from './geometry.ts';
import { COMPARE_LIMIT } from './comparison-rules.ts';
import {defaultDisplay,resolveDisplay,type DisplayPreferences} from './display-rules.ts';
import { create } from 'zustand';
import type { OperatorFilter, Theme, Bounds, Selection, TopicKind } from './types.ts';
import type {ReportPeriod} from './period-rules.ts';
export type AnalysisPanel = 'runtime'|'business';
export type StationPeriodChoice = 'snapshot'|ReportPeriod;
interface WorkbenchState {
  stationPeriods:Record<AnalysisPanel,StationPeriodChoice>;returnToReport:boolean;
  reportOpen:boolean;reportPeriod:ReportPeriod;
  usageOpen:boolean;usagePeriod:'hour'|ReportPeriod;
  display:DisplayPreferences;
  topic:TopicKind;topicOpen:boolean;
  compareIds:string[]; compareOpen:boolean;
  addComparison:(id:string)=>void; removeComparison:(id:string)=>void; clearComparison:()=>void;
  cityId:string; countyId:string; operator:OperatorFilter; hour:number; selectedId:string|null; theme:Theme;
  playing:boolean; showSites:boolean; showBoundaries:boolean; showHeat:boolean; showLabels:boolean;
  bounds:Bounds|null; tab:AnalysisPanel; expanded:boolean; search:string; leftOpen:boolean; detailOpen:boolean;
  selection:Selection|null; selectionOpen:boolean; drawing:boolean; drawMode:'rectangle'|'circle'|'polygon';
  beginSelection:(mode?:'rectangle'|'circle'|'polygon')=>void; finishSelection:(selection:Selection)=>void; cancelSelection:()=>void; clearSelection:()=>void;
  runtimeOpen:boolean; businessOpen:boolean; expandedPanel:AnalysisPanel|null;
  set:(patch:Partial<Omit<WorkbenchState,'set'|'openPanel'|'closePanel'|'expandPanel'|'beginSelection'|'finishSelection'|'cancelSelection'|'clearSelection'|'addComparison'|'removeComparison'|'clearComparison'>>) => void;
  openPanel:(kind:AnalysisPanel,replace?:boolean)=>void;
  closePanel:(kind:AnalysisPanel)=>void;
  expandPanel:(kind:AnalysisPanel)=>void;
}
export const useWorkbench=create<WorkbenchState>((set,get)=>({cityId:'all',countyId:'all',operator:'all',hour:18,selectedId:null,theme:'status',
  stationPeriods:{runtime:'snapshot',business:'snapshot'},returnToReport:false,
  playing:false,showSites:true,showBoundaries:true,showHeat:false,showLabels:true,bounds:null,tab:'runtime',expanded:false,search:'',leftOpen:false,detailOpen:false,
  reportOpen:false,reportPeriod:'day',usageOpen:false,usagePeriod:'hour',runtimeOpen:false,businessOpen:false,expandedPanel:null,selection:null,selectionOpen:false,drawing:false,drawMode:'rectangle',compareIds:[],compareOpen:false,topic:'capacity',topicOpen:false,display:defaultDisplay(),
  set:patch=>set(current=>{
    const next={...current,...patch};
    const scopeChanged=(patch.cityId!==undefined&&patch.cityId!==current.cityId)||(patch.countyId!==undefined&&patch.countyId!==current.countyId)||(patch.operator!==undefined&&patch.operator!==current.operator)||patch.selection!==undefined;
    if(patch.selectedId!==undefined&&patch.selectedId!==current.selectedId)next.stationPeriods=patch.stationPeriods??{runtime:'snapshot',business:'snapshot'};
    if(scopeChanged||(patch.selectedId!==undefined&&patch.selectedId!==current.selectedId))next.returnToReport=patch.returnToReport??false;
    if(patch.display!==undefined)next.display=resolveDisplay(patch.display);
    if(patch.cityId!==undefined&&patch.cityId!==current.cityId)next.countyId=patch.countyId??'all';
    if((patch.cityId!==undefined&&patch.cityId!==current.cityId)||(patch.countyId!==undefined&&patch.countyId!==current.countyId)){next.selection=patch.selection??null;next.selectionOpen=!!patch.selection;next.drawing=false;}
    if((patch.cityId!==undefined&&patch.cityId!==current.cityId)||(patch.countyId!==undefined&&patch.countyId!==current.countyId)||patch.selection!==undefined){next.compareIds=patch.compareIds??[];}
    if(patch.detailOpen===true){next.selectionOpen=false;next.compareOpen=false;next.topicOpen=false;}
    if(patch.leftOpen===true)next.selectionOpen=false;
    if(patch.selectionOpen===true){next.leftOpen=false;next.runtimeOpen=false;next.businessOpen=false;next.expandedPanel=null;}
    if(patch.selectionOpen===true||patch.leftOpen===true||patch.drawing===true)next.compareOpen=false;
    if(patch.compareOpen===true){next.selectionOpen=false;next.leftOpen=false;next.runtimeOpen=false;next.businessOpen=false;next.expandedPanel=null;next.drawing=false;}
    if(patch.selectionOpen===true||patch.leftOpen===true||patch.drawing===true||patch.compareOpen===true)next.topicOpen=false;
    if(patch.topicOpen===true){next.compareOpen=false;next.selectionOpen=false;next.leftOpen=false;next.runtimeOpen=false;next.businessOpen=false;next.expandedPanel=null;next.drawing=false;next.search=patch.search??'';}
    if(patch.detailOpen===true||patch.selectionOpen===true||patch.leftOpen===true||patch.drawing===true||patch.compareOpen===true||patch.topicOpen===true)next.usageOpen=false;
    if(patch.usageOpen===true){next.topicOpen=false;next.compareOpen=false;next.selectionOpen=false;next.leftOpen=false;next.runtimeOpen=false;next.businessOpen=false;next.expandedPanel=null;next.drawing=false;next.search=patch.search??'';}
    if(patch.detailOpen===true||patch.selectionOpen===true||patch.leftOpen===true||patch.drawing===true||patch.compareOpen===true||patch.topicOpen===true||patch.usageOpen===true)next.reportOpen=false;
    if(patch.reportOpen===true){next.usageOpen=false;next.topicOpen=false;next.compareOpen=false;next.selectionOpen=false;next.leftOpen=false;next.runtimeOpen=false;next.businessOpen=false;next.expandedPanel=null;next.drawing=false;next.search=patch.search??'';next.playing=false;}
    if(patch.expanded===false)next.expandedPanel=null;
    if(patch.selectedId===null||patch.detailOpen===false){next.runtimeOpen=false;next.businessOpen=false;next.expandedPanel=null;}
    if(patch.detailOpen===true&&!next.runtimeOpen&&!next.businessOpen)next[next.tab==='runtime'?'runtimeOpen':'businessOpen']=true;
    next.detailOpen=next.runtimeOpen||next.businessOpen;next.expanded=next.expandedPanel!==null;
    return next;
  }),
  openPanel:(kind,replace=false)=>{if(!get().selectedId)return;set(current=>({tab:kind,detailOpen:true,selectionOpen:false,compareOpen:false,topicOpen:false,usageOpen:false,reportOpen:false,expanded:false,expandedPanel:null,
    runtimeOpen:kind==='runtime'||(!replace&&current.runtimeOpen),businessOpen:kind==='business'||(!replace&&current.businessOpen),
    leftOpen:replace?current.leftOpen:false}));},
  closePanel:kind=>set(current=>{const runtimeOpen=kind==='runtime'?false:current.runtimeOpen,businessOpen=kind==='business'?false:current.businessOpen;
    const expandedPanel=current.expandedPanel===kind?null:current.expandedPanel;
    return {runtimeOpen,businessOpen,detailOpen:runtimeOpen||businessOpen,tab:runtimeOpen?'runtime':'business',expandedPanel,expanded:expandedPanel!==null};}),
  beginSelection:(mode=get().drawMode)=>get().set({drawMode:mode,drawing:true,selectionOpen:false,leftOpen:false,detailOpen:false,playing:false}),
  finishSelection:selection=>get().set({selection:parseSelection(serializeSelection(selection)),drawMode:Array.isArray(selection)?'rectangle':selection.kind,drawing:false,selectionOpen:true,selectedId:null,search:'',leftOpen:false}),
  cancelSelection:()=>get().set({drawing:false,selectionOpen:!!get().selection}),
  clearSelection:()=>get().set({selection:null,selectionOpen:false,drawing:false}),
  addComparison:id=>{if(!/^[A-Za-z0-9-]{1,40}$/.test(id))return;const ids=get().compareIds;if(!ids.includes(id)&&ids.length>=COMPARE_LIMIT)return;get().set({compareIds:ids.includes(id)?ids:[...ids,id],compareOpen:true,search:''});},
  removeComparison:id=>get().set({compareIds:get().compareIds.filter(value=>value!==id)}),
  clearComparison:()=>get().set({compareIds:[],search:''}),
  expandPanel:kind=>set(current=>({expandedPanel:current.expandedPanel===kind?null:kind,expanded:current.expandedPanel!==kind,tab:kind})),
}));
