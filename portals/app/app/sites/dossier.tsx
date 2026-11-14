"use client";
import {useEffect,useRef,useState} from "react";
import {Button,DetailList,DetailRow,Icon,PanelCard} from "@vxture/design-system";
import type {AssetDetail} from "../domains/site-registry/asset-model";
import type {SiteQuery} from "../domains/site-registry/rules";
import {siteListHref} from "../domains/site-registry/rules";
import {formatDataTime} from "../domains/data-updates/rules";
import PageHeading from "../portal/page-heading";
import OperatorIdentity from "../portal/operator-identity";
import {InvestigationReturn,useInvestigationLinks} from "../portal/investigation";
import AssetMaintenance from "./maintenance";
import ResourceRelationships from "./resource-relationships";
import {siteTypeNames,sceneNames} from "./labels";
import "../site-analysis/site-analysis.css";
export function AssetSourceInfo({source}:{source:AssetDetail["source"]}){
 return <DetailList>
  <DetailRow label={"\u8d44\u6599\u6765\u6e90"}>{source.name}</DetailRow><DetailRow label={"\u6765\u6e90\u7248\u672c"}>{source.version}</DetailRow>
  <DetailRow label={"\u8d44\u6599\u66f4\u65b0\u81f3"}>{formatDataTime(source.through)}</DetailRow>
  <DetailRow label={"\u4e3b\u6570\u636e\u540c\u6b65"}>{"\u63a5\u53e3\u5f85\u63a5\u5165"}</DetailRow><DetailRow label={"\u5b57\u6bb5\u6620\u5c04"}>{"\u5f85\u63a5\u5165"}</DetailRow>
  <DetailRow label={"\u6700\u8fd1\u540c\u6b65"}>{formatDataTime(source.syncedAt)}</DetailRow>
 </DetailList>;
}
export function SiteDetailContent({data,compact=false,initialSection="overview",initialEdit=false}:{data:AssetDetail;compact?:boolean;initialSection?:"overview"|"devices";initialEdit?:boolean}){
 const s=data.site,[catalog,setCatalog]=useState(data.maintenance),[selected,setSelected]=useState(""),maintenanceRef=useRef<HTMLDivElement>(null),devicesRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(initialEdit)maintenanceRef.current?.scrollIntoView({block:"start"});else if(initialSection==="devices")devicesRef.current?.scrollIntoView({block:"start"});},[initialEdit,initialSection]);
 const device=data.devices.find(d=>d.id===selected);
 return <div className="flex min-w-0 flex-col gap-lg">
  <section className="flex min-w-0 flex-col gap-md" aria-label={"\u7ad9\u5740\u6765\u6e90\u8d44\u6599"}>
   <h3 className="text-label font-semibold">{"\u7ad9\u5740\u8d44\u6599"}</h3>
   <DetailList columns={compact?1:2}>
    <DetailRow label={"\u6765\u6e90\u540d\u79f0"}>{s.name}</DetailRow><DetailRow label={"\u7ad9\u5740\u7f16\u7801"}>{s.id}</DetailRow>
    <DetailRow label={"\u8d44\u4ea7\u7f16\u7801"}>{s.assetCode}</DetailRow><DetailRow label={"\u6240\u5c5e\u533a\u57df"}>{s.cityName+" / "+s.countyName}</DetailRow>
    <DetailRow label={"\u7ad9\u70b9\u7c7b\u578b"}>{siteTypeNames[s.siteType]}</DetailRow><DetailRow label={"\u4e1a\u52a1\u573a\u666f"}>{sceneNames[s.profile]}</DetailRow>
    <DetailRow label={"\u8be6\u7ec6\u5730\u5740"}>{s.address}</DetailRow><DetailRow label={"\u7ecf\u7eac\u5ea6"}>{s.lng+", "+s.lat}</DetailRow>
    <DetailRow label={"\u5854\u578b / \u9ad8\u5ea6"}>{s.towerType+" / "+s.heightMeters+" m"}</DetailRow><DetailRow label={"\u673a\u623f\u7c7b\u578b"}>{s.roomType}</DetailRow>
   </DetailList>
   <div className="flex flex-wrap items-center gap-sm text-body-small text-muted-foreground"><span>{"\u5165\u9a7b\u8fd0\u8425\u5546"}</span>{s.operators.map(code=><OperatorIdentity key={code} code={code}/>)}</div>
  </section>
  <section className="flex min-w-0 flex-col gap-md border-t border-border pt-lg" id="site-resources" ref={devicesRef}>
   <h3 className="text-label font-semibold">{"\u5173\u8054\u8bbe\u5907 \u00b7 "+data.devices.length}</h3>
   <ResourceRelationships devices={data.devices} onSelect={next=>setSelected(prev=>prev===next.id?"":next.id)}/>
   {device&&<section className="flex min-w-0 flex-col gap-md rounded-md border border-border p-md" data-selected-device={device.id}>
    <div className="flex items-center justify-between gap-sm"><h4 className="text-label font-semibold">{device.name}</h4><Button variant="ghost" className="h-control-xl text-body" onClick={()=>setSelected("")} aria-label={"\u5173\u95ed\u8bbe\u5907\u8d44\u6599"}><Icon name="x" size="sm"/></Button></div>
    <DetailList columns={compact?1:2}><DetailRow label={"\u8bbe\u5907\u7f16\u7801"}>{device.id}</DetailRow><DetailRow label={"\u8bbe\u5907\u7c7b\u522b"}>{device.categoryName}</DetailRow><DetailRow label={"\u5f52\u5c5e\u4e3b\u4f53"}><OperatorIdentity code={device.owner}/></DetailRow><DetailRow label={"\u89c4\u683c"}>{device.spec}</DetailRow><DetailRow label={"\u6240\u5c5e\u7ad9\u5740"}>{s.name+" \u00b7 "+s.id}</DetailRow></DetailList>
    <AssetMaintenance key={device.id} kind="device" id={device.id} siteId={s.id} catalog={catalog} canMaintain={data.canMaintain} onChange={setCatalog}/>
   </section>}
  </section>
  <div ref={maintenanceRef} className="border-t border-border pt-lg"><AssetMaintenance kind="site" id={s.id} siteId={s.id} catalog={catalog} canMaintain={data.canMaintain} onChange={setCatalog} initialEdit={initialEdit}/></div>
  <section className="flex min-w-0 flex-col gap-md border-t border-border pt-lg" id="site-sources"><h3 className="text-label font-semibold">{"\u540c\u6b65\u4e0e\u6765\u6e90"}</h3><AssetSourceInfo source={data.source}/></section>
 </div>;
}
export default function SiteDossier({data,query}:{data:AssetDetail;query:SiteQuery}){
 const {keep}=useInvestigationLinks(siteListHref(query));
 return <div className="site-analysis-page product-page-inset flex min-w-0 flex-col gap-lg" data-site-dossier-mode="demo">
  <PageHeading icon="building" title={data.site.name} description={data.site.id+" \u00b7 "+data.site.cityName+" / "+data.site.countyName} navigation={<Button asChild variant="ghost" className="h-control-xl text-body"><a href={keep(siteListHref(query))}><Icon name="arrow-left" size="sm"/>{"\u7ad9\u5740\u7ba1\u7406"}</a></Button>} context={<span>{"\u8d44\u6599\u66f4\u65b0\u81f3 "}<time dateTime={data.source.through??undefined}>{formatDataTime(data.source.through)}</time></span>}/>
  <InvestigationReturn source="snapshot"/>
  <PanelCard title={"\u7ad9\u5740\u6863\u6848"} icon="building"><SiteDetailContent data={data}/></PanelCard>
 </div>;
}
