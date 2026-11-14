"use client";
import AnalysisParameterRefresh,{notifyAnalysisParameters} from "../site-analysis/parameter-refresh";
export const MONITORING_PARAMETER_EVENT="bsmoss-monitoring-parameters-changed";
export function notifyMonitoringParameters(){notifyAnalysisParameters("monitoring");}
export default function MonitoringParameterRefresh({revision}:{revision:number}){return <AnalysisParameterRefresh kind="monitoring" revision={revision}/>;}
