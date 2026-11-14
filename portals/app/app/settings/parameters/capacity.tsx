"use client";
import {Input} from "@vxture/design-system";

import {DEFAULT_CAPACITY_PARAMETERS,capacityParameters,readCapacityConfiguration,type CapacityParameters} from "../../domains/capacity/parameters";
import {notifyAnalysisParameters} from "../../site-analysis/parameter-refresh";
import {ParameterEditor,ParameterRow} from "./editor";
import {useParameterEditor,type ParameterEditorOptions} from "./use-parameter-editor";
const options:ParameterEditorOptions<CapacityParameters>={
 endpoint:"/api/management/capacity-parameters",defaults:DEFAULT_CAPACITY_PARAMETERS,read:readCapacityConfiguration,
 toDraft:parameters=>Object.fromEntries(Object.entries(parameters).map(([key,value])=>[key,typeof value==="boolean"?value:String(value)])),
 validate:draft=>{if(Object.entries(draft).some(([key,value])=>key!=="batteryAttention"&&(typeof value!=="string"||!value.trim())))throw Error("invalid_parameters");return capacityParameters(Object.fromEntries(Object.entries(draft).map(([key,value])=>[key,Number(value)])));},
 validationMessage:"\u8d1f\u8f7d\uff1a\u4e25\u91cd\u503c\u987b\u5927\u4e8e\u5173\u6ce8\u503c\uff1b\u63a5\u901a\uff1a\u4e25\u91cd\u503c\u987b\u5c0f\u4e8e\u5173\u6ce8\u503c\u3002\u5404\u503c\u987b\u5927\u4e8e0\u4e14\u4e0d\u8d85\u8fc7100%\u3002",savedMessage:"\u5df2\u4fdd\u5b58\uff0c\u627f\u8f7d\u80fd\u529b\u6309\u65b0\u53c2\u6570\u8ba1\u7b97\u3002",notify:()=>notifyAnalysisParameters("capacity"),
};
const rows=[{id:"load",name:"\u5bb9\u91cf\u8d1f\u8f7d\u7387",warning:"loadWarningPct",critical:"loadCriticalPct",icon:"gauge",comparison:"\u2265"},{id:"connection",name:"\u63a5\u901a\u7387",warning:"connectionWarningPct",critical:"connectionCriticalPct",icon:"phone",comparison:"<"}] as const;
export default function CapacityParametersEditor(){
 const editor=useParameterEditor(options),draft=editor.draft;
 return <ParameterEditor id="capacity-parameters" title={"\u627f\u8f7d\u80fd\u529b\u53c2\u6570"} configuration={editor.configuration} busy={editor.busy} canEdit={editor.canEdit} dirty={editor.dirty} error={editor.error} notice={editor.notice} onSave={()=>void editor.save()} onReset={editor.reset} onCancel={editor.cancel} onReload={editor.reload} description={"\u5e94\u7528\u4e8e\u5f53\u524d\u5de5\u4f5c\u533a\u7684\u627f\u8f7d\u80fd\u529b\uff0c\u4fdd\u5b58\u540e\u91cd\u65b0\u8ba1\u7b97\u3002\u53cc\u547d\u4e2d\u6307\u9ad8\u8d1f\u8f7d\u4e0e\u4f4e\u63a5\u901a\u540c\u65f6\u547d\u4e2d\uff0c\u4e0d\u53e6\u8bbe\u9608\u503c\u3002"}>
  {draft&&rows.map(row=><ParameterRow key={row.id} icon={row.icon} title={row.name} unit="%">
   <label className="flex min-w-0 flex-col gap-xs text-body"><span className="text-warning-text">{"\u5173\u6ce8 "+row.comparison}</span><Input className="h-control-xl w-full text-body" aria-label={row.name+"\u5173\u6ce8\u9608\u503c"} type="number" required min={0} max={100} step="any" value={String(draft[row.warning])} onChange={event=>editor.change(row.warning,event.target.value)}/></label>
   <label className="flex min-w-0 flex-col gap-xs text-body"><span className="text-destructive-text">{"\u4e25\u91cd "+row.comparison}</span><Input className="h-control-xl w-full text-body" aria-label={row.name+"\u4e25\u91cd\u9608\u503c"} type="number" required min={0} max={100} step="any" value={String(draft[row.critical])} onChange={event=>editor.change(row.critical,event.target.value)}/></label>
  </ParameterRow>)}
 </ParameterEditor>;
}
