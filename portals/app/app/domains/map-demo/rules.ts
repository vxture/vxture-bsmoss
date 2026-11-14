import type { DemoSite, HourMetrics, OperatorFilter, DemoFinding } from './types.ts';
export const DEMO_VERSION = 'shaanxi-scenario-v1';
export const DEMO_DATE = '2026-10-25';
export const GIB = 1073741824;
const peak = (hour: number, center: number, width: number) => Math.exp(-(((hour-center)/width)**2));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo,v));
export function siteHour(site: DemoSite, hour: number, operator: OperatorFilter = 'all'): HourMetrics {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw Error('invalid_hour');
  if (operator !== 'all' && !site.operators.includes(operator)) throw Error('operator_not_applicable');
  const p = site.profile;
  const demand = p === 'hub' ? 0.12+0.82*peak(hour,8,2)+0.94*peak(hour,18,2.5)
    : p === 'industrial' ? 0.10+0.75*peak(hour,12,4.5)
    : p === 'mountain' ? 0.14+0.48*peak(hour,15,4)
    : 0.10+0.35*peak(hour,12,3.5)+0.92*peak(hour,20,3.3);
  const outage = p === 'mountain' && hour >= 11 && hour < 14;
  const congested = (p === 'urban' || p === 'shared') && hour >= 18 && hour <= 21;
  const shares = site.operators.map((_,i) => [0.43,0.29,0.20,0.065,0.015][i]);
  const shareTotal = shares.reduce((a,b)=>a+b,0);
  const indices = site.operators.map((_,i)=>i).filter(i=>operator === 'all' || site.operators[i]===operator);
  let bytes=0,upBytes=0,attempts=0,connected=0,voiceSeconds=0,sms=0,used=0,capacity=0;
  indices.forEach(i=>{
    const share = shares[i]/shareTotal;
    const opDemand = demand*(1+(i-1)*0.035);
    const opLoad = clamp(opDemand*(congested?1.09:0.80)+(site.seed%7)*0.009,0.03,0.985);
    const b = Math.round(site.capacity*GIB*opDemand*share*(outage?0.12:1));
    const a = Math.round((site.capacity*18*opDemand+40)*share);
    const rate = clamp(0.997-(congested?0.022:0)-(outage?0.13:0)-(site.seed%5)*0.0006,0,1);
    bytes+=b; upBytes+=Math.round(b*0.19); attempts+=a; connected+=Math.floor(a*rate);
    voiceSeconds+=Math.floor(a*rate)*(72+(site.seed%60)); sms+=Math.round(a*0.16);
    const c = Math.round(100000*share); capacity+=c; used+=Math.round(c*opLoad*(outage?0.2:1));
  });
  const physicalLoad = clamp(demand*0.8,0,1);
  const energyWh = operator === 'all' ? Math.round((1600+site.capacity*20*physicalLoad+(p==='efficient'?2100:0))*(outage?0.68:1)) : null;
  const temperature = Math.round((25+physicalLoad*9+(p==='efficient'?5:0)+(outage?3:0))*10)/10;
  const load = capacity ? used/capacity : 0;
  const status = outage ? 'critical' : congested || (p==='efficient' && hour<7) ? 'warning' : 'normal';
  return {hour,bytes,upBytes,downBytes:bytes-upBytes,voiceSeconds,attempts,connected,sms,used,capacity,energyWh,temperature,
    latency:Math.round(15+load*18+(congested?16:0)+(outage?32:0)),status,power:outage?'battery':'mains',
    health:outage?61:status==='warning'?82:96+(site.seed%4)};
}
export function findingsFor(site: DemoSite, current: HourMetrics): DemoFinding[] {
  const result: DemoFinding[]=[];
  if (current.status==='critical') result.push({severity:'critical',title:'\u5e02\u7535\u4e2d\u65ad\uff0c\u5907\u7528\u4f9b\u7535\u8fd0\u884c',detail:'11:00 \u8d77\u5207\u6362\u84c4\u7535\u6c60\u4f9b\u7535\uff1b\u4e1a\u52a1\u91cf\u540c\u6b65\u4e0b\u964d\u3002\u5efa\u8bae\u6838\u9a8c\u5e02\u7535\u6062\u590d\u4e0e\u7535\u6c60\u7eed\u822a\u3002',hour:11});
  if (current.status==='warning' && (site.profile==='urban'||site.profile==='shared')) result.push({severity:'warning',title:'\u665a\u9ad8\u5cf0\u8d1f\u8f7d\u4e0e\u63a5\u901a\u8d28\u91cf\u5173\u8054\u53d8\u5316',detail:'18:00 \u540e\u4e1a\u52a1\u9700\u6c42\u4e0a\u5347\uff0c\u8d44\u6e90\u8d1f\u8f7d\u63d0\u9ad8\uff0c\u63a5\u901a\u7387\u4e0b\u964d\u3002\u53ef\u5bf9\u6bd4\u540c\u7c7b\u7ad9\u70b9\u5e76\u6838\u9a8c\u5bb9\u91cf\u3002',hour:18});
  if (site.profile==='efficient') result.push({severity:'warning',title:'\u57fa\u7840\u80fd\u8017\u504f\u9ad8\uff0c\u5efa\u8bae\u6838\u9a8c\u7a7a\u8c03\u7b56\u7565',detail:'\u4f4e\u4e1a\u52a1\u65f6\u6bb5\u57fa\u7840\u80fd\u8017\u504f\u9ad8\uff0c\u53ef\u5173\u8054\u7535\u8017\u4e0e\u6d41\u91cf\u66f2\u7ebf\u6838\u9a8c\u7a7a\u8c03\u8fd0\u884c\u7b56\u7565\u3002',hour:3});
  if (!result.length) result.push({severity:'info',title:'\u5f53\u524d\u65f6\u6bb5\u8fd0\u884c\u5e73\u7a33',detail:'\u6240\u9009\u65f6\u6bb5\u672a\u547d\u4e2d\u573a\u666f\u5f02\u5e38\u89c4\u5219\uff0c\u53ef\u5207\u6362\u65f6\u95f4\u56de\u653e\u5e76\u89c2\u5bdf\u4e1a\u52a1\u6f6e\u6c50\u4e0e\u8fd0\u884c\u53c2\u6570\u3002',hour:current.hour});
  result.push({severity:'info',title:'\u591a\u8fd0\u8425\u5546\u4e1a\u52a1\u72ec\u7acb\u7edf\u8ba1',detail:'\u4e1a\u52a1\u6307\u6807\u6309\u7ad9\u5185\u670d\u52a1\u5173\u7cfb\u5f52\u5c5e\uff1b\u603b\u8868\u7535\u8017\u4e3a\u7269\u7406\u7ad9\u5740\u53e3\u5f84\uff0c\u4e0d\u81ea\u52a8\u5206\u644a\u7ed9\u8fd0\u8425\u5546\u3002',hour:current.hour});
  return result;
}
