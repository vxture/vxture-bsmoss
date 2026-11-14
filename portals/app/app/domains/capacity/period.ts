import type {HourMetrics} from '../map-demo/types';

type Counters=Pick<HourMetrics,'used'|'capacity'|'attempts'|'connected'>;
export function sumCapacityCounters(samples:readonly Counters[]):Counters {
 return samples.reduce((total,sample)=>({used:total.used+sample.used,capacity:total.capacity+sample.capacity,attempts:total.attempts+sample.attempts,connected:total.connected+sample.connected}),{used:0,capacity:0,attempts:0,connected:0});
}

export {analysisTimeBuckets as capacityTimeBuckets} from '../analysis/period';
