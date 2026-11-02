import type {WaveEvidence} from './station-period-rules.ts';
import {signed} from './period-comparison-display.ts';
export function waveLabel(w:WaveEvidence):string {
  return w.status==='from_zero'?'\u53c2\u8003\u4e3a\u96f6 \u00b7 \u65b0\u589e':w.status==='both_zero'?'\u53c2\u8003\u4e0e\u672c\u671f\u5747\u96f6':w.status==='insufficient'?'\u53c2\u8003\u4e0d\u8db3':w.rate===null?'\u2014':signed(w.rate*100)+'%';
}
