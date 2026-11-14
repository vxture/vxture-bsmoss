"use client";
import type {ReactNode} from "react";
import {Button,Icon,type IconName} from "@vxture/design-system";
import ResetButton from "../../portal/reset-button";
import {formatDataTime} from "../../domains/data-updates/rules";
import SectionHeading from '../../portal/section-heading';

export function ParameterRow({icon,title,unit,children,inline=false}:{icon:IconName|ReactNode;title:string;unit?:string;children:ReactNode;inline?:boolean}) {
 return <div className="site-analysis-action-row border-b border-dashed border-border">
  <div className="flex min-w-0 flex-1 items-center gap-md"><span className="shrink-0 text-muted-foreground">{typeof icon==="string"?<Icon name={icon as IconName} size="lg"/>:icon}</span><div className="min-w-0"><p className="text-body font-medium">{title}</p>{unit&&<p className="text-body-small text-muted-foreground">{unit}</p>}</div></div>
  <div className={inline?"site-analysis-control-group shrink-0":"grid w-full min-w-0 grid-cols-2 gap-sm sm:w-auto"}>{children}</div>
 </div>;
}

export function ParameterEditor({id,title,configuration,busy,canEdit,dirty,error,notice,children,onSave,onReset,onCancel,onReload,description}:{
 id:string;title:string;configuration:{revision:number;updatedAt:string|null}|null;busy:boolean;canEdit:boolean;dirty:boolean;error:string;notice:string;children:ReactNode;
 onSave:()=>void;onReset:()=>void;onCancel:()=>void;onReload:()=>void;description:ReactNode;
}) {
 return <section id={id} aria-label={title} className="flex min-w-0 flex-col gap-md text-foreground" aria-busy={busy}>
  <div className="site-analysis-action-row"><SectionHeading title={title}/>{configuration&&<span className="text-body-small text-muted-foreground">{"r"+configuration.revision+" \u00b7 "+(configuration.updatedAt?formatDataTime(configuration.updatedAt):"\u9ed8\u8ba4\u53c2\u6570")}</span>}</div>
  {!configuration&&!error&&<p role="status" className="text-body-small text-muted-foreground">{"\u6b63\u5728\u8bfb\u53d6\u53c2\u6570\u2026"}</p>}
  {configuration&&<form className="flex min-w-0 flex-col gap-md" onSubmit={event=>{event.preventDefault();onSave();}}>
   <fieldset disabled={!canEdit||busy} className="flex min-w-0 flex-col">{children}</fieldset>
   <div className="site-analysis-action-row"><ResetButton label={"\u6062\u590d\u9ed8\u8ba4\u53c2\u6570"} disabled={!canEdit||busy} onClick={onReset}/><div className="site-analysis-control-group">
    <Button type="button" variant="outline" className="h-control-xl text-body" disabled={!dirty||busy} onClick={onCancel}>{"\u53d6\u6d88\u4fee\u6539"}</Button>
    <Button type="submit" className="h-control-xl text-body" disabled={!dirty||!canEdit||busy}><Icon name="check" size="sm"/>{busy?"\u6b63\u5728\u4fdd\u5b58":"\u4fdd\u5b58\u53c2\u6570"}</Button>
   </div></div>
   {!canEdit&&!error&&<p className="text-body-small text-muted-foreground">{"\u5f53\u524d\u53ea\u8bfb\uff0c\u7f16\u8f91\u9700\u8981\u53c2\u6570\u7ef4\u62a4\u6743\u9650\u3002"}</p>}
  </form>}
  {error&&<div role="alert" className="flex flex-wrap items-center gap-sm text-body-small text-destructive"><span>{error}</span><Button type="button" variant="outline" className="h-control-xl text-body" disabled={busy} onClick={onReload}>{"\u91cd\u65b0\u52a0\u8f7d"}</Button></div>}
  {notice&&<p role="status" className="text-body-small text-primary">{notice}</p>}
  <div className="border-t border-dashed border-border pt-md text-body-small text-muted-foreground">{description}</div>
 </section>;
}
