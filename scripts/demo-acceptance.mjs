import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base=process.env.BSMOSS_DEMO_URL??'http://127.0.0.1:63333';
const output='artifacts/demo-acceptance';mkdirSync(output,{recursive:true});
const scenarios=[
  {id:'SX-DEMO-001',city:'610100',hour:18,profile:'urban'},
  {id:'SX-DEMO-002',city:'610100',hour:18,profile:'hub'},
  {id:'SX-DEMO-003',city:'610300',hour:18,profile:'industrial'},
  {id:'SX-DEMO-004',city:'610100',hour:12,profile:'mountain'},
  {id:'SX-DEMO-005',city:'610400',hour:3,profile:'efficient'},
  {id:'SX-DEMO-006',city:'610100',hour:18,profile:'shared'},
];
const results=[];
async function json(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,path);return r.json();}
for(const s of scenarios){
  const scope='cityId='+s.city+'&hour='+s.hour;
  const station=await json('/api/product-preview/station/'+s.id+'?'+scope);assert.equal(station.site.profile,s.profile);
  const map=await json('/api/product-preview/map?'+scope);assert.ok(map.points.some(p=>p.id===s.id));
  if(s.id==='SX-DEMO-004'){assert.equal(station.current.power,'battery');assert.equal(station.current.status,'critical');}
  const shared=await json('/api/product-preview/operators?'+scope+'&search='+s.id);assert.equal(shared.physicalSites,1);assert.equal(shared.checks.bytesDelta,0);
  const periods=[];
  for(const period of ['day','week','month']){
    const route='/api/product-preview/station/'+s.id+'/period',query='?period='+period+'&cityId='+s.city;
    const panel=await json(route+query),report=await json(route+'/report'+query);assert.deepEqual(report.analysis,panel);
    for(const metric of ['bytes','voiceSeconds','sms'])assert.equal(panel.hours.reduce((n,h)=>n+BigInt(h.counters[metric]),0n),BigInt(panel.usage.totals[metric]));
    const response=await fetch(base+route+'/report'+query+'&format=html');assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes(report.id));assert.equal((html.match(/<h2>/g)??[]).length,6);
    const filename=s.id+'-'+period+'.html';writeFileSync(output+'/'+filename,html);
    periods.push({period,reportId:report.id,templateVersion:report.templateVersion,hours:panel.hours.length,waves:panel.findings.bytes.count,sha256:createHash('sha256').update(html).digest('hex'),filename});
  }
  if(s.id==='SX-DEMO-003')assert.ok(periods[0].waves>8);
  if(s.id==='SX-DEMO-006'){assert.equal(station.site.operators.length,5);const one=await json('/api/product-preview/station/'+s.id+'/period?operator=other');assert.equal(one.usage.energyWh,null);}
  results.push({...s,status:'passed',periods});console.log('PASS '+s.id+' '+s.profile+' map/operator/day/week/month/exact/offline');
}
let browserResult={status:'not_run'};
if(process.argv.includes('--browser')){
  const {createRequire}=await import('node:module'),require=createRequire(import.meta.url);
  const {chromium}=require(process.env.BSMOSS_PLAYWRIGHT_MODULE??'playwright');
  const browser=await chromium.launch({...(process.env.BSMOSS_CHROMIUM_PATH?{executablePath:process.env.BSMOSS_CHROMIUM_PATH}:{}),headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
  try{
    const errors=[],views=[];
    for(const width of [1440,390,1024]){
      const mobile=width===390,context=await browser.newContext({viewport:{width,height:mobile?844:900},hasTouch:mobile,isMobile:mobile,acceptDownloads:true}),page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));await page.route(/^https:\/\//,r=>r.abort());
      const stationRequests=[];page.on('request',r=>{if(/\/api\/product-preview\/station\//.test(r.url()))stationRequests.push(r.url());});
      await page.goto(base+'/product-preview?hour=18');await page.locator('.mw-map-loading').waitFor({state:'hidden'});await page.waitForTimeout(400);assert.equal(stationRequests.length,0);assert.equal(await page.locator('.mw-site-heading').count(),0);
      for(const s of scenarios){
        await page.goto(base+'/product-preview?city='+s.city+'&site='+s.id+'&hour='+s.hour);
        await page.getByRole('button',{name:'\u7ecf\u8425\u670d\u52a1\u5206\u6790',exact:true}).click();
        const panel=page.locator('.mw-detail-business');await panel.locator('.mw-site-heading').waitFor();
        await panel.getByRole('group',{name:'\u7ecf\u8425\u7edf\u8ba1\u5206\u6790\u5468\u671f',exact:true}).getByRole('button',{name:'\u6708',exact:true}).click();
        const section=panel.locator('.mw-station-period');await section.locator('.mw-station-report-download a').waitFor();await section.locator('.mw-station-period-chart svg').first().waitFor();
        assert.equal(await page.evaluate(()=>document.body.scrollWidth),width);assert.ok(await section.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
        const [download]=await Promise.all([page.waitForEvent('download'),section.locator('.mw-station-report-download a').click()]);assert.match(download.suggestedFilename(),/bsmoss-DEMO-STATION-MONTH-/);
        const shot=s.id+'-'+width+'.png';await page.screenshot({path:output+'/'+shot});views.push({site:s.id,width,screenshot:shot});
      }
      await context.close();console.log('PASS browser '+width+' all six, no default station, download and overflow');
    }
    assert.deepEqual(errors,[]);browserResult={status:'passed',externalMapRequests:'blocked_for_deterministic_offline_acceptance',errors,views};
  }finally{await browser.close();}
}
const result={schema:'bsmoss-demo-acceptance-v1',status:'passed',synthetic:true,productionLaunch:false,base,checkedAt:new Date().toISOString(),nextBuildId:readFileSync('portals/app/.next/BUILD_ID','utf8').trim(),scenarios:results,browser:browserResult};
writeFileSync(output+'/result.json',JSON.stringify(result,null,2)+'\n');
console.log('Acceptance evidence: '+output+'/result.json');
