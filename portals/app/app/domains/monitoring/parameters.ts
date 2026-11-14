import {TOPIC_THRESHOLDS as T} from "../business-parameters/policies";
export interface MonitoringParameters {batteryAttention:boolean;temperatureWarningC:number;temperatureCriticalC:number;intensityWarning:number;intensityCritical:number}
export interface MonitoringConfiguration {revision:number;parameters:MonitoringParameters;updatedAt:string|null;updatedBy:string|null}
export const DEFAULT_MONITORING_PARAMETERS:Readonly<MonitoringParameters>=Object.freeze({batteryAttention:true,temperatureWarningC:T.temperatureWarningC,temperatureCriticalC:T.temperatureCriticalC,intensityWarning:T.intensityWarning,intensityCritical:T.intensityCritical});
const keys=Object.keys(DEFAULT_MONITORING_PARAMETERS);
export function monitoringParameters(raw:unknown):MonitoringParameters{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("invalid_monitoring_parameters");
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k))||typeof v.batteryAttention!=="boolean")throw Error("invalid_monitoring_parameters");
 for(const k of keys.filter(k=>k!=="batteryAttention"))if(typeof v[k]!=="number"||!Number.isFinite(v[k]))throw Error("invalid_monitoring_parameters");
 const p=v as unknown as MonitoringParameters;
 if(p.temperatureWarningC< -273.15||p.temperatureCriticalC>1000||p.temperatureWarningC>=p.temperatureCriticalC||p.intensityWarning<=0||p.intensityCritical>1000000||p.intensityWarning>=p.intensityCritical)throw Error("invalid_monitoring_threshold_order");
 return {...p};
}
export function defaultMonitoringConfiguration():MonitoringConfiguration{return {revision:0,parameters:{...DEFAULT_MONITORING_PARAMETERS},updatedAt:null,updatedBy:null};}
export function readMonitoringConfiguration(raw:unknown):MonitoringConfiguration{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("invalid_monitoring_configuration");
 const v=raw as MonitoringConfiguration;
 if(!Number.isSafeInteger(v.revision)||v.revision<0||!(v.updatedAt===null||typeof v.updatedAt==="string"&&Number.isFinite(Date.parse(v.updatedAt)))||!(v.updatedBy===null||typeof v.updatedBy==="string"&&!!v.updatedBy))throw Error("invalid_monitoring_configuration");
 return {revision:v.revision,parameters:monitoringParameters(v.parameters),updatedAt:v.updatedAt,updatedBy:v.updatedBy};
}
export function monitoringCommand(raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("invalid_monitoring_command");
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).length!==2||!Object.hasOwn(v,"revision")||!Object.hasOwn(v,"parameters")||!Number.isSafeInteger(v.revision)||Number(v.revision)<0)throw Error("invalid_monitoring_command");
 return {revision:Number(v.revision),parameters:monitoringParameters(v.parameters)};
}
export const monitoringConfigurationPolicy=(configuration:MonitoringConfiguration)=>"monitoring-parameters-v1/r"+configuration.revision;
