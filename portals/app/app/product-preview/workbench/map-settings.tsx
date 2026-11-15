'use client';
import {Button, SegmentedControl, Switch} from '@vxture/design-system';
import {Map, Satellite, Square, Box, SlidersHorizontal, RotateCcw, X} from 'lucide-react';
import {useWorkbench} from '../../domains/map-demo/workbench-store.ts';

type Props={basemap:'map'|'satellite';onBasemap:(value:'map'|'satellite')=>void;tilted:boolean;onTilt:(value:boolean)=>void;scrollZoom:boolean;onScrollZoom:(value:boolean)=>void;autoFit:boolean;onAutoFit:(value:boolean)=>void;onClose:()=>void;};
export default function MapSettings(p:Props){
 const state=useWorkbench();
 const row=(label:string,checked:boolean,onChange?:(next:boolean)=>void)=><label className="mw-config-row"><span>{label}</span><Switch aria-label={label} checked={checked} disabled={!onChange} onCheckedChange={onChange}/></label>;
 return <div id="mw-map-settings" className="mw-map-settings-popover mw-config" role="dialog" aria-label={"\u5730\u56fe\u8bbe\u7f6e"}>
  <header className="mw-config-header"><span><SlidersHorizontal size={16}/>{"\u5730\u56fe\u8bbe\u7f6e"}</span><Button variant="ghost" size="icon-sm" aria-label={"\u5173\u95ed\u5730\u56fe\u8bbe\u7f6e"} onClick={p.onClose}><X size={16}/></Button></header>
  <div className="mw-config-columns"><div className="mw-config-left">
   <section><h3>{"\u5730\u56fe\u4e3b\u9898"}</h3><SegmentedControl ariaLabel={"\u5730\u56fe\u4e3b\u9898"} value="dark" onChange={()=>{}} items={[{value:'system',label:'\u8ddf\u968f\u5168\u5c40',disabled:true},{value:'light',label:'\u4eae\u8272',disabled:true},{value:'dark',label:'\u6697\u8272'}]}/></section>
   <section><h3>{"\u5e95\u56fe\u7c7b\u578b"}</h3><div className="mw-config-options">{(['map','satellite'] as const).map(value=><Button key={value} variant={p.basemap===value?'outline':'ghost'} aria-pressed={p.basemap===value} className="mw-config-tile" onClick={()=>p.onBasemap(value)}><span className={'mw-config-preview mw-config-'+value}>{value==='map'?<Map size={34}/>:<Satellite size={34}/>}</span><span>{value==='map'?'\u6807\u51c6\u5730\u56fe':'\u536b\u661f\u5f71\u50cf'}</span></Button>)}</div></section>
   <section><h3>{"\u89c6\u56fe\u6a21\u5f0f"}</h3><div className="mw-config-options"><Button variant="outline" aria-pressed={!p.tilted} className="mw-config-tile" onClick={()=>p.onTilt(false)}><span className="mw-config-preview"><Square size={34}/></span><span>2D</span></Button><Button variant="ghost" disabled className="mw-config-tile" title={"\u4e09\u7ef4\u6a21\u578b\u5c1a\u672a\u63a5\u5165"}><span className="mw-config-preview"><Box size={34}/></span><span>3D</span></Button></div></section>
  </div><div className="mw-config-right"><section><h3>{"\u5730\u56fe\u8981\u7d20"}</h3>
   {row('\u884c\u653f\u8fb9\u754c',state.showBoundaries,next=>state.set({showBoundaries:next}))}
   {row('\u9053\u8def',true)}{row('\u5efa\u7b51\u7269',false)}{row('\u5174\u8da3\u70b9\uff08POI\uff09',false)}
   {row('\u4e1a\u52a1\u7ad9\u70b9',state.showSites,next=>state.set({showSites:next}))}
  </section><section><h3>{"\u4ea4\u4e92\u4e0e\u663e\u793a"}</h3>
   {row('\u6eda\u8f6e\u7f29\u653e',p.scrollZoom,p.onScrollZoom)}{row('\u7b5b\u9009\u540e\u81ea\u52a8\u53d6\u666f',p.autoFit,p.onAutoFit)}
   {row('\u7ad9\u70b9\u72b6\u6001\u56fe\u4f8b',state.showLegend,next=>state.set({showLegend:next}))}
   {row('\u503e\u659c\u89c6\u89d2',p.tilted,p.onTilt)}
  </section></div></div>
  <footer><Button variant="ghost" onClick={()=>{p.onBasemap('map');p.onTilt(false);p.onScrollZoom(true);p.onAutoFit(true);state.set({showSites:true,showBoundaries:true,showLegend:true});}}><RotateCcw size={14}/>{"\u6062\u590d\u9ed8\u8ba4"}</Button></footer>
 </div>;
}
