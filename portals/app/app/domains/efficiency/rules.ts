import {GIB} from '../map-demo/rules';
import type {RuntimeSample} from '../map-demo/runtime-rules';
import type {MonitoringParameters} from '../monitoring/parameters';
export type EnergySample=Pick<RuntimeSample,'energyWh'|'bytes'>;
export type EnergyParameters=Pick<MonitoringParameters,'intensityWarning'|'intensityCritical'>;
export function intensityLevel(value:number|null,p:EnergyParameters):'unknown'|'critical'|'warning'|'normal'{
 return value===null?'unknown':value>=p.intensityCritical?'critical':value>=p.intensityWarning?'warning':'normal';
}
// Pair energy and traffic at the observation boundary before period/site rollups.
export function energyObservation(samples:readonly EnergySample[],p:EnergyParameters){
 let energy=0,energyKnown=0,pairedBytes=0,bytes=0;
 for(const s of samples){bytes+=s.bytes;if(s.energyWh!==null){energy+=s.energyWh;pairedBytes+=s.bytes;energyKnown++;}}
 const energyWh=energyKnown?energy:null,intensity=energyWh!==null&&pairedBytes>0?energyWh/1000/(pairedBytes/GIB):null;
 return {energyWh,pairedBytes,bytes,energyKnown,expected:samples.length,missing:samples.length-energyKnown,intensity,level:intensityLevel(intensity,p),zeroTraffic:energyWh!==null&&energyWh>0&&bytes===0};
}
export type EnergyObservation=ReturnType<typeof energyObservation>;
export function summarizeEnergy(rows:readonly EnergyObservation[]){
 let energy=0,energyKnown=0,pairedBytes=0,bytes=0,observed=0,expected=0,evaluable=0,warning=0,critical=0,zeroTraffic=0,missing=0,unknown=0;
 for(const r of rows){if(r.energyWh!==null){energy+=r.energyWh;energyKnown++;}pairedBytes+=r.pairedBytes;bytes+=r.bytes;observed+=r.energyKnown;expected+=r.expected;
  evaluable+=Number(r.intensity!==null);warning+=Number(r.level==='warning');critical+=Number(r.level==='critical');zeroTraffic+=Number(r.zeroTraffic);missing+=Number(r.missing>0);unknown+=Number(r.missing>0||r.intensity===null);}
 return {sites:rows.length,energyWh:energyKnown?energy:null,energyKnown,pairedBytes,bytes,observed,expected,evaluable,warning,critical,attention:warning+critical,zeroTraffic,missing,unknown,intensity:energyKnown&&pairedBytes>0?energy/1000/(pairedBytes/GIB):null};
}
