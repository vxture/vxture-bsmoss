export const QUALITY_POLICY='tower-service-quality-demo-v1';
export const QUALITY_DIMENSIONS=['power','backup','environment','recovery'] as const;
export type QualityDimension=typeof QUALITY_DIMENSIONS[number];
export interface QualityObservation {expectedSeconds:number;observedSeconds:number;badSeconds:number;applicable:boolean;complete:boolean;source:string}
export type QualityInput=Record<QualityDimension,QualityObservation>;
const weights={power:40,backup:25,environment:15,recovery:20};
// Bad-time ratios in parts per million, scores in hundredths of a point.
const curves:Record<QualityDimension,readonly number[]>={power:[0,500,2000,10000],backup:[0,10000,50000,200000],environment:[0,5000,20000,100000],recovery:[0,200,1000,5000]};
const levels=[10000,9000,6000,0];
export function qualityMetricScore(dimension:QualityDimension,bad:number,observed:number){
 if(!Number.isSafeInteger(bad)||!Number.isSafeInteger(observed)||bad<0||observed<=0||bad>observed)throw new Error('invalid_quality_ratio');
 const ratio=BigInt(bad)*1000000n,denominator=BigInt(observed),points=curves[dimension];
 for(let i=1;i<points.length;i++)if(ratio<=BigInt(points[i])*denominator){
  const loss=(ratio-BigInt(points[i-1])*denominator)*BigInt(levels[i-1]-levels[i]);
  return levels[i-1]-Number(loss/(BigInt(points[i]-points[i-1])*denominator));
 }
 return 0;
}
export function serviceQuality(input:QualityInput,majorPowerInterruption=false){
 const dimensions=QUALITY_DIMENSIONS.map(id=>{
  const row=input[id];
  if(!row||![row.expectedSeconds,row.observedSeconds,row.badSeconds].every(Number.isSafeInteger)||row.expectedSeconds<0||row.observedSeconds<0||row.observedSeconds>row.expectedSeconds||row.badSeconds<0||row.badSeconds>row.observedSeconds||!row.source)throw new Error('invalid_quality_observation');
  const eligible=row.applicable&&row.expectedSeconds>0&&row.observedSeconds>0&&row.complete&&BigInt(row.observedSeconds)*100n>=BigInt(row.expectedSeconds)*95n;
  return {id,weight:weights[id],score:eligible?qualityMetricScore(id,row.badSeconds,row.observedSeconds):null,reason:!row.applicable?'not_applicable':eligible?'evaluated':'insufficient_evidence',...row};
 });
 const applicable=dimensions.filter(d=>d.applicable),eligible=applicable.length>0&&applicable.every(d=>d.score!==null);
 const weight=applicable.reduce((n,d)=>n+d.weight,0);
 const uncapped=eligible?Math.floor(applicable.reduce((n,d)=>n+d.score!*d.weight,0)/weight):null;
 return {policy:QUALITY_POLICY,dimensions,score:uncapped===null?null:Math.min(uncapped,majorPowerInterruption?5900:10000),uncapped,majorPowerInterruption};
}
