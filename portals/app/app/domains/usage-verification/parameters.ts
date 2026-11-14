import {WAVE_POLICY} from '../business-parameters/policies';
export interface VerificationParameters {relativeBps:number;minimumBytes:string;minimumVoiceSeconds:string;minimumSms:string}
export interface VerificationConfiguration {revision:number;parameters:VerificationParameters;updatedAt:string|null;updatedBy:string|null}
export const DEFAULT_VERIFICATION_PARAMETERS:Readonly<VerificationParameters>=Object.freeze({relativeBps:WAVE_POLICY.relativeBps,minimumBytes:WAVE_POLICY.minimum.bytes,minimumVoiceSeconds:WAVE_POLICY.minimum.voiceSeconds,minimumSms:WAVE_POLICY.minimum.sms});
export function verificationParameters(raw:unknown):VerificationParameters{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('invalid_verification_parameters');const v=raw as Record<string,unknown>,keys=Object.keys(DEFAULT_VERIFICATION_PARAMETERS);
 if(Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k))||!Number.isSafeInteger(v.relativeBps)||Number(v.relativeBps)<1||Number(v.relativeBps)>10000)throw Error('invalid_verification_parameters');
 for(const k of keys.filter(k=>k!=='relativeBps'))if(typeof v[k]!=='string'||!/^[1-9][0-9]{0,29}$/.test(v[k] as string))throw Error('invalid_verification_parameters');
 return {relativeBps:Number(v.relativeBps),minimumBytes:v.minimumBytes as string,minimumVoiceSeconds:v.minimumVoiceSeconds as string,minimumSms:v.minimumSms as string};
}
export function defaultVerificationConfiguration():VerificationConfiguration{return {revision:0,parameters:{...DEFAULT_VERIFICATION_PARAMETERS},updatedAt:null,updatedBy:null};}
export function readVerificationConfiguration(raw:unknown):VerificationConfiguration{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('invalid_verification_configuration');const v=raw as VerificationConfiguration;
 if(!Number.isSafeInteger(v.revision)||v.revision<0||!(v.updatedAt===null||typeof v.updatedAt==='string'&&Number.isFinite(Date.parse(v.updatedAt)))||!(v.updatedBy===null||typeof v.updatedBy==='string'&&!!v.updatedBy))throw Error('invalid_verification_configuration');
 return {revision:v.revision,parameters:verificationParameters(v.parameters),updatedAt:v.updatedAt,updatedBy:v.updatedBy};
}
export function verificationCommand(raw:unknown){if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('invalid_verification_command');const v=raw as Record<string,unknown>;
 if(Object.keys(v).length!==2||!Object.hasOwn(v,'revision')||!Object.hasOwn(v,'parameters')||!Number.isSafeInteger(v.revision)||Number(v.revision)<0)throw Error('invalid_verification_command');return {revision:Number(v.revision),parameters:verificationParameters(v.parameters)};}
export const verificationMinimum=(p:VerificationParameters,metric:'bytes'|'voiceSeconds'|'sms')=>metric==='bytes'?p.minimumBytes:metric==='voiceSeconds'?p.minimumVoiceSeconds:p.minimumSms;
