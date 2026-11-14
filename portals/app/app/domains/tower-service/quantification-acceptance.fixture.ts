// Isolated local acceptance only; no runtime source imports this module.
import {previewSeed} from './preview';
import {serviceFixture} from './quantification.fixture';
import type {PublishedSnapshot} from './foundation';
export function acceptanceSnapshots(workspace:string):PublishedSnapshot[]{
 const original=previewSeed(workspace).snapshots[0];
 return [original,...[['qa-services-sep','2026-09-01T00:00:00+08:00','2026-10-01T00:00:00+08:00'],['qa-services-oct','2026-10-01T00:00:00+08:00','2026-11-01T00:00:00+08:00']].map(([id,start,end],index)=>{
  const v=structuredClone(original),a=v.inventory.rows[0].id,b=v.inventory.rows[1].id,c=serviceFixture(a,b);c.id=id;c.sourceVersion='ISOLATED-ACCEPTANCE-ONLY';c.period={start,end};c.stockAsOf=end;c.dataThrough=end;
  for(const r of c.configurations)r.from=start;for(const r of c.usage){r.from=start;r.to=end;}c.usage[0].quantity=String(10000+index*1000);
  for(let i=0;i<24;i++)c.configurations.push({...structuredClone(c.configurations[0]),id:'qa-component-'+i,siteId:v.inventory.rows[i].id,componentId:'qa-component-'+i,serviceItemId:'qa-project-'+i,quantity:String(1+index),sourceRef:'ISOLATED-QA-'+i});
  v.id=id;v.inventory.descriptor={...v.inventory.descriptor,id,stockAsOf:end,dataThrough:end};v.inventory.services=c;v.previousId=index?'qa-services-sep':null;return v;
 })];
}
