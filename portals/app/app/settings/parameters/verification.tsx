"use client";
import {Input} from "@vxture/design-system";

import {DEFAULT_VERIFICATION_PARAMETERS,verificationParameters,readVerificationConfiguration,type VerificationParameters} from "../../domains/usage-verification/parameters";
import {notifyAnalysisParameters} from "../../site-analysis/parameter-refresh";
import {ParameterEditor,ParameterRow} from "./editor";
import {useParameterEditor,type ParameterEditorOptions} from "./use-parameter-editor";
const options:ParameterEditorOptions<VerificationParameters>={
 endpoint:"/api/management/verification-parameters",defaults:DEFAULT_VERIFICATION_PARAMETERS,read:readVerificationConfiguration,
 toDraft:parameters=>Object.fromEntries(Object.entries(parameters).map(([key,value])=>[key,typeof value==="boolean"?value:String(value)])),
 validate:draft=>{if(Object.values(draft).some(value=>typeof value!=="string"||!/^[1-9][0-9]{0,29}$/.test(value)))throw Error("invalid_parameters");return verificationParameters({...draft,relativeBps:Number(draft.relativeBps)});},
 validationMessage:"\u8bf7\u8f93\u5165\u6b63\u6574\u6570\uff1b\u76f8\u5bf9\u504f\u79bb\u4e0d\u8d85\u8fc710,000\u57fa\u70b9\uff0c\u7edd\u5bf9\u95e8\u69db\u4e0d\u8d85\u8fc730\u4f4d\u6574\u6570\u3002",savedMessage:"\u5df2\u4fdd\u5b58\uff0c\u6e05\u5355\u6309\u65b0\u89c4\u5219\u5224\u5b9a\uff0c\u5386\u53f2\u8bb0\u5f55\u4fdd\u7559\u539f\u4f9d\u636e\u3002",notify:()=>notifyAnalysisParameters("verification"),
};
const fields=[{key:'relativeBps',label:'\u76f8\u5bf9\u504f\u79bb',unit:'\u57fa\u70b9\uff08100 \u57fa\u70b9 = 1%\uff09',icon:'chart-line-up',max:10000},{key:'minimumBytes',label:'\u6d41\u91cf\u53d8\u5316',unit:'\u5b57\u8282\uff081 GiB = 1,073,741,824 \u5b57\u8282\uff09',icon:'database'},{key:'minimumVoiceSeconds',label:'\u901a\u8bdd\u65f6\u957f\u53d8\u5316',unit:'\u79d2',icon:'phone'},{key:'minimumSms',label:'\u77ed\u4fe1\u53d8\u5316',unit:'\u6761',icon:'chat-circle'}] as const;
export default function VerificationParametersEditor(){
 const editor=useParameterEditor(options),draft=editor.draft;
 return <ParameterEditor id="verification-parameters" title={"\u7528\u91cf\u6838\u9a8c\u53c2\u6570"} configuration={editor.configuration} busy={editor.busy} canEdit={editor.canEdit} dirty={editor.dirty} error={editor.error} notice={editor.notice} onSave={()=>void editor.save()} onReset={editor.reset} onCancel={editor.cancel} onReload={editor.reload} description={"\u7a81\u589e\u3001\u7a81\u964d\u9700\u540c\u65f6\u8fbe\u5230\u76f8\u5bf9\u4e0e\u5bf9\u5e94\u7edd\u5bf9\u95e8\u69db\uff0c\u7b49\u4e8e\u95e8\u69db\u65f6\u547d\u4e2d\u3002\u57fa\u7ebf\u56fa\u5b9a\u524d4\u5468\u540c\u661f\u671f\u540c\u65f6\u69fd\u3001\u81f3\u5c113\u4e2a\u6709\u6548\u6837\u672c\uff1b\u6301\u7eed\u96f6\u91cf\u56fa\u5b9a\u8fde\u7eed3\u4e2a\u6709\u6548\u5c0f\u65f6\u3002\u9884\u89c8\u53c2\u6570\u4ec5\u4f5c\u7528\u4e8e\u72ec\u7acb\u6838\u9a8c\u573a\u666f\uff0c\u5386\u53f2\u8bb0\u5f55\u4e0e\u5df2\u4fdd\u5b58\u62a5\u544a\u4fdd\u7559\u539f\u4f9d\u636e\u3002"}>
  {draft&&fields.map(field=><ParameterRow key={field.key} icon={field.icon} title={field.label} unit={field.unit}>
   <Input className="col-span-2 h-control-xl w-full text-body" type="text" inputMode="numeric" required aria-label={field.label+"\u9608\u503c"} value={String(draft[field.key])} onChange={event=>editor.change(field.key,event.target.value)}/>
  </ParameterRow>)}
 </ParameterEditor>;
}
