"use client";
import {PanelCard} from '@vxture/design-system';
import {DataUpdateProvider,DataUpdateButton,DataUpdateTime} from '../../portal/data-update';
import type {DataAvailability} from '../../domains/data-updates/rules';

export default function SourceAvailability({availability}:{availability:DataAvailability[]}){return <PanelCard title={"\u6765\u6e90\u6570\u636e\u66f4\u65b0"} icon="database"><div className="flex flex-col gap-md">{availability.map(item=><DataUpdateProvider key={item.family} availability={item}><div id={"source-"+item.family} className="flex flex-wrap items-center justify-between gap-sm scroll-mt-xl"><span>{item.sources.map(s=>s.label).join(' / ')}</span><DataUpdateTime/><DataUpdateButton/></div></DataUpdateProvider>)}</div></PanelCard>;}
