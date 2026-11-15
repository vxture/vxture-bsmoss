import {demoQuality} from "../portals/app/app/domains/monitoring/quality-demo.ts";
import {writeFileSync,mkdirSync} from "node:fs";
import {gzipSync} from "node:zlib";
import {DEMO_SITES,DEMO_REGION} from "../portals/app/app/domains/map-demo/resources.ts";
import {DEMO_DATE,siteHour} from "../portals/app/app/domains/map-demo/rules.ts";
import {calendarSource,calendarWindow} from "../portals/app/app/domains/map-demo/period-rules.ts";
import {previewReadInventory,previewRoot} from "../portals/app/app/domains/tower-service/preview.ts";
import {readDemoHistory} from "../portals/app/app/domains/tower-service/history-store.ts";
import {DAY} from "../portals/app/app/domains/tower-service/history-calendar.ts";

// Build once from the same physical meter formula, never operator allocations.
const rows={},window=calendarWindow("month"),prior=calendarWindow("month","previous");
const scopes=[['all','all'],...DEMO_REGION.cities.map(c=>[c.id,'all']),...DEMO_REGION.counties.map(c=>[c.cityId,c.id])];
for(const [city,county] of scopes)rows[city+':'+county]={demo:{date:DEMO_DATE,hour:18,occupiedSites:0,healthTotal:0,attentionSites:0,usage:{physicalSites:0,sharedSites:0},report:{energyWh:0,previousEnergyWh:0,days:window.dates.length,previousDays:prior.dates.length,window:{start:window.start}}},growth:{net:0,entered:0,exited:0,current:0}};
for(const row of Object.values(rows))row.demo.quality={policy:"tower-service-quality-demo-v1",month:window.start.slice(0,7),score:null,coverage:0,evaluated:0,total:0,weighted:0,expected:0,comparisonCount:0,currentComparable:0,previousComparable:0,delta:null};
const qualitySites=[];
const keys=site=>['all:all',site.cityId+':all',site.cityId+':'+site.countyId];
for(const site of DEMO_SITES){
 const quality=demoQuality(site,window.start.slice(0,7)),previousQuality=demoQuality(site,prior.start.slice(0,7));
 qualitySites.push({siteId:site.id,city:site.cityId,county:site.countyId,...quality});
 const source=calendarSource(site),energy=window.dates.reduce((n,date)=>n+source.physicalDaily(date).energyWh,0),previousEnergy=prior.dates.reduce((n,date)=>n+source.physicalDaily(date).energyWh,0),sample=siteHour(site,18);
 for(const key of keys(site)){const d=rows[key].demo;const q=d.quality;q.total++;if(quality.score!==null&&previousQuality.score!==null){q.comparisonCount++;q.currentComparable+=quality.score;q.previousComparable+=previousQuality.score;}if(quality.score!==null){q.evaluated++;q.weighted+=quality.score*quality.dimensions[0].expectedSeconds;q.expected+=quality.dimensions[0].expectedSeconds;}d.usage.physicalSites++;if(site.operators.length)d.occupiedSites++;if(site.operators.length>1)d.usage.sharedSites++;d.report.energyWh+=energy;d.report.previousEnergyWh+=previousEnergy;d.healthTotal+=sample.health;if(sample.status!=='normal')d.attentionSites++;}
}
const {history:h}=await readDemoHistory(previewRoot()+'/demo-history',previewReadInventory());
const before=(Date.parse(window.start)-Date.parse(h.start)-1)/DAY,after=(Date.parse(window.end)-Date.parse(h.start)-1)/DAY;
const previous=new Set(),current=new Set();
for(const r of h.relations){if(r.from<=before&&before<r.to)previous.add(r.site);if(r.from<=after&&after<r.to)current.add(r.site);}
h.sites.forEach((site,index)=>{for(const key of ['all:all',site.city+':all',site.city+':'+site.county]){const g=rows[key].growth;if(current.has(index))g.current++;if(current.has(index)&&!previous.has(index))g.entered++;if(previous.has(index)&&!current.has(index))g.exited++;g.net=g.entered-g.exited;}});
for(const row of Object.values(rows)){const q=row.demo.quality;q.coverage=q.total?q.evaluated*100/q.total:0;q.score=q.coverage>=95&&q.expected?q.weighted/q.expected/100:null;q.delta=q.score!==null&&q.total&&q.comparisonCount/q.total>=0.95?(q.currentComparable-q.previousComparable)/q.comparisonCount/100:null;}
writeFileSync(new URL('../portals/app/app/portal/generated-home.json',import.meta.url),JSON.stringify({schema:'bsmoss-home-v1',sourceDigest: h.version,rows})+'\n');
console.log('[home] prepared '+scopes.length+' region summaries');

mkdirSync(previewRoot()+"/demo-history/quality",{recursive:true});
writeFileSync(previewRoot()+"/demo-history/quality/current.json.gz",gzipSync(JSON.stringify({policy:"tower-service-quality-demo-v1",synthetic:true,month:window.start.slice(0,7),sites:qualitySites})));
