import {calendarSource,CALENDAR_RULE_VERSION} from '../map-demo/period-rules';
import {DEMO_SITES} from '../map-demo/resources';
import type {Inventory} from './foundation';
import type {EvidenceCapture} from './evidence';
// Captured only by a NEW explicit sync. Never backfill the reference or old versions.
// These are the existing synthetic interval observations, not customer meters.
export function previewEvidence(inventory:Inventory):EvidenceCapture{
 const start='2026-10-25T00:00:00+08:00',end=inventory.descriptor.dataThrough,byId=new Map(DEMO_SITES.map(s=>[s.id,s]));
 const c:EvidenceCapture={id:'demo-physical-20261025-00-18-v1',sourceVersion:inventory.descriptor.sourceVersion,mappingVersion:'physical-interval-v1',ruleSetVersion:CALENDAR_RULE_VERSION,period:{start,end},dataThrough:end,complete:true,applicabilityComplete:false,operatorScope:['mobile','telecom','unicom','broadcast','other'],customers:[],meters:[],records:[],bindings:[],items:[],rules:[]};
 for(const site of inventory.rows){const source=calendarSource(byId.get(site.id)!),meterId='demo-physical:'+site.id;
  c.meters.push({id:meterId,siteId:site.id,unit:'Wh',scale:0,boundary:'physical_site',role:'total',parentId:null,sourceRef:CALENDAR_RULE_VERSION});
  for(let hour=0;hour<18;hour++){const from='2026-10-25T'+String(hour).padStart(2,'0')+':00:00+08:00',to='2026-10-25T'+String(hour+1).padStart(2,'0')+':00:00+08:00',value=source.sample('2026-10-25',hour,'all');c.records.push({id:meterId+':'+hour,meterId,from,to,kind:'interval',quantity:value.energyWh===null?null:String(value.energyWh),startValue:null,endValue:null,multiplier:'1',epoch:'demo-interval-v1',event:'none',reliable:value.energyWh!==null,sourceRef:'demo/'+site.id+'/'+from});}
  c.items.push({id:'physical:'+site.id,siteId:site.id,meterId,customerId:null,service:'power',from:start,to:end,method:'unassigned',ruleIds:[],sharingRuleIds:[],sharingRequired:false,sharingReferenceAt:null,sourceRef:CALENDAR_RULE_VERSION});
 }
 return c;
}
