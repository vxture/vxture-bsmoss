"use client";
import {PanelCard} from '@vxture/design-system';
import {DataUpdateProvider,DataUpdateButton,DataUpdateTime} from '../../portal/data-update';
import {previewAvailability} from '../../domains/data-updates/preview';
import {UPDATE_FAMILIES} from '../../domains/data-updates/rules';
export default function SourceAvailability(){return <PanelCard title={"\u6765\u6e90\u6570\u636e\u66f4\u65b0"} icon="database"><div className="flex flex-col gap-md">{UPDATE_FAMILIES.map(family=><DataUpdateProvider key={family} availability={previewAvailability(family)}><div id={"source-"+family} className="flex flex-wrap items-center justify-between gap-sm scroll-mt-xl"><span>{previewAvailability(family).sources.map(s=>s.label).join(' / ')}</span><DataUpdateTime/><DataUpdateButton/></div></DataUpdateProvider>)}</div></PanelCard>;}
