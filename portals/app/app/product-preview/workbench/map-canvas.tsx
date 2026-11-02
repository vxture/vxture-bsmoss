'use client';
import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapInstance, ExpressionSpecification } from 'maplibre-gl';
import { LocateFixed, Plus, Minus, Layers, Map as MapIcon, Satellite, RefreshCw, Settings2, X, Circle, RectangleHorizontal, Pentagon } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useWorkbench } from '../../domains/map-demo/workbench-store.ts';
import { rectangle, circleFromPoints, polygonFromPoints, POLYGON_VERTEX_LIMIT, selectionPolygon, selectionBounds, selectionLabel } from '../../domains/map-demo/geometry.ts';
import { mapInsets } from './map-layout.ts';
import type { RegionDefinition, SitePoint, DemoSite, Bounds, Selection } from '../../domains/map-demo/types.ts';

export default function MapCanvas({region,points,selected,onPick,context}:{context:ReactNode;region:RegionDefinition;points:SitePoint[];selected:DemoSite|null;onPick:(id:string)=>void}) {
  const node=useRef<HTMLDivElement>(null),mapRef=useRef<MapInstance|null>(null);
  const pickRef=useRef(onPick);pickRef.current=onPick;
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false),[basemap,setBasemap]=useState<'map'|'satellite'>('map');
  const [tileOffline,setTileOffline]=useState(false),[tilted,setTilted]=useState(false);
  const [camera,setCamera]=useState<{lng:number;lat:number;zoom:number}|null>(null);
  const [mapSettingsOpen,setMapSettingsOpen]=useState(false);
  const dockRef=useRef<HTMLElement>(null),settingsButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!mapSettingsOpen)return;
    const dismiss=(event:PointerEvent)=>{if(event.target instanceof Node&&!dockRef.current?.contains(event.target))setMapSettingsOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMapSettingsOpen(false);settingsButton.current?.focus();}};
    document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
  },[mapSettingsOpen]);
  const state=useWorkbench();
  const firstSelection=useRef(selected?.id);
  const previousLayout=useRef<string|null>(null);
  const drawingAnchor=useRef<{coordinate:[number,number];pixel:[number,number]}|null>(null);
  const [draft,setDraft]=useState<Selection|null>(null),[corner,setCorner]=useState(false),[drawError,setDrawError]=useState(false);
  const polygonRef=useRef<[number,number][]>([]);
  const [vertices,setVertices]=useState<[number,number][]>([]),[hover,setHover]=useState<[number,number]|null>(null);
  function updateVertices(next:[number,number][]) {polygonRef.current=next;setVertices(next);setHover(null);setDrawError(false);}
  function completePolygon() {
    const polygon=polygonFromPoints(polygonRef.current);
    if(polygon)useWorkbench.getState().finishSelection(polygon);else setDrawError(true);
  }
  function undoVertex() {updateVertices(polygonRef.current.slice(0,-1));}
  const stableSelected=useRef(selected);if(selected)stableSelected.current=selected;
  useEffect(()=>{
    if(!node.current)return;
    let map:MapInstance;
    try {
      maplibregl.setWorkerUrl('/vendor/maplibre/maplibre-gl-worker.mjs');
      map=new maplibregl.Map({container:node.current,center:region.center,zoom:5.8,minZoom:3.5,maxZoom:17,trackResize:true,
        attributionControl:false,renderWorldCopies:false,canvasContextAttributes:{antialias:false},
        style:{version:8,glyphs:'/geo/fonts/{fontstack}/{range}.pbf',sources:{
          carto:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">&copy; OpenStreetMap contributors</a>'},
          districts:{type:'geojson',data:region.boundaryUrl},
          counties:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
          sites:{type:'geojson',data:{type:'FeatureCollection',features:[]},cluster:true,clusterMaxZoom:9,clusterRadius:35,
            clusterProperties:{warning:['+',['case',['==',['get','status'],'warning'],1,0]],critical:['+',['case',['==',['get','status'],'critical'],1,0]],topicWarning:['+',['case',['==',['get','topicLevel'],'warning'],1,0]],topicCritical:['+',['case',['==',['get','topicLevel'],'critical'],1,0]],topicUnknown:['+',['case',['==',['get','topicLevel'],'unknown'],1,0]]}},
          selection:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
          drawing:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
          selected:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
        },layers:[
          {id:'background',type:'background',paint:{'background-color':'#0a151c'}},
          {id:'carto',type:'raster',source:'carto',paint:{'raster-opacity':0.88,'raster-saturation':-1,'raster-brightness-max':0.22}},
          {id:'district-fill',type:'fill',source:'districts',paint:{'fill-color':['match',['get','adcode'],610100,'#164039',610300,'#15313c',610400,'#163b38',610600,'#183744',610800,'#20383c','#16343b'],'fill-opacity':0.18}},
          {id:'district-glow',type:'line',source:'districts',paint:{'line-color':'#52c5b1','line-width':5,'line-opacity':0.07}},
          {id:'district-lines',type:'line',source:'districts',paint:{'line-color':'#559c9b','line-width':1,'line-opacity':0.65}},
          {id:'county-fill',type:'fill',source:'counties',paint:{'fill-color':'#9fc59a','fill-opacity':0.02}},
          {id:'county-lines',type:'line',source:'counties',paint:{'line-color':'#91b59c','line-width':0.8,'line-opacity':0.6}},
          {id:'county-selected',type:'line',source:'counties',filter:['==',['to-string',['get','adcode']],'none'],paint:{'line-color':'#d4ddb2','line-width':2,'line-opacity':0.95}},
          {id:'selection-fill',type:'fill',source:'selection',paint:{'fill-color':'#a6c990','fill-opacity':0.12}},
          {id:'selection-line',type:'line',source:'selection',paint:{'line-color':'#c0d59e','line-width':1.5,'line-dasharray':[4,2]}},
          {id:'drawing-line',type:'line',source:'drawing',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#c0d59e','line-width':2,'line-dasharray':[3,2]}},
          {id:'drawing-vertices',type:'circle',source:'drawing',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':['case',['get','first'],6,4],'circle-color':'#dce8be','circle-stroke-color':'#142b2a','circle-stroke-width':2}},
          {id:'heat',type:'heatmap',source:'sites',maxzoom:13,layout:{visibility:'none'},paint:{'heatmap-weight':['interpolate',['linear'],['get','trafficGiB'],0,0,90,1],
            'heatmap-intensity':1,'heatmap-radius':35,'heatmap-opacity':0.45,'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(0,0,0,0)',0.3,'#155e64',0.6,'#40bca2',1,'#dfe98b']}},
          {id:'cluster-halo',type:'circle',source:'sites',filter:['has','point_count'],paint:{'circle-color':'#5cd0b1','circle-radius':['step',['get','point_count'],18,20,24,80,31],'circle-opacity':0.055}},
          {id:'clusters',type:'circle',source:'sites',filter:['has','point_count'],paint:{'circle-color':['case',['>', ['get','critical'],0],'#ba6555',['>',['get','warning'],0],'#9e8954','#287c73'],
            'circle-radius':['step',['get','point_count'],12,20,17,80,23],'circle-opacity':0.84,'circle-stroke-width':1,'circle-stroke-color':'#a0d5c2','circle-stroke-opacity':0.55}},
          {id:'cluster-count',type:'symbol',source:'sites',filter:['has','point_count'],layout:{'text-field':['to-string',['get','point_count']],'text-font':['Open Sans Regular'],'text-size':11},paint:{'text-color':'#f0f9f6'}},
          {id:'site-glow',type:'circle',source:'sites',filter:['!',['has','point_count']],paint:{'circle-radius':9,'circle-opacity':0.10,'circle-color':['match',['get','status'],'critical','#ed8d7a','warning','#d6b57a','#60cfb2']}},
          {id:'site-points',type:'circle',source:'sites',filter:['!',['has','point_count']],paint:{'circle-radius':['interpolate',['linear'],['zoom'],5,2.2,10,4.2,15,7],
            'circle-color':['match',['get','status'],'critical','#ed8d7a','warning','#d6b57a','#60cfb2'],'circle-stroke-width':0.8,'circle-stroke-color':'#c9f5e6','circle-stroke-opacity':0.5}},
          {id:'comparison-ring',type:'circle',source:'sites',filter:['>', ['get','comparisonIndex'],0],paint:{'circle-radius':13,'circle-color':'#0b1b22','circle-opacity':0.9,'circle-stroke-width':1.8,'circle-stroke-color':['match',['get','comparisonIndex'],1,'#7fcbb3',2,'#d8bb82',3,'#9db7e3','#c3a1ce']}},
          {id:'comparison-index',type:'symbol',source:'sites',filter:['>', ['get','comparisonIndex'],0],layout:{'text-field':['to-string',['get','comparisonIndex']],'text-font':['Open Sans Regular'],'text-size':11,'text-allow-overlap':true},paint:{'text-color':'#e0e9cb'}},
          {id:'selected-halo',type:'circle',source:'selected',paint:{'circle-radius':22,'circle-color':'#a2ebc5','circle-opacity':0.13}},
          {id:'selected-ring',type:'circle',source:'selected',paint:{'circle-radius':12,'circle-color':'#113f38','circle-stroke-color':'#b5f1cc','circle-stroke-width':2}},
          {id:'selected-core',type:'circle',source:'selected',paint:{'circle-radius':4,'circle-color':'#d0f6d8'}},
        ]}});
      mapRef.current=map;
      const report=()=>{const center=map.getCenter();setCamera({lng:center.lng,lat:center.lat,zoom:map.getZoom()});const b=map.getBounds();useWorkbench.getState().set({bounds:[b.getWest(),Math.max(-85,b.getSouth()),b.getEast(),Math.min(85,b.getNorth())]});};
      map.on('load',()=>{
        const small=window.innerWidth<1000;
        const view=useWorkbench.getState();map.resize();
        const initialBounds=region.counties.find(c=>c.id===view.countyId)?.bounds??region.cities.find(c=>c.id===view.cityId)?.bounds??region.bounds;
        map.fitBounds([[initialBounds[0],initialBounds[1]],[initialBounds[2],initialBounds[3]]],{padding:mapInsets(window.innerWidth,view.leftOpen,view.detailOpen,view.expanded,view.runtimeOpen&&view.businessOpen,view.selectionOpen,view.compareOpen||view.usageOpen||view.reportOpen,view.topicOpen),duration:0});
        setReady(true);report();
        region.cities.forEach(city=>{
          const label=document.createElement('button');label.type='button';label.className='mw-city-label';label.textContent=city.name;
          label.addEventListener('click',()=>useWorkbench.getState().set({cityId:city.id,countyId:'all',selectedId:null,search:''}));
          new maplibregl.Marker({element:label,anchor:'top',offset:[0,18]}).setLngLat(city.center).addTo(map);
        });
      });
      map.on('moveend',report);
      map.on('error',event=>{if(('sourceId' in event && (event.sourceId==='carto'||event.sourceId==='satellite')) || /basemaps|arcgis|fetch/i.test(event.error.message))setTileOffline(true);});
      map.on('click','site-points',event=>{const id=event.features?.[0]?.properties?.id;if(typeof id==='string')pickRef.current(id);});
      map.on('click','comparison-ring',event=>{const id=event.features?.[0]?.properties?.id;if(typeof id==='string')pickRef.current(id);});
      map.on('click','clusters',async event=>{
        const feature=event.features?.[0];if(!feature||feature.geometry.type!=='Point')return;
        try {const zoom=await (map.getSource('sites') as GeoJSONSource).getClusterExpansionZoom(feature.properties!.cluster_id);
          map.easeTo({center:feature.geometry.coordinates as [number,number],zoom:Math.min(zoom+0.3,14),duration:650,padding:mapInsets(window.innerWidth,useWorkbench.getState().leftOpen,useWorkbench.getState().detailOpen,useWorkbench.getState().expanded,useWorkbench.getState().runtimeOpen&&useWorkbench.getState().businessOpen,useWorkbench.getState().selectionOpen,useWorkbench.getState().compareOpen||useWorkbench.getState().usageOpen||useWorkbench.getState().reportOpen,useWorkbench.getState().topicOpen)});
        }catch{/* Source can be replaced while the camera is moving. */}
      });
      for(const layer of ['clusters','site-points']) {
        map.on('mouseenter',layer,()=>{map.getCanvas().style.cursor='pointer';});
        map.on('mouseleave',layer,()=>{map.getCanvas().style.cursor='';});
      }
    } catch {setFailed(true);return;}
    return ()=>{mapRef.current=null;map.remove();};
  },[region]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready)return;
    (map.getSource('sites') as GeoJSONSource|undefined)?.setData({type:'FeatureCollection',features:points.map(p=>({type:'Feature',id:p.id,geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{...p,comparisonIndex:state.compareIds.indexOf(p.id)+1}}))});
  },[ready,points,state.compareIds]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready)return;
    (map.getSource('selected') as GeoJSONSource|undefined)?.setData({type:'FeatureCollection',features:selected&&!state.compareOpen&&!state.usageOpen&&!state.reportOpen&&!state.topicOpen?[{type:'Feature',geometry:{type:'Point',coordinates:[selected.lng,selected.lat]},properties:{}}]:[]});
    if(selected&&selected.id!==firstSelection.current){
      firstSelection.current=selected.id;
      map.flyTo({center:[selected.lng,selected.lat],zoom:11.5,duration:1100,essential:false,padding:mapInsets(window.innerWidth,state.leftOpen,state.detailOpen,state.expanded,state.runtimeOpen&&state.businessOpen,state.selectionOpen,state.compareOpen||state.usageOpen||state.reportOpen,state.topicOpen)});
    }
  },[ready,selected,state.compareOpen,state.usageOpen,state.reportOpen,state.topicOpen]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready)return;
    const city=region.cities.find(c=>c.id===state.cityId),county=region.counties.find(c=>c.id===state.countyId),b=state.selection?selectionBounds(state.selection):county?.bounds??city?.bounds??region.bounds;
    map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:mapInsets(window.innerWidth,state.leftOpen,state.detailOpen,state.expanded,state.runtimeOpen&&state.businessOpen,state.selectionOpen,state.compareOpen||state.usageOpen||state.reportOpen,state.topicOpen),duration:800,essential:false});
  },[state.cityId,state.countyId,state.selection,ready,region]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready)return;
    for(const layer of ['clusters','cluster-count','cluster-halo','site-points','site-glow','comparison-ring','comparison-index'])if(map.getLayer(layer))map.setLayoutProperty(layer,'visibility',state.showSites?'visible':'none');
    for(const layer of ['district-fill','district-glow','district-lines','county-fill','county-lines','county-selected'])if(map.getLayer(layer))map.setLayoutProperty(layer,'visibility',state.showBoundaries?'visible':'none');
    if(!map.getLayer('heat'))return;
    map.setLayoutProperty('heat','visibility',state.showHeat&&!state.topicOpen?'visible':'none');
    map.getContainer().classList.toggle('mw-hide-labels',!state.showLabels);
    const color:ExpressionSpecification=state.topicOpen?['match',['get','topicLevel'],'critical','#ed8d7a','warning','#d6b57a','unknown','#74828d','normal','#60cfb2','#4c6765']:state.theme==='traffic'?['interpolate',['linear'],['get','trafficGiB'],0,'#365e78',25,'#4ea9ae',65,'#c8df9a',100,'#f0ce8d']
      :state.theme==='energy'?['case',['==',['get','energyKWh'],null],'#61737b',['interpolate',['linear'],['get','energyKWh'],1.5,'#53859b',3,'#79c3a4',5,'#e4bc7a']]
      :['match',['get','status'],'critical','#ed8d7a','warning','#d6b57a','#60cfb2'];
    map.setPaintProperty('site-points','circle-color',color);
    map.setPaintProperty('site-glow','circle-color',color);
    map.setPaintProperty('clusters','circle-color',state.topicOpen?['case',['>',['get','topicCritical'],0],'#ba6555',['>',['get','topicWarning'],0],'#9e8954',['>',['get','topicUnknown'],0],'#647780','#287c73']:['case',['>',['get','critical'],0],'#ba6555',['>',['get','warning'],0],'#9e8954','#287c73']);
    for(const layer of ['comparison-ring','comparison-index'])map.setLayoutProperty(layer,'visibility',state.showSites&&!state.topicOpen?'visible':'none');
  },[ready,state.showSites,state.showBoundaries,state.showHeat,state.showLabels,state.theme,state.topicOpen]);
  useEffect(()=>{
    if(!ready||!mapRef.current||!mapRef.current.getLayer('carto'))return;
    const map=mapRef.current;
    // Imagery is opt-in: do not register or request its source during initial load.
    if(basemap==='satellite'&&!map.getSource('satellite')){
      map.addSource('satellite',{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,attribution:'Tiles &copy; Esri & contributors'});
      map.addLayer({id:'satellite',type:'raster',source:'satellite',paint:{'raster-opacity':0.95,'raster-saturation':-0.5,'raster-brightness-max':0.59}},'district-fill');
    }
    map.setLayoutProperty('carto','visibility',basemap==='map'?'visible':'none');
    if(map.getLayer('satellite'))map.setLayoutProperty('satellite','visibility',basemap==='satellite'?'visible':'none');setTileOffline(false);
  },[ready,basemap]);
  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    const observer=new ResizeObserver(()=>map.resize());if(node.current)observer.observe(node.current);
    return ()=>observer.disconnect();
  },[ready]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready)return;
    const key=[state.leftOpen,state.detailOpen,state.expanded,state.runtimeOpen,state.businessOpen,state.selectionOpen,state.compareOpen,state.usageOpen,state.reportOpen,state.topicOpen].join(':');
    const previous=previousLayout.current;previousLayout.current=key;
    if(previous===null||previous===key)return;
    const padding=mapInsets(window.innerWidth,state.leftOpen,state.detailOpen,state.expanded,state.runtimeOpen&&state.businessOpen,state.selectionOpen,state.compareOpen||state.usageOpen||state.reportOpen,state.topicOpen);
    if(state.selectionOpen&&state.selection){const b=selectionBounds(state.selection);map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding,maxZoom:14,duration:650});return;}
    const target=stableSelected.current;
    if(state.detailOpen&&target)map.easeTo({center:[target.lng,target.lat],zoom:Math.max(map.getZoom(),10.8),padding,duration:650});
    else map.easeTo({padding,duration:450});
  },[ready,state.leftOpen,state.detailOpen,state.expanded,state.runtimeOpen,state.businessOpen,state.selectionOpen,state.compareOpen,state.usageOpen,state.reportOpen,state.topicOpen]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready||state.detailOpen||state.drawing||state.compareOpen||state.usageOpen||state.reportOpen||state.topicOpen||!state.selectedId)return;
    const site=selected??(stableSelected.current?.id===state.selectedId?stableSelected.current:null);
    if(!site)return;
    const point=points.find(p=>p.id===site.id);
    const element=document.createElement('button');element.type='button';element.className='mw-site-tip';
    const title=document.createElement('strong');title.textContent=site.name;
    const meta=document.createElement('span');meta.textContent=point?point.trafficGiB.toFixed(1)+' GiB  /  '+(point.load*100).toFixed(1)+'%':site.operators.length+' \u5bb6\u8fd0\u8425\u5546\u5171\u4eab';
    const action=document.createElement('small');action.textContent='\u67e5\u770b\u5206\u6790 \u2197';
    element.append(title,meta,action);
    element.addEventListener('click',()=>useWorkbench.getState().set({detailOpen:true}));
    const marker=new maplibregl.Marker({element,anchor:'bottom',offset:[0,-21]}).setLngLat([site.lng,site.lat]).addTo(map);
    return ()=>{marker.remove();};
  },[ready,selected,points,state.detailOpen,state.selectedId,state.drawing,state.compareOpen,state.usageOpen,state.reportOpen,state.topicOpen]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready)return;
    const source=map.getSource('counties') as GeoJSONSource|undefined;
    const city=region.cities.find(c=>c.id===state.cityId);
    // Replacing the URL lets MapLibre cancel stale city loads and retain source ownership.
    source?.setData(city?.boundaryUrl??{type:'FeatureCollection',features:[]});
  },[ready,state.cityId,region]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready||!map.getLayer('county-selected'))return;
    map.setFilter('county-selected',['==',['to-string',['get','adcode']],state.countyId]);
  },[ready,state.countyId]);
  useEffect(()=>{
    drawingAnchor.current=null;setDraft(null);setCorner(false);updateVertices([]);
    if(!state.drawing)return;
    const escape=(event:KeyboardEvent)=>{
      if(event.key==='Escape')useWorkbench.getState().cancelSelection();
      if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,button,[contenteditable=true]'))return;
      if(useWorkbench.getState().drawMode==='polygon'){
        if(event.key==='Enter'){event.preventDefault();completePolygon();}
        if(event.key==='Backspace'||event.key==='Delete'){event.preventDefault();undoVertex();}
      }
    };
    document.addEventListener('keydown',escape);
    return ()=>document.removeEventListener('keydown',escape);
  },[state.drawing,state.drawMode]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready)return;
    const b=state.drawing&&state.drawMode==='polygon'?polygonFromPoints(vertices):draft??state.selection;
    (map.getSource('selection') as GeoJSONSource|undefined)?.setData({type:'FeatureCollection',features:b?[{type:'Feature',geometry:selectionPolygon(b),properties:{}}]:[]});
  },[ready,draft,state.selection,state.drawing,state.drawMode,vertices]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready)return;
    const active=state.drawing&&state.drawMode==='polygon';
    const line=hover&&vertices.length?[...vertices,hover]:vertices;
    const features:({type:'Feature';geometry:{type:'Point';coordinates:number[]}|{type:'LineString';coordinates:number[][]};properties:{first?:boolean}})[]=[];
    if(active){
      if(line.length>1)features.push({type:'Feature',geometry:{type:'LineString',coordinates:line},properties:{}});
      vertices.forEach((p,i)=>features.push({type:'Feature',geometry:{type:'Point',coordinates:p},properties:{first:i===0}}));
    }
    (map.getSource('drawing') as GeoJSONSource|undefined)?.setData({type:'FeatureCollection',features});
  },[ready,state.drawing,state.drawMode,vertices,hover]);
  const drawCoordinate=(event:ReactPointerEvent<HTMLDivElement>):[number,number]|null=>{
    const map=mapRef.current;if(!map||!node.current)return null;
    const rect=node.current.getBoundingClientRect(),point=map.unproject([event.clientX-rect.left,event.clientY-rect.top]);
    return [point.lng,point.lat];
  };
  const drawGeometry=(a:[number,number],b:[number,number])=>state.drawMode==='circle'?circleFromPoints(a,b):rectangle(a,b);
  const drawStart=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.button!==0)return;
    event.preventDefault();const coordinate=drawCoordinate(event);if(!coordinate)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if(state.drawMode==='polygon'){drawingAnchor.current={coordinate,pixel:[event.clientX,event.clientY]};return;}
    if(!drawingAnchor.current){drawingAnchor.current={coordinate,pixel:[event.clientX,event.clientY]};setCorner(true);}
  };
  const drawMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const coordinate=drawCoordinate(event);if(!coordinate)return;
    if(state.drawMode==='polygon'){setHover(coordinate);return;}
    if(!drawingAnchor.current)return;
    setDraft(drawGeometry(drawingAnchor.current.coordinate,coordinate));setDrawError(false);
  };
  const drawEnd=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const anchor=drawingAnchor.current,coordinate=drawCoordinate(event);if(!anchor||!coordinate)return;
    if(state.drawMode==='polygon'){
      drawingAnchor.current=null;
      if(Math.hypot(event.clientX-anchor.pixel[0],event.clientY-anchor.pixel[1])>=8)return;
      const existing=polygonRef.current;
      if(existing.length>=3&&mapRef.current){
        const first=mapRef.current.project(existing[0]),last=mapRef.current.project(coordinate);
        if(Math.hypot(first.x-last.x,first.y-last.y)<12){completePolygon();return;}
      }
      if(existing.length>=POLYGON_VERTEX_LIMIT){setDrawError(true);return;}
      const point=coordinate.map(v=>Number(v.toFixed(6))) as [number,number];
      if(existing.some(p=>p[0]===point[0]&&p[1]===point[1])){setDrawError(true);return;}
      updateVertices([...existing,point]);return;
    }
    const b=drawGeometry(anchor.coordinate,coordinate);
    if(b&&Math.hypot(event.clientX-anchor.pixel[0],event.clientY-anchor.pixel[1])>=8){drawingAnchor.current=null;state.finishSelection(b);}
    else if(!b&&Math.hypot(event.clientX-anchor.pixel[0],event.clientY-anchor.pixel[1])>=8)setDrawError(true);
  };
  const selectViewport=()=>{
    const b=mapRef.current?.getBounds();if(!b)return;
    const bounds=rectangle([Math.max(-180,b.getWest()),Math.max(-85,b.getSouth())],[Math.min(180,b.getEast()),Math.min(85,b.getNorth())]);
    if(bounds)state.finishSelection(bounds);
  };
  const reset=()=>{const map=mapRef.current;if(map)map.fitBounds([[region.bounds[0],region.bounds[1]],[region.bounds[2],region.bounds[3]]],{padding:mapInsets(window.innerWidth,state.leftOpen,state.detailOpen,state.expanded,state.runtimeOpen&&state.businessOpen,state.selectionOpen,state.compareOpen||state.usageOpen||state.reportOpen,state.topicOpen),duration:850});state.set({cityId:'all',countyId:'all',selectedId:null,search:'',selection:null,selectionOpen:false,drawing:false});};
  return <div className={"mw-map-shell "+(state.drawing?"mw-drawing":"")}>
    <div ref={node} className="mw-map-canvas" aria-label={'\u9655\u897f\u7ad9\u5740\u4ea4\u4e92\u5730\u56fe'}/>
    {state.drawing&&ready&&<><div className="mw-selection-overlay" aria-label={'\u5730\u56fe\u6846\u9009\u533a\u57df'} onPointerDown={drawStart} onPointerMove={drawMove} onPointerUp={drawEnd} onPointerCancel={()=>state.cancelSelection()}/><div className="mw-draw-hint"><div className="mw-draw-modes" role="group" aria-label={'\u9009\u533a\u5f62\u72b6'}><button aria-pressed={state.drawMode==='rectangle'} onClick={()=>state.beginSelection('rectangle')}><RectangleHorizontal size={14}/>{'\u77e9\u5f62'}</button><button aria-pressed={state.drawMode==='circle'} onClick={()=>state.beginSelection('circle')}><Circle size={14}/>{'\u5706\u5f62'}</button><button aria-pressed={state.drawMode==='polygon'} onClick={()=>state.beginSelection('polygon')}><Pentagon size={14}/>{'\u591a\u8fb9\u5f62'}</button></div><span role="status">{state.drawMode==='polygon'?(drawError?'\u8303\u56f4\u65e0\u6548\uff1a3\u201432\u4e2a\u9876\u70b9\uff0c\u8bf7\u907f\u514d\u4ea4\u53c9\u6216\u91cd\u53e0':vertices.length+' / 32 \u9876\u70b9 \u00b7 \u70b9\u9996\u70b9\u6216\u5b8c\u6210\u95ed\u5408'):drawError?'\u534a\u5f84\u8303\u56f4 10 m\u2014500 km':draft&&!Array.isArray(draft)?selectionLabel(draft):state.drawMode==='circle'?(corner?'\u9009\u62e9\u534a\u5f84\u7ec8\u70b9':'\u62d6\u52a8\u753b\u5706\uff0c\u6216\u70b9\u9009\u5706\u5fc3\u4e0e\u8fb9\u7f18'):(corner?'\u9009\u62e9\u53e6\u4e00\u4e2a\u89d2\u70b9':'\u62d6\u52a8\u6846\u9009\uff0c\u6216\u70b9\u9009\u4e24\u4e2a\u89d2\u70b9')}</span>{state.drawMode==='polygon'&&<><button disabled={!vertices.length} onClick={undoVertex}>{'\u64a4\u9500'}</button><button disabled={vertices.length<3} onClick={completePolygon}>{'\u5b8c\u6210'}</button></>}{state.drawMode==='rectangle'&&<button onClick={selectViewport}>{'\u5206\u6790\u5f53\u524d\u89c6\u91ce'}</button>}<button onClick={()=>state.cancelSelection()}>{'\u53d6\u6d88'}</button></div></>}
    {failed&&<div className="mw-map-error"><Layers size={32}/><strong>{'\u5f53\u524d\u8bbe\u5907\u672a\u80fd\u521d\u59cb\u5316\u5730\u56fe'}</strong><p>{'\u4ecd\u53ef\u901a\u8fc7\u5de6\u4fa7\u5217\u8868\u4e0e\u7ad9\u70b9\u8be6\u60c5\u67e5\u770b\u5b8c\u6574\u6f14\u793a\u6570\u636e\u3002'}</p><button onClick={()=>window.location.reload()}><RefreshCw size={14}/>{'\u91cd\u65b0\u52a0\u8f7d'}</button></div>}
    {!ready&&!failed&&<div className="mw-map-loading"><span/>{'\u6b63\u5728\u6784\u5efa\u9655\u897f\u7ad9\u7f51'}</div>}
    <section ref={dockRef} className="mw-map-dock" aria-label={'\u5730\u56fe\u64cd\u4f5c\u4e0e\u5b9a\u4f4d'}>
      <div className="mw-map-toolbar"><div className="mw-map-buttons"><button title={'\u9655\u897f\u5168\u57df'} aria-label={'\u9655\u897f\u5168\u57df'} onClick={reset}><LocateFixed size={17}/></button><button title={'\u653e\u5927\u5730\u56fe'} aria-label={'\u653e\u5927\u5730\u56fe'} onClick={()=>mapRef.current?.zoomIn()}><Plus size={18}/></button><button title={'\u7f29\u5c0f\u5730\u56fe'} aria-label={'\u7f29\u5c0f\u5730\u56fe'} onClick={()=>mapRef.current?.zoomOut()}><Minus size={18}/></button><button ref={settingsButton} title={'\u5730\u56fe\u8bbe\u7f6e'} aria-label={'\u5730\u56fe\u8bbe\u7f6e'} aria-expanded={mapSettingsOpen} aria-controls="mw-map-settings" className={mapSettingsOpen?'active':''} onClick={()=>setMapSettingsOpen(!mapSettingsOpen)}><Settings2 size={17}/></button></div></div>
      {mapSettingsOpen&&<div id="mw-map-settings" className="mw-map-settings-popover" role="dialog" aria-label={'\u5730\u56fe\u8bbe\u7f6e'}><div className="mw-map-settings-heading"><span>{'\u5730\u56fe\u8bbe\u7f6e'}</span><button aria-label={'\u5173\u95ed\u5730\u56fe\u8bbe\u7f6e'} onClick={()=>{setMapSettingsOpen(false);settingsButton.current?.focus();}}><X size={13}/></button></div><div className="mw-basemap"><button aria-pressed={basemap==='map'} className={basemap==='map'?'active':''} onClick={()=>{setBasemap('map');setMapSettingsOpen(false);settingsButton.current?.focus();}}><MapIcon size={17}/>{'\u6807\u51c6'}</button><button aria-pressed={basemap==='satellite'} className={basemap==='satellite'?'active':''} onClick={()=>{setBasemap('satellite');setMapSettingsOpen(false);settingsButton.current?.focus();}}><Satellite size={17}/>{'\u536b\u661f'}</button></div><button className={'mw-map-tilt '+(tilted?'active':'')} aria-pressed={tilted} onClick={()=>{const next=!tilted;setTilted(next);mapRef.current?.easeTo({pitch:next?42:0,bearing:next?-8:0,duration:650});}}><Layers size={14}/>{'\u503e\u659c\u89c6\u89d2'}<small>{tilted?'ON':'OFF'}</small></button></div>}
      <div className="mw-map-footer">{context}<div className="mw-map-coordinates" aria-label={'\u5730\u56fe\u4e2d\u5fc3\u5750\u6807'}><span>{camera?camera.lng.toFixed(4)+' E / '+camera.lat.toFixed(4)+' N':'\u2014'}</span><small>{camera?'Z '+camera.zoom.toFixed(1):'Z \u2014'}</small></div></div>
    </section>
    {tileOffline&&<div className="mw-tile-status">{'\u5728\u7ebf\u5e95\u56fe\u6682\u4e0d\u53ef\u7528 \u00b7 \u672c\u5730\u884c\u653f\u533a\u4e0e\u7ad9\u70b9\u4ecd\u53ef\u6d4f\u89c8'}</div>}
  </div>;
}
