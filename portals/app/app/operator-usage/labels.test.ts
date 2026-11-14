import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compactUsage} from './labels';
test('business totals scale by binary traffic units and decimal count units with two decimals',()=>{
 assert.deepEqual(compactUsage('599736141363170','bytes'),{value:'545.46',unit:'TiB'});
 assert.deepEqual(compactUsage(11118949,'connected'),{value:'1,111.89',unit:'\u4e07\u6b21'});
 assert.deepEqual(compactUsage(1806246,'sms'),{value:'180.62',unit:'\u4e07\u6761'});
 assert.deepEqual(compactUsage(1124022473,'voiceSeconds'),{value:'31.22',unit:'\u4e07\u5c0f\u65f6'});
 assert.deepEqual(compactUsage(326976378,'connected'),{value:'3.27',unit:'\u4ebf\u6b21'});
 assert.deepEqual(compactUsage(0,'sms'),{value:'0.00',unit:'\u6761'});
 assert.deepEqual(compactUsage(1024**3,'bytes'),{value:'1.00',unit:'GiB'});
 assert.deepEqual(compactUsage(1024**4,'bytes'),{value:'1.00',unit:'TiB'});
 assert.deepEqual(compactUsage(1024**5,'bytes'),{value:'1.00',unit:'PiB'});
 assert.deepEqual(compactUsage(99999999,'sms'),{value:'1.00',unit:'\u4ebf\u6761'});
 assert.deepEqual(compactUsage(10000,'sms'),{value:'1.00',unit:'\u4e07\u6761'});
 assert.deepEqual(compactUsage(9999,'sms'),{value:'9,999.00',unit:'\u6761'});
});
