"use client";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Icon, InputGroup, InputGroupAddon, InputGroupInput, PanelCard, SegmentedControl, ShellPageContainer } from "@vxture/design-system";
import PageHeading from "../portal/page-heading";
import ResetButton from "../portal/reset-button";
import { configurationSections, type ConfigurationArea } from "./configuration-sections";
import "../site-analysis/site-analysis.css";
import "../portal/pagination.css";

// Business composition only: all controls, surfaces and spacing use DS15 and
// the existing site-analysis baseline. Cursor pages never invent a total.
export function ConfigurationFrame({ area, view, children, tools, footer, context }: { area: ConfigurationArea; view: string; children: ReactNode; tools?: ReactNode; footer?: ReactNode; context?: ReactNode }) {
  const router = useRouter(), section = configurationSections[area], current = section.items.find(item => item.value === view)!;
  return <ShellPageContainer className="site-analysis-page gap-lg">
    <PageHeading icon={section.icon} title={section.title} description={section.description} context={context}/>
    <PanelCard className="site-analysis-table-panel text-foreground" title={current.label} icon={current.icon}>
      <div className="site-analysis-table-tools site-analysis-table-tools-single-line site-analysis-action-row">
        <div className="site-analysis-table-filters"><div className="site-analysis-occupancy-scroll">
          <SegmentedControl size="md" className={"site-analysis-occupancy site-analysis-occupancy-auto " + (section.items.length === 3 ? "[--analysis-facet-columns:3]" : "[--analysis-facet-columns:2]")} ariaLabel={section.title} value={view} onChange={value => router.push(section.path + "?view=" + value, {scroll:false})} items={section.items.map(item => ({value:item.value,label:<span className="site-analysis-occupancy-label"><Icon name={item.icon} size="sm"/>{item.label}</span>}))}/>
        </div></div>
        {tools}
      </div>
      {children}
      {footer}
    </PanelCard>
  </ShellPageContainer>;
}

export function ConfigurationSearch({ value, onChange, filters, onReset, actions, label = "\u641c\u7d22\u540d\u79f0\uff0f\u7f16\u7801" }: { value: string; onChange(value: string): void; filters?: ReactNode; onReset(): void; actions?: ReactNode; label?: string }) {
  const [draft,setDraft]=useState(value), composing=useRef(false);
  useEffect(()=>setDraft(value),[value]);
  return <form className="site-analysis-search flex items-center gap-xs" role="search" onSubmit={event=>{event.preventDefault();if(!composing.current)onChange(draft);}}>
    <InputGroup className="site-analysis-search-field"><InputGroupAddon><Icon name="search" size="sm"/></InputGroupAddon><InputGroupInput aria-label={label} placeholder={label} maxLength={100} value={draft} onChange={event=>{setDraft(event.target.value);if(!composing.current)onChange(event.target.value);}} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={event=>{composing.current=false;onChange(event.currentTarget.value);}}/></InputGroup>
    {filters}<ResetButton variant="outline" label={"\u91cd\u7f6e\u7b5b\u9009\u4e0e\u67e5\u8be2"} onClick={()=>{setDraft("");onReset();}}/>{actions}
  </form>;
}

export function ConfigurationDetail({ open, onClose, title, description, children }: { open:boolean; onClose():void; title:ReactNode; description?:ReactNode; children:ReactNode }) {
  return <Dialog modal={false} open={open} onOpenChange={value=>{if(!value)onClose();}}><DialogContent className="site-analysis-detail" width="sm" onOpenAutoFocus={event=>event.preventDefault()} onInteractOutside={event=>{if(event.target instanceof Element&&event.target.closest(".site-analysis-table tbody > tr"))event.preventDefault();}}>
    <div className="pr-xl"><DialogTitle>{title}</DialogTitle><DialogDescription>{description ?? "\u914d\u7f6e\u8be6\u60c5"}</DialogDescription></div>{children}
  </DialogContent></Dialog>;
}

export function ConfigurationCursorPager({ previous, next, busy, onPrevious, onNext }: {previous:boolean;next:boolean;busy:boolean;onPrevious():void;onNext():void}) {
  return <nav aria-label={"\u914d\u7f6e\u5217\u8868\u5206\u9875"} className="site-analysis-action-row">
    <span className="text-body-small text-muted-foreground">{"\u6bcf\u9875\u6700\u591a 20 \u6761"}</span><div className="flex items-center gap-xs">
      <Button className="h-control-xl text-body" variant="outline" disabled={!previous||busy} onClick={onPrevious}><Icon name="chevron-left" size="sm"/>{"\u4e0a\u4e00\u9875"}</Button>
      <Button className="h-control-xl text-body" variant="outline" disabled={!next||busy} onClick={onNext}>{"\u4e0b\u4e00\u9875"}<Icon name="chevron-right" size="sm"/></Button>
    </div>
  </nav>;
}

export function ConfigurationReload({onClick,disabled}:{onClick():void;disabled?:boolean}) {
  return <Button type="button" variant="outline" className="h-control-xl shrink-0 text-body" aria-label={"\u91cd\u65b0\u8bfb\u53d6"} title={"\u91cd\u65b0\u8bfb\u53d6"} onClick={onClick} disabled={disabled}><Icon name="refresh" size="sm"/>{"\u91cd\u65b0\u8bfb\u53d6"}</Button>;
}

export function configurationRowClick<T>(rows:readonly T[],open:(row:T)=>void) {
  return (event:MouseEvent)=>{const target=event.target as HTMLElement;if(target.closest("button,a,input,select,[role='menuitem']"))return;const row=target.closest("tbody > tr");if(!row)return;const entry=rows[Array.from(row.parentElement!.children).indexOf(row)];if(entry)open(entry);};
}

export const configurationTime=(value:string)=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(value));
