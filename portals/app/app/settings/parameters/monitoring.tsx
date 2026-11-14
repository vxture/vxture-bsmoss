"use client";
import {Input,Switch} from "@vxture/design-system";
import {BatteryVerticalFullIcon,ThermometerIcon,LightningIcon} from "@phosphor-icons/react";
import {DEFAULT_MONITORING_PARAMETERS,monitoringParameters,readMonitoringConfiguration,type MonitoringParameters} from "../../domains/monitoring/parameters";
import {notifyMonitoringParameters} from "../../monitoring/parameter-refresh";
import {ParameterEditor,ParameterRow} from "./editor";
import {useParameterEditor,type ParameterEditorOptions} from "./use-parameter-editor";
const options:ParameterEditorOptions<MonitoringParameters>={
 endpoint:"/api/management/monitoring-parameters",defaults:DEFAULT_MONITORING_PARAMETERS,read:readMonitoringConfiguration,
 toDraft:parameters=>Object.fromEntries(Object.entries(parameters).map(([key,value])=>[key,typeof value==="boolean"?value:String(value)])),
 validate:draft=>{if(Object.entries(draft).some(([key,value])=>key!=="batteryAttention"&&(typeof value!=="string"||!value.trim())))throw Error("invalid_parameters");return monitoringParameters({batteryAttention:draft.batteryAttention,...Object.fromEntries(Object.entries(draft).filter(([key])=>key!=="batteryAttention").map(([key,value])=>[key,Number(value)]))});},
 validationMessage:"\u8bf7\u5b8c\u6574\u586b\u5199\u9608\u503c\uff1b\u4e25\u91cd\u503c\u987b\u5927\u4e8e\u5173\u6ce8\u503c\uff0c\u80fd\u8017\u5f3a\u5ea6\u987b\u5927\u4e8e0\u3002",savedMessage:"\u5df2\u4fdd\u5b58\uff0c\u8fd0\u884c\u76d1\u6d4b\u4e0e\u8fd0\u884c\u80fd\u6548\u6309\u65b0\u53c2\u6570\u8ba1\u7b97\u3002",notify:notifyMonitoringParameters,
};
const parameterRows=[{id:"temperature",name:"\u6e29\u5ea6\u504f\u9ad8",unit:"\u00b0C",warning:"temperatureWarningC",critical:"temperatureCriticalC",icon:ThermometerIcon,min:-273.15,max:1000,step:"any"},{id:"intensity",name:"\u80fd\u8017\u5f3a\u5ea6\u504f\u9ad8",unit:"kWh/GiB",warning:"intensityWarning",critical:"intensityCritical",icon:LightningIcon,min:0.000001,max:1000000,step:"any"}] as const;
export default function MonitoringParametersEditor(){
 const editor=useParameterEditor(options),draft=editor.draft;
 return <ParameterEditor id="monitoring-parameters" title={"\u8fd0\u884c\u76d1\u6d4b\u53c2\u6570"} configuration={editor.configuration} busy={editor.busy} canEdit={editor.canEdit} dirty={editor.dirty} error={editor.error} notice={editor.notice} onSave={()=>void editor.save()} onReset={editor.reset} onCancel={editor.cancel} onReload={editor.reload} description={"\u5e94\u7528\u4e8e\u5f53\u524d\u5de5\u4f5c\u533a\u7684\u8fd0\u884c\u76d1\u6d4b\u4e0e\u8fd0\u884c\u80fd\u6548\uff0c\u4fdd\u5b58\u540e\u91cd\u65b0\u8ba1\u7b97\u3002"}>
  {draft&&<ParameterRow inline icon={<BatteryVerticalFullIcon className="size-control-md" aria-hidden="true"/>} title={"\u84c4\u7535\u6c60\u4f9b\u7535"} unit={"\u68c0\u6d4b\u5230\u84c4\u7535\u6c60\u4f9b\u7535\u65f6\u6807\u8bb0\u4e3a\u5173\u6ce8"}><div className="col-span-2 flex justify-end"><Switch aria-label={"\u84c4\u7535\u6c60\u4f9b\u7535\u5173\u6ce8"} checked={draft.batteryAttention===true} onCheckedChange={value=>editor.change("batteryAttention",value)}/></div></ParameterRow>}
  {draft&&parameterRows.map(row=><ParameterRow key={row.id} icon={<row.icon className="size-control-md" aria-hidden="true"/>} title={row.name} unit={row.unit}>
   <label className="flex min-w-0 flex-col gap-xs text-body"><span className="text-warning-text">{"\u5173\u6ce8 \u2265"}</span><Input className="h-control-xl w-full text-body" aria-label={row.name+"\u5173\u6ce8\u9608\u503c"} type="number" required min={row.min} max={row.max} step={row.step} value={String(draft[row.warning])} onChange={event=>editor.change(row.warning,event.target.value)}/></label>
   <label className="flex min-w-0 flex-col gap-xs text-body"><span className="text-destructive-text">{"\u4e25\u91cd \u2265"}</span><Input className="h-control-xl w-full text-body" aria-label={row.name+"\u4e25\u91cd\u9608\u503c"} type="number" required min={row.min} max={row.max} step={row.step} value={String(draft[row.critical])} onChange={event=>editor.change(row.critical,event.target.value)}/></label>
  </ParameterRow>)}
 </ParameterEditor>;
}
