import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const appRoot=new URL("../portals/app/",import.meta.url);
const require=createRequire(new URL("package.json",appRoot));
async function withServer(preview, run) {
  const child=spawn(process.execPath,[require.resolve("next/dist/bin/next"),"start","--hostname","127.0.0.1","--port","0"],{
    cwd:appRoot,env:{...process.env,BSMOSS_PRODUCT_PREVIEW:preview?"on":"off",NEXT_TELEMETRY_DISABLED:"1",OIDC_RP_ENABLED:"off",DATABASE_URL:"",PROVISION_WEBHOOK_SECRET:"",PROVISION_WEBHOOK_SECRET_NEXT:""},stdio:["ignore","pipe","pipe"],
  });
  let output="",settled=false;
  try {
    const url=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{settled=true;reject(Error("portal_start_timeout"));},30000);
      const collect=chunk=>{output+=chunk.toString();const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if(match&&output.includes("Ready")&&!settled){settled=true;clearTimeout(timer);resolve(match[0]);}};
      child.stdout.on("data",collect);child.stderr.on("data",collect);
      child.once("error",error=>{if(!settled){settled=true;clearTimeout(timer);reject(error);}});
      child.once("exit",()=>{if(!settled){settled=true;clearTimeout(timer);reject(Error(output));}});
    });
    await run(url);
  } finally {
    if(child.exitCode===null){const stopped=new Promise(resolve=>child.once("exit",resolve));child.kill();await stopped;}
  }
}
const request={category:"business_service",city:"all",operator:"all",preferences:[]};
await test("preview is explicitly gated and its HTTP boundary validates configuration",{timeout:60000},async t=>{
  await withServer(false,async url=>{
    await t.test("protected evidence and platform routes fail closed without configuration",async()=>{
      assert.equal((await fetch(url+"/api/measurements?workspaceId=forged")).status,401);
      assert.equal((await fetch(url+"/api/webhooks/vxture",{method:"POST",body:"{}"})).status,503);
      assert.equal((await fetch(url+"/auth/login")).status,404);
      assert.equal((await fetch(url+"/auth/session")).status,200);
      assert.equal((await fetch(url+"/api/ready")).status,503);
      const health=await (await fetch(url+"/api/health")).json();assert.equal(health.product,"bsmoss");
    });
    await t.test("preview page and API are unavailable with the flag off",async()=>{
      assert.equal((await fetch(url+"/product-preview")).status,404);
      assert.equal((await fetch(url+"/product-preview/metrics")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/map")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/operators")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/reports")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/period-comparison")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/reports?format=html")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/compare?sites=SX-DEMO-001")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/station/SX-DEMO-001")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/station/SX-DEMO-001/period")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/station/SX-DEMO-001/period/report?format=html")).status,404);
      assert.equal((await fetch(url+"/api/product-preview",{method:"POST",body:JSON.stringify(request)})).status,404);
      const root=await fetch(url);assert.equal(root.status,200);assert.ok(!(await root.text()).includes("fixture-hourly-v1"));
    });
  });
  await withServer(true,async url=>{
    await t.test("sample page renders and the root redirects to it",async()=>{
      const root=await fetch(url,{redirect:"manual"});assert.equal(root.status,307);
      const page=await fetch(url+"/product-preview");assert.equal(page.status,200);
      const html=await page.text();assert.ok(html.includes("SX-DEMO-001"));assert.ok(html.includes("shaanxi-scenario-v1"));
    });
    const post=body=>fetch(url+"/api/product-preview",{method:"POST",headers:{"Content-Type":"application/json"},body:typeof body==="string"?body:JSON.stringify(body)});
    await t.test('daily report and download share scoped deterministic references and reject unsupported requests',async()=>{
      const path='/api/product-preview/reports?cityId=610100&countyId=610113';
      const response=await fetch(url+path);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
      const r=await response.json();assert.equal(r.status,'draft');assert.equal(r.mode,'demo');assert.equal(r.hours.length,24);
      const later=await (await fetch(url+path+'&hour=23')).json();assert.equal(r.id,later.id);
      const download=await fetch(url+path+'&format=html');assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment; filename="bsmoss-DEMO-DAY-/);
      assert.equal(download.headers.get('x-content-type-options'),'nosniff');assert.ok(download.headers.get('content-security-policy').includes("default-src 'none'"));
      const html=await download.text();assert.ok(html.includes(r.id));assert.ok(!html.includes('<script>'));assert.ok(html.includes(r.usage.window.end));
      const single=await (await fetch(url+path+'&operator=mobile')).json();assert.equal(single.usage.energyWh,null);assert.notEqual(single.id,r.id);
      for(const params of ['date=2026-10-26','date=2026-10-25&date=2026-10-25','format=pdf','format=html&format=json','workspaceId=forged','period=year'])assert.equal((await fetch(url+'/api/product-preview/reports?'+params)).status,400);
    });
    await t.test('operator usage provides daily conservation and scoped unknown energy behind validation',async()=>{
      const response=await fetch(url+'/api/product-preview/operators?period=day&search=SX-DEMO-006');
      assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
      const r=await response.json();assert.equal(r.mode,'demo');assert.equal(r.physicalSites,1);assert.equal(r.serviceRelations,5);assert.equal(r.samples,120);
      assert.equal(r.rows.reduce((n,row)=>n+row.bytes,0),r.totals.bytes);assert.equal(r.window.end,'2026-10-26T00:00:00+08:00');
      const one=await (await fetch(url+'/api/product-preview/operators?period=day&operator=other&search=SX-DEMO-006')).json();
      assert.equal(one.energyWh,null);assert.deepEqual(one.rows[0],r.rows.find(row=>row.code==='other'));
      for(const params of ['period=year','period=day&period=hour','workspaceId=forged','cityId=610300&countyId=610113','hour=24'])assert.equal((await fetch(url+'/api/product-preview/operators?'+params)).status,400);
    });
    await t.test('comparison validates bounded IDs and uses the same scope and counters as station details',async()=>{
      const response=await fetch(url+'/api/product-preview/compare?sites=SX-DEMO-004,SX-DEMO-001&hour=12&operator=mobile');
      assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
      const comparison=await response.json();assert.equal(comparison.entries.length,2);assert.equal(comparison.entries[0].detail.current.power,'battery');
      const station=await (await fetch(url+'/api/product-preview/station/SX-DEMO-001?hour=12&operator=mobile')).json();
      assert.deepEqual(comparison.entries[1].detail.current,station.current);assert.equal(comparison.entries[1].detail.current.energyWh,null);
      const scoped=await (await fetch(url+'/api/product-preview/compare?sites=SX-DEMO-001,SX-DEMO-004&selection=108.8,34.1,109.1,34.5')).json();
      assert.ok(scoped.entries[0].detail);assert.deepEqual(scoped.entries[1],{id:'SX-DEMO-004',detail:null});
      for(const params of ['sites=a,a','sites=a,b,c,d,e','sites=a&sites=b','sites=a&workspaceId=forged','sites=a&hour=24'])assert.equal((await fetch(url+'/api/product-preview/compare?'+params)).status,400);
    });
    await t.test("map and station demo endpoints validate province context and share snapshot counters",async()=>{
      const mapResponse=await fetch(url+'/api/product-preview/map?hour=12&cityId=610100');assert.equal(mapResponse.status,200);assert.equal(mapResponse.headers.get('cache-control'),'no-store');
      const map=await mapResponse.json();assert.equal(map.mode,'demo');assert.equal(map.summary.count,240);
      const detail=await (await fetch(url+'/api/product-preview/station/SX-DEMO-004?hour=12')).json();assert.equal(detail.current.power,'battery');assert.equal(detail.current.status,'critical');
      assert.equal(map.points.find(p=>p.id==='SX-DEMO-004').trafficGiB,detail.current.bytes/1073741824);
      assert.equal((await fetch(url+'/api/product-preview/map?regionId=110000')).status,400);
      assert.equal((await fetch(url+'/api/product-preview/map?workspaceId=forged')).status,400);
      assert.equal((await fetch(url+'/api/product-preview/station/SX-DEMO-001?cityId=610300')).status,404);
      const station=await (await fetch(url+'/api/product-preview/station/SX-DEMO-001')).json();
      const countyQuery='cityId='+station.site.cityId+'&countyId='+station.site.countyId;
      const county=await (await fetch(url+'/api/product-preview/map?'+countyQuery)).json();
      assert.ok(county.summary.count>0&&county.summary.count<240);assert.ok(county.points.every(p=>p.countyId===station.site.countyId));
      assert.equal((await fetch(url+'/api/product-preview/map?cityId=610300&countyId='+station.site.countyId)).status,400);
      assert.equal((await fetch(url+'/api/product-preview/map?countyId='+station.site.countyId)).status,400);
      assert.equal((await fetch(url+'/geo/counties/610100.geojson')).status,200);
      assert.equal((await fetch(url+'/product-preview/metrics')).status,200);
      for(const asset of ['/geo/shaanxi-cities.geojson','/geo/fonts/Open%20Sans%20Regular/0-255.pbf','/vendor/maplibre/maplibre-gl-worker.mjs','/vendor/maplibre/maplibre-gl-shared.mjs'])assert.equal((await fetch(url+asset)).status,200,asset);
    });
    await t.test("spatial analysis shares filter scope, validates geometry and protects station drill-down",async()=>{
      const params='cityId=610100&selection=108.8,34.1,109.1,34.5&hour=18';
      const response=await fetch(url+'/api/product-preview/map?'+params);assert.equal(response.status,200);
      const r=await response.json();assert.ok(r.summary.count>0&&r.summary.count<240);assert.equal(r.area.series.length,24);
      assert.equal(r.area.series[18].bytes,r.summary.bytes);assert.equal(r.area.operators.reduce((v,p)=>v+p.bytes,0),r.summary.bytes);
      const moved=await (await fetch(url+'/api/product-preview/map?'+params+'&bbox=105,32,106,33')).json();
      assert.equal(moved.points.length,0);assert.deepEqual(moved.summary,r.summary);
      assert.equal((await fetch(url+'/api/product-preview/station/SX-DEMO-001?'+params)).status,200);
      assert.equal((await fetch(url+'/api/product-preview/station/SX-DEMO-004?'+params)).status,404);
      for(const value of ['108,34,108,35','1,2,,4','1,2,3,Infinity'])assert.equal((await fetch(url+'/api/product-preview/map?selection='+value)).status,400);
    });
    await t.test('circular selection is shared across APIs, rejects malformed shapes and survives report download',async()=>{
      const scope='cityId=610100&selection=circle:108.95,34.26,10000&hour=18';
      const r=await (await fetch(url+'/api/product-preview/map?'+scope)).json();assert.equal(r.summary.count,42);assert.equal(r.area.selection.kind,'circle');
      const moved=await (await fetch(url+'/api/product-preview/map?'+scope+'&bbox=105,32,106,33')).json();assert.deepEqual(moved.summary,r.summary);assert.equal(moved.points.length,0);
      const topic=await (await fetch(url+'/api/product-preview/map?'+scope+'&topic=capacity')).json();assert.equal(topic.topic.counts.total,r.summary.count);
      const ops=await (await fetch(url+'/api/product-preview/operators?'+scope)).json();assert.equal(ops.physicalSites,r.summary.count);assert.equal(ops.totals.bytes,r.summary.bytes);
      const cmp=await (await fetch(url+'/api/product-preview/compare?'+scope+'&sites=SX-DEMO-001,SX-DEMO-004')).json();assert.ok(cmp.entries[0].detail);assert.equal(cmp.entries[1].detail,null);
      assert.equal((await fetch(url+'/api/product-preview/station/SX-DEMO-004?'+scope)).status,404);
      const report=await (await fetch(url+'/api/product-preview/reports?'+scope)).json();assert.equal(report.usage.physicalSites,r.summary.count);
      const downloaded=await fetch(url+'/api/product-preview/reports?'+scope+'&format=html');assert.equal(downloaded.status,200);assert.ok((await downloaded.text()).includes('circle:108.95,34.26,10000'));
      for(const path of ['/map','/operators','/reports','/compare?sites=SX-DEMO-001','/station/SX-DEMO-001']){
        for(const shape of ['circle:108,34,0','circle:108,34,500001','circle:108,,100','circle:1,2,Infinity'])assert.equal((await fetch(url+'/api/product-preview'+path+(path.includes('?')?'&':'?')+'selection='+shape)).status,400);
      }
      assert.equal((await fetch(url+'/api/product-preview/map?'+scope+'&selection=108,34,109,35')).status,400);
    });
    await t.test('polygon scopes map, topic, station, comparison, operator usage and daily downloads consistently',async()=>{
      const shape='polygon:108.8,34.1;109.1,34.1;108.95,34.5';
      const scope='cityId=610100&hour=18&selection='+encodeURIComponent(shape);
      const response=await fetch(url+'/api/product-preview/map?'+scope);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
      const r=await response.json();assert.ok(r.summary.count>0&&r.summary.count<240);assert.equal(r.area.selection.kind,'polygon');
      const moved=await (await fetch(url+'/api/product-preview/map?'+scope+'&bbox=105,32,106,33')).json();assert.deepEqual(moved.summary,r.summary);assert.equal(moved.points.length,0);
      const topic=await (await fetch(url+'/api/product-preview/map?'+scope+'&topic=capacity')).json();assert.equal(topic.topic.counts.total,r.summary.count);
      const usage=await (await fetch(url+'/api/product-preview/operators?'+scope)).json();assert.equal(usage.physicalSites,r.summary.count);assert.equal(usage.totals.bytes,r.summary.bytes);
      const comparison=await (await fetch(url+'/api/product-preview/compare?'+scope+'&sites=SX-DEMO-001,SX-DEMO-004')).json();assert.ok(comparison.entries[0].detail);assert.equal(comparison.entries[1].detail,null);
      assert.equal((await fetch(url+'/api/product-preview/station/SX-DEMO-001?'+scope)).status,200);assert.equal((await fetch(url+'/api/product-preview/station/SX-DEMO-004?'+scope)).status,404);
      const report=await (await fetch(url+'/api/product-preview/reports?'+scope)).json();assert.equal(report.usage.physicalSites,r.summary.count);
      const html=await fetch(url+'/api/product-preview/reports?'+scope+'&format=html');assert.equal(html.status,200);assert.ok((await html.text()).includes(shape));
      for(const path of ['/map','/operators','/reports','/compare?sites=SX-DEMO-001','/station/SX-DEMO-001']){
        for(const value of ['polygon:0,0;2,2;0,2;2,0','polygon:0,0;1,1;2,2','polygon:0,0;181,0;0,1','polygon:0,0;1,0;0,1;'])assert.equal((await fetch(url+'/api/product-preview'+path+(path.includes('?')?'&':'?')+'selection='+encodeURIComponent(value))).status,400);
      }
      assert.equal((await fetch(url+'/api/product-preview/map?'+scope+'&selection='+encodeURIComponent(shape))).status,400);
    });
    await t.test('calendar weeks and months share exact usage, report windows and scoped downloads',async()=>{
      for(const period of ['week','month']){
        const params='period='+period+'&cityId=610100&selection='+encodeURIComponent('polygon:108.8,34.1;109.1,34.1;108.95,34.5')+'&search=SX-DEMO-006';
        const usageResponse=await fetch(url+'/api/product-preview/operators?'+params);assert.equal(usageResponse.status,200);assert.equal(usageResponse.headers.get('cache-control'),'no-store');
        const usage=await usageResponse.json();assert.equal(usage.physicalSites,1);assert.equal(usage.calendar.days,period==='week'?7:31);assert.equal(usage.checks.bytesDelta,'0');assert.equal(typeof usage.totals.bytes,'string');
        const response=await fetch(url+'/api/product-preview/reports?'+params);assert.equal(response.status,200);const report=await response.json();assert.deepEqual(report.usage,usage);assert.equal(report.days.length,usage.calendar.days);
        assert.equal(BigInt(report.usage.totals.bytes),report.days.reduce((v,d)=>v+BigInt(d.bytes),0n));
        const moved=await (await fetch(url+'/api/product-preview/reports?'+params+'&hour=2&bbox=105,32,106,33')).json();assert.equal(moved.id,report.id);
        const html=await fetch(url+'/api/product-preview/reports?'+params+'&format=html');assert.equal(html.status,200);assert.match(html.headers.get('content-disposition'),/attachment; filename="bsmoss-DEMO-(WEEK|MONTH)-/);assert.equal(html.headers.get('x-content-type-options'),'nosniff');assert.ok(html.headers.get('content-security-policy').includes("default-src 'none'"));
        const output=await html.text();assert.ok(output.includes(report.id));assert.ok(output.includes(usage.window.end));assert.ok(output.includes(BigInt(usage.totals.bytes).toLocaleString('zh-CN')));
        const one=await (await fetch(url+'/api/product-preview/operators?'+params+'&operator=other')).json();assert.equal(one.energyWh,null);assert.deepEqual(one.rows[0],usage.rows.find(row=>row.code==='other'));
      }
      const a=await (await fetch(url+'/api/product-preview/reports?period=day&search=SX-DEMO-006')).json(),b=await (await fetch(url+'/api/product-preview/reports?search=SX-DEMO-006')).json();assert.deepEqual(a,b);
      for(const path of ['operators','reports'])for(const params of ['period=year','period=week&period=month','period=week&workspaceId=forged','period=week&countyId=610113'])assert.equal((await fetch(url+'/api/product-preview/'+path+'?'+params)).status,400);
    });
    await t.test('period comparison is gated, validates baseline scope and preserves report/download evidence',async()=>{
      for(const period of ['day','week','month']){
        const scope='period='+period+'&cityId=610100&countyId=610113&selection='+encodeURIComponent('polygon:108.8,34.1;109.1,34.1;108.95,34.5')+'&search=SX-DEMO-006';
        const response=await fetch(url+'/api/product-preview/period-comparison?'+scope);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');const c=await response.json();
        assert.equal(c.comparable,true);assert.equal(c.reason,'matched');assert.equal(c.previous.window.end,c.current.window.start);assert.equal(typeof c.metrics.bytes.previous,'string');assert.equal(c.metrics.bytes.delta,String(BigInt(c.metrics.bytes.current)-BigInt(c.metrics.bytes.previous)));
        const report=await (await fetch(url+'/api/product-preview/reports?'+scope)).json();assert.deepEqual(report.comparison,c);
        const html=await (await fetch(url+'/api/product-preview/reports?'+scope+'&format=html')).text();assert.ok(html.includes(c.metrics.bytes.previous));assert.ok(html.includes(c.previous.window.start));assert.ok(html.includes(c.version));assert.ok(html.includes(report.id));
        const moved=await (await fetch(url+'/api/product-preview/period-comparison?'+scope+'&hour=1&bbox=105,32,106,33&topic=power')).json();assert.deepEqual(moved,c);
        const one=await (await fetch(url+'/api/product-preview/period-comparison?'+scope+'&operator=other')).json();assert.equal(one.energy,null);assert.equal(one.previous.energyWh,null);
      }
      const empty=await (await fetch(url+'/api/product-preview/period-comparison?period=month&search=not-found')).json();assert.equal(empty.reason,'empty_scope');assert.equal(empty.metrics.bytes.rate,null);
      for(const params of ['period=hour','period=year','period=week&period=month','period=day&baseline=2026-01-01','period=day&date=2026-10-25','period=week&workspaceId=forged','period=week&countyId=610113','selection=circle:108,34,0'])assert.equal((await fetch(url+'/api/product-preview/period-comparison?'+params)).status,400);
      assert.equal((await fetch(url+'/api/product-preview/period-comparison?search='+('a'.repeat(3000)))).status,413);
    });
    await t.test('period contributions reconcile scoped city/county/site lists and offline reports',async()=>{
      for(const period of ['day','week','month']){
        const scope='period='+period+'&cityId=610100&countyId=610113&operator=other&search=SX-DEMO-006';
        const data=await (await fetch(url+'/api/product-preview/period-comparison?'+scope)).json(),c=data.contribution;
        assert.equal(c.status,'matched');assert.equal(c.limit,5);assert.equal(data.energy,null);
        for(const level of ['city','county','site'])for(const metric of ['bytes','voiceSeconds','sms']){
          const g=c.levels[level][metric];assert.equal(g.count,1);assert.equal(g.total.net,data.metrics[metric].delta);
          for(const v of [g.total,g.daily]){assert.equal(BigInt(v.positive)+BigInt(v.negative),BigInt(v.net));assert.equal(v.increased+v.decreased+v.unchanged,g.count);}
          assert.equal(g.ranking[0].current,data.metrics[metric].current);
        }
        assert.equal(c.levels.site.bytes.ranking[0].id,'SX-DEMO-006');
        const report=await (await fetch(url+'/api/product-preview/reports?'+scope)).json();assert.deepEqual(report.comparison.contribution,c);
        const html=await (await fetch(url+'/api/product-preview/reports?'+scope+'&format=html')).text();assert.ok(html.includes(c.version));assert.ok(html.includes(c.levels.site.bytes.ranking[0].current));assert.equal((html.match(/<h2>/g)??[]).length,6);
      }
      const empty=await (await fetch(url+'/api/product-preview/period-comparison?period=day&search=not-found')).json();assert.equal(empty.contribution.status,'unavailable');assert.equal(empty.contribution.levels,null);
    });
    await t.test('station periods use dated exact counters, causal baseline evidence and strict scope',async()=>{
      for(const period of ['day','week','month']){
        const path='/api/product-preview/station/SX-DEMO-003/period?period='+period+'&cityId=610300';
        const response=await fetch(url+path);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
        const r=await response.json();assert.equal(r.period,period);assert.equal(r.usage.physicalSites,1);assert.equal(r.hours.length,r.usage.calendar.days*24);assert.equal(r.days.length,r.usage.calendar.days);
        for(const key of ['bytes','voiceSeconds','sms']){assert.equal(r.days.reduce((n,d)=>n+BigInt(d.counters[key]),0n),BigInt(r.usage.totals[key]));assert.equal(r.findings[key].count,r.hours.filter(h=>h.waves[key].flagged).length);}
        const h=r.hours[0];assert.equal(h.baselineDates.length,4);assert.ok(h.baselineDates.every(d=>d<h.date));assert.equal(h.waves.bytes.references.length,4);assert.equal(h.waves.bytes.denominator,2);assert.equal(r.policy.relativeBps,1500);
        assert.deepEqual(await (await fetch(url+path+'&hour=2&bbox=105,32,106,33&topic=power')).json(),r);
        const one=await (await fetch(url+path+'&operator=mobile')).json();assert.equal(one.usage.energyWh,null);assert.ok(one.hours.every(h=>h.energyWh===null));
      }
      for(const p of ['period=hour','period=week&period=month','period=month&date=2026-10-01','period=week&baseline=2026-10-01','relativeBps=1','workspaceId=forged'])assert.equal((await fetch(url+'/api/product-preview/station/SX-DEMO-003/period?'+p)).status,400);
      for(const p of ['cityId=610100','selection=circle:105,32,1000','search=not-found'])assert.equal((await fetch(url+'/api/product-preview/station/SX-DEMO-003/period?'+p)).status,404);
      assert.equal((await fetch(url+'/api/product-preview/station/not-found/period')).status,404);
      assert.equal((await fetch(url+'/api/product-preview/station/SX-DEMO-003/period?search='+('a'.repeat(3000)))).status,413);
    });
    await t.test('station report downloads preserve the panel snapshot and enforce strict format and scope',async()=>{
      for(const period of ['day','week','month']){
        const base='/api/product-preview/station/SX-DEMO-003/period',scope='period='+period+'&cityId=610300';
        const panel=await (await fetch(url+base+'?'+scope)).json();
        const json=await fetch(url+base+'/report?'+scope);assert.equal(json.status,200);assert.equal(json.headers.get('cache-control'),'no-store');
        const r=await json.json();assert.deepEqual(r.analysis,panel);assert.equal(r.id,panel.report.id);
        const response=await fetch(url+base+'/report?'+scope+'&format=html');assert.equal(response.status,200);
        assert.match(response.headers.get('content-disposition'),/attachment; filename="bsmoss-DEMO-STATION-/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.ok(response.headers.get('content-security-policy').includes("default-src 'none'"));
        const html=await response.text();assert.ok(html.includes(r.id));assert.ok(html.includes(panel.hours[0].waves.bytes.references.join(' / ')));assert.equal((html.match(/<h2>/g)??[]).length,6);
      }
      const path='/api/product-preview/station/SX-DEMO-003/period/report?';
      for(const scope of ['format=pdf','format=html&format=json','period=day&period=week','baseline=2026-10-01','relativeBps=1','workspaceId=forged'])assert.equal((await fetch(url+path+scope)).status,400);
      assert.equal((await fetch(url+path+'cityId=610100')).status,404);assert.equal((await fetch(url+path+'search='+('a'.repeat(3000)))).status,413);
    });
    await t.test('topics share map scope, recompute hourly, and leave unallocated operator energy unknown',async()=>{
      const path='/api/product-preview/map?topic=power&hour=12&cityId=610100';
      const response=await fetch(url+path);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
      const r=await response.json();assert.equal(r.topic.kind,'power');assert.equal(r.topic.counts.total,r.summary.count);
      assert.equal(r.points.find(p=>p.id==='SX-DEMO-004').topicLevel,'critical');assert.equal(r.topic.series.length,24);
      assert.equal(r.topic.series[10].critical,0);assert.ok(r.topic.series[12].critical>0);
      const moved=await (await fetch(url+path+'&bbox=105,32,106,33')).json();assert.deepEqual(moved.topic,r.topic);assert.equal(moved.points.length,0);
      const scoped=await (await fetch(url+path+'&countyId=610113&selection=108.8,34.1,109.1,34.5')).json();
      assert.ok(scoped.topic.counts.total>0&&scoped.topic.counts.total<r.topic.counts.total);assert.ok(!scoped.points.some(p=>p.id==='SX-DEMO-004'));
      const unknown=await (await fetch(url+'/api/product-preview/map?topic=efficiency&operator=mobile')).json();
      assert.equal(unknown.topic.counts.unknown,unknown.summary.count);assert.equal(unknown.topic.priority.length,0);
      for(const params of ['topic=unknown','topic=','topic=power&topic=capacity'])assert.equal((await fetch(url+'/api/product-preview/map?'+params)).status,400);
    });
    await t.test("all three categories resolve using server-owned sample context",async()=>{
      for(const category of ["business_service","operational_status","runtime_parameter"]){
        const response=await post({...request,category});assert.equal(response.status,200);
        assert.equal(response.headers.get("cache-control"),"no-store");
        const data=await response.json();assert.equal(data.mode,"sample");assert.ok(data.cards.every(c=>c.category===category));
      }
    });
    await t.test("invalid JSON, client-supplied grants and invalid units are rejected",async()=>{
      for (const body of ["{",{...request,allowedMetricKeys:["*"]},{...request,preferences:[{id:"service.data.uplink_bytes",displayUnit:"kWh"}]}]) assert.equal((await post(body)).status,400);
      assert.equal((await post(" ".repeat(20001))).status,413);
    });
  });
});
