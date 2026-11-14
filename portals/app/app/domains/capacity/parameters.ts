import {TOPIC_THRESHOLDS as T} from "../business-parameters/policies";
export interface CapacityParameters {loadWarningPct:number;loadCriticalPct:number;connectionWarningPct:number;connectionCriticalPct:number}
export interface CapacityConfiguration {revision:number;parameters:CapacityParameters;updatedAt:string|null;updatedBy:string|null}
export const DEFAULT_CAPACITY_PARAMETERS:Readonly<CapacityParameters>=Object.freeze({loadWarningPct:T.loadWarningPct,loadCriticalPct:T.loadCriticalPct,connectionWarningPct:T.connectionWarningPct,connectionCriticalPct:T.connectionCriticalPct});
const keys=Object.keys(DEFAULT_CAPACITY_PARAMETERS);
export function capacityParameters(raw:unknown):CapacityParameters{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("invalid_capacity_parameters");
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k)))throw Error("invalid_capacity_parameters");
 for(const k of keys)if(typeof v[k]!=="number"||!Number.isFinite(v[k])||Number(v[k])<=0||Number(v[k])>100)throw Error("invalid_capacity_parameters");
 const p=v as unknown as CapacityParameters;
 if(p.loadWarningPct>=p.loadCriticalPct||p.connectionCriticalPct>=p.connectionWarningPct)throw Error("invalid_capacity_threshold_order");
 return {...p};
}
export function defaultCapacityConfiguration():CapacityConfiguration{return {revision:0,parameters:{...DEFAULT_CAPACITY_PARAMETERS},updatedAt:null,updatedBy:null};}
export function readCapacityConfiguration(raw:unknown):CapacityConfiguration{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("invalid_capacity_configuration");
 const v=raw as CapacityConfiguration;
 if(!Number.isSafeInteger(v.revision)||v.revision<0||!(v.updatedAt===null||typeof v.updatedAt==="string"&&Number.isFinite(Date.parse(v.updatedAt)))||!(v.updatedBy===null||typeof v.updatedBy==="string"&&!!v.updatedBy))throw Error("invalid_capacity_configuration");
 return {revision:v.revision,parameters:capacityParameters(v.parameters),updatedAt:v.updatedAt,updatedBy:v.updatedBy};
}
export function capacityCommand(raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("invalid_capacity_command");
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).length!==2||!Object.hasOwn(v,"revision")||!Object.hasOwn(v,"parameters")||!Number.isSafeInteger(v.revision)||Number(v.revision)<0)throw Error("invalid_capacity_command");
 return {revision:Number(v.revision),parameters:capacityParameters(v.parameters)};
}
export const capacityConfigurationPolicy=(configuration:CapacityConfiguration)=>"capacity-parameters-v1/r"+configuration.revision;
export function capacityMetricLevel(value:number|null,metric:"load"|"connection",parameters:CapacityParameters=DEFAULT_CAPACITY_PARAMETERS){
 if(value===null)return "unknown";
 return metric==="load"?(value>=parameters.loadCriticalPct/100?"critical":value>=parameters.loadWarningPct/100?"warning":"normal"):
  value<parameters.connectionCriticalPct/100?"critical":value<parameters.connectionWarningPct/100?"warning":"normal";
}
