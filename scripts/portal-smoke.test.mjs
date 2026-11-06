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
    await t.test('source configuration and audit keep independent session gates and expose no writes',async()=>{
      for(const path of ['/api/management/source-configurations','/api/management/source-configurations/untrusted','/api/management/configuration-audit','/api/management/configuration-audit/untrusted?revision=1']) {
        const r=await fetch(url+path);assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(r.headers.get('vary').includes('Cookie'));assert.equal(r.headers.get('x-content-type-options'),'nosniff');
        assert.equal((await fetch(url+path,{method:'POST',body:'{}'})).status,405);
      }
      for(const [path,title] of [['/settings/sources','\u6765\u6e90\u914d\u7f6e'],['/settings/audit','\u914d\u7f6e\u5ba1\u8ba1']]){
        const r=await fetch(url+path);assert.equal(r.status,200);const html=await r.text();const h1=html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/g)??[];assert.equal(h1.length,1);assert.ok(h1[0].includes(title));assert.ok(html.includes('\u8eab\u4efd\u63a5\u5165\u5f85\u5b8c\u6210'));assert.ok(!html.includes('QA Source'));assert.ok(!html.includes('>\u65b0\u589e<'));
      }
      const settings=await(await fetch(url+'/settings')).text();for(const path of ['/settings/sources','/settings/audit'])assert.ok(settings.includes('href="'+path+'"'));
    });
    await t.test('management is session-gated and read-only with private responses',async()=>{
      for(const path of ['/api/management/members','/api/management/jurisdiction','/api/management/members/99000000-0000-0000-0000-000000000002']){
        const r=await fetch(url+path);assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.ok(r.headers.get('vary').includes('Cookie'));
        assert.equal((await fetch(url+path,{method:'POST',body:'{}'})).status,405);
      }
      for(const path of ['/settings/members','/settings/jurisdiction']){const html=await(await fetch(url+path)).text();assert.ok(html.includes('\u8eab\u4efd\u63a5\u5165\u5f85\u5b8c\u6210'));assert.ok(!html.includes('management-2'));const title=path.endsWith('/members')?'\u6210\u5458\u7ba1\u7406':'\u7ba1\u8f96\u8303\u56f4';assert.ok(html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/)?.[0].includes(title));}
    });
    await t.test('formal intake supervision requires a real session and exposes no intake execution route',async()=>{
      const id='a'.repeat(64);
      for(const [path,method] of [['/api/intake-tasks','GET'],['/api/intake-tasks/'+id,'GET'],['/api/intake-tasks/'+id+'/terminate','POST']]) {
        const r=await fetch(url+path,{method,...(method==='POST'?{headers:{origin:url,'content-type':'application/json'},body:'{}'}:{})});
        assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.ok(r.headers.get('vary').split(/,\s*/).includes('Cookie'));
      }
      assert.equal((await fetch(url+'/api/intake-tasks',{method:'POST',headers:{origin:url,'content-type':'application/json'},body:'{}'})).status,405);
      for(const action of ['run','recover'])assert.equal((await fetch(url+'/api/intake-tasks/'+id+'/'+action,{method:'POST',body:'{}'})).status,404);
    });
    await t.test('formal received-update tasks never allow anonymous reads or writes',async()=>{
      const id='a'.repeat(64);
      for(const [path,method] of [['/api/data-updates/notifications','GET'],['/api/data-updates','GET'],['/api/data-updates','POST'],['/api/data-updates/'+id,'GET'],['/api/data-updates/'+id+'/retry','POST']]) {
        const r=await fetch(url+path,{method,...(method==='POST'?{headers:{origin:url,'content-type':'application/json'},body:'{}'}:{})});
        assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'no-store');
      }
      const html=await(await fetch(url+'/operations/data-updates?task='+id)).text();
      assert.ok(html.includes('\u6570\u636e\u66f4\u65b0')); assert.ok(html.includes('\u4efb\u52a1\u5de5\u4f5c\u53f0\u5c1a\u672a\u5f00\u653e')); assert.ok(!html.includes('received_evidence'));
    });
    await t.test('data availability is hidden and unwritable outside explicit preview',async()=>{
      for(const method of ['GET','POST']) {
        const r=await fetch(url+'/api/product-preview/data-availability?family=overview',{method});
        assert.ok([404,405].includes(r.status));
        if(method==='GET'){assert.equal(r.status,404);assert.equal(r.headers.get('cache-control'),'no-store');}
      }
      assert.ok(!(await(await fetch(url)).text()).includes('bsmoss-data-availability-v1'));
    });
    await t.test('local review records and writes are unavailable outside explicit preview',async()=>{
      assert.equal((await fetch(url+'/review-history')).status,404);
      assert.equal((await fetch(url+'/api/product-preview/review-events',{method:'POST',body:'{}'})).status,404);
      const html=await(await fetch(url+'/usage-review')).text();assert.ok(!html.includes('bsmoss-demo-review-v1'));assert.ok(!html.includes('data-review-history'));
    });
    await t.test("annual analysis fails closed when the explicit preview adapter is off",async()=>{
      const r=await fetch(url+'/analysis?range=12m');assert.equal(r.status,200);
      const html=await r.text();assert.ok(!html.includes('data-history-analysis'));
      assert.ok(!html.includes('bsmoss-history-v1'));assert.ok(!html.includes('2024-11-01'));
      assert.equal((await fetch(url+'/api/analysis')).status,401);
    });
    await t.test("overview never exposes cached synthetic report summaries with preview off",async()=>{
      const r=await fetch(url+'/?reportPeriod=month');assert.equal(r.status,200);
      const html=await r.text();
      for(const marker of ['data-overview-report=','data-overview-attention=','bsmoss-demo-review-scenarios-v1','DEMO-MONTH-']) assert.ok(!html.includes(marker));
      assert.ok(!html.includes('data-overview-metrics='));
      const settings=await (await fetch(url+'/preferences/overview')).text();assert.ok(!settings.includes('data-overview-display-settings'));
    });
    await t.test("usage verification never exposes its isolated scenario evidence with preview off",async()=>{
      const r=await fetch(url+'/usage-review'); assert.equal(r.status,200);
      const html=await r.text();assert.ok(html.includes('\u6b63\u5f0f\u7528\u91cf\u6838\u9a8c\u5c1a\u672a\u5f00\u653e'));
      assert.ok(!html.includes('data-usage-review='));assert.ok(!html.includes('bsmoss-demo-review-scenarios-v1'));
      assert.equal((await fetch(url+'/usage-review/UV-'+'0'.repeat(24))).status,404);
    });
    await t.test('standalone analysis pages never expose synthetic models when preview is disabled',async()=>{
      for(const path of ['/capacity','/efficiency','/operator-usage','/usage-reports']) {
        const response=await fetch(url+path);assert.equal(response.status,200);
        const html=await response.text();assert.ok(html.includes('\u5c1a\u672a\u5f00\u653e'));
        for(const marker of ['data-business-analysis=','SX-DEMO-','href="/product-preview','maplibregl-canvas'])assert.ok(!html.includes(marker));
      }
    });
    await t.test("configuration preferences are public but never grant a product identity",async()=>{
      const response=await fetch(url+'/settings');assert.equal(response.status,200);
      const html=await response.text();
      assert.ok(html.includes('\u914d\u7f6e\u7ba1\u7406'));
      assert.ok(html.includes('href="/settings/templates"'));
      assert.ok(!html.includes('href="/auth/login'));
      assert.deepEqual(await (await fetch(url+'/auth/session')).json(),{authenticated:false});
      const mark=await fetch(url+'/assets/brand/guanlan-mark.svg');assert.equal(mark.status,200);
      assert.ok(mark.headers.get('content-type').includes('image/svg+xml'));
    });
    await t.test("configuration keeps rules while legacy business task links preserve deep queries",async()=>{
      for(const [from,to] of [['/settings/operations/aggregation','/operations/aggregation'],['/settings/operations/data-updates','/operations/data-updates'],['/settings/operations/reports','/reports/tasks'],['/operations/reports','/reports/tasks'],['/settings/overview','/preferences/overview']]) {
        const query='?task=a&task=b&job=a%2Fb&kind=export&city=610100&county=610113';
        const redirect=await fetch(url+from+query,{redirect:'manual'});
        assert.equal(redirect.status,307);assert.equal(redirect.headers.get('location'),to+query);
        const response=await fetch(url+to);assert.equal(response.status,200);
      }
      const home=await(await fetch(url)).text();assert.ok(home.includes('href="/settings"'));
      for(const path of ['/settings/templates','/settings/metrics']) assert.ok(!home.includes('href="'+path+'"'));
      const settings=await(await fetch(url+'/settings')).text();
      for(const path of ['/settings/templates','/settings/metrics','/?city=all&amp;county=all']) assert.ok(settings.includes('href="'+path+'"'));
      for(const path of ['/operations/data-updates','/operations/aggregation','/reports/tasks','/preferences/overview']) assert.ok(!settings.includes('href="'+path+'"'));
      const catalog=await(await fetch(url+'/settings/metrics')).text();assert.ok(catalog.includes('\u53ea\u8bfb\u89c4\u8303'));
      assert.ok(catalog.includes('service.voice.connected_seconds') || catalog.includes('\u901a\u8bdd\u65f6\u957f'));
      assert.ok(!catalog.includes('data-overview-display-settings'));
    });
    await t.test("business parameter definitions are public reference catalogs without policy write actions",async()=>{
      for(const [path,title,code] of [['/settings/classifications','\u7ad9\u5740\u5206\u7c7b','ground'],['/settings/rules','\u5206\u6790\u89c4\u5219','capacity.load']]) {
        const response=await fetch(url+path);assert.equal(response.status,200);
        const html=await response.text(), headings=html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/g)??[];
        assert.equal(headings.length,1);assert.ok(headings[0].includes(title));assert.ok(html.includes(code));
        assert.ok(html.includes('\u53ea\u8bfb\u76ee\u5f55'));
        assert.ok(!html.includes('SX-DEMO-'));assert.ok(!html.includes('>\u53d1\u5e03<'));assert.ok(!html.includes('>\u7f16\u8f91<'));
      }
      const rules=await(await fetch(url+'/settings/rules')).text();assert.ok(rules.includes('\u4e1a\u52a1\u7b7e\u8ba4'));
      const settings=await(await fetch(url+'/settings')).text();
      for(const path of ['/settings/classifications','/settings/rules'])assert.ok(settings.includes('href="'+path+'"'));
    });
    await t.test("protected evidence and platform routes fail closed without configuration",async()=>{
      assert.equal((await fetch(url+"/api/measurements?workspaceId=forged")).status,401);
      const aggregate=await fetch(url+"/api/aggregates?workspaceId=forged");assert.equal(aggregate.status,401);
      assert.equal(aggregate.headers.get('cache-control'),'no-store');assert.equal(aggregate.headers.get('x-content-type-options'),'nosniff');
      const rollup=await fetch(url+'/api/aggregates/rollups?workspaceId=forged');assert.equal(rollup.status,401);assert.equal(rollup.headers.get('cache-control'),'no-store');
      const report=await fetch(url+'/api/reports/forged?workspaceId=forged');assert.equal(report.status,401);assert.equal(report.headers.get('cache-control'),'no-store');
      const publication=await fetch(url+'/api/reports/forged/publication?eventRevision=1');assert.equal(publication.status,401);assert.equal(publication.headers.get('cache-control'),'no-store');
      const download=await fetch(url+'/api/report-exports/forged?format=html');assert.equal(download.status,401);assert.equal(download.headers.get('cache-control'),'no-store');
      const list=await fetch(url+'/api/reports');assert.equal(list.status,401);assert.equal(list.headers.get('cache-control'),'no-store');
      for(const path of ['/api/reports','/api/reports/forged/publication','/api/report-exports']) {
        const response=await fetch(url+path,{method:'POST',headers:{'content-type':'application/json',origin:url},body:'{}'});
        assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');
      }
      const reportsPage=await fetch(url+'/reports');assert.equal(reportsPage.status,200);assert.ok((await reportsPage.text()).includes('\u6b63\u5f0f\u62a5\u544a\u5c1a\u672a\u5f00\u653e'));
      const analysisPage=await fetch(url+'/analysis');assert.equal(analysisPage.status,200);assert.ok((await analysisPage.text()).includes('\u6b63\u5f0f\u5206\u6790\u5c1a\u672a\u5f00\u653e'));
      const templatesPage=await fetch(url+'/settings/templates');assert.equal(templatesPage.status,200);assert.ok((await templatesPage.text()).includes('\u6a21\u677f\u7ba1\u7406\u5c1a\u672a\u5f00\u653e'));
      for(const path of ['/api/templates','/api/templates/preview','/api/templates/selection']){const r=await fetch(url+path,{method:'POST',headers:{origin:url,'content-type':'application/json'},body:'{}'});assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'no-store');}
      assert.equal((await fetch(url+'/api/templates?code=forged')).status,401);
      for(const method of ['GET','POST']){const r=await fetch(url+'/api/analysis',{method,...(method==='POST'?{headers:{origin:url,'content-type':'application/json'},body:'{}'}:{})});assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');}
      for(const path of ['/api/aggregate-jobs','/api/aggregate-jobs/untrusted','/api/report-jobs?kind=generation','/api/report-jobs/untrusted?kind=export']){const r=await fetch(url+path);assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'no-store');}
      assert.equal((await fetch(url+'/api/aggregate-jobs/untrusted/recover',{method:'POST',headers:{origin:url,'content-type':'application/json'},body:'{}'})).status,401);
      const recovery=await fetch(url+'/api/report-jobs/untrusted/recover',{method:'POST',headers:{origin:url,'content-type':'application/json'},body:'{}'});assert.equal(recovery.status,401);assert.equal(recovery.headers.get('cache-control'),'no-store');assert.equal(recovery.headers.get('x-content-type-options'),'nosniff');
      const reportJobsPage=await fetch(url+'/operations/reports');assert.equal(reportJobsPage.status,200);assert.ok((await reportJobsPage.text()).includes('\u62a5\u544a\u4efb\u52a1\u5c1a\u672a\u5f00\u653e'));const jobsPage=await fetch(url+'/operations/aggregation');assert.equal(jobsPage.status,200);assert.ok((await jobsPage.text()).includes('\u4efb\u52a1\u5de5\u4f5c\u53f0\u5c1a\u672a\u5f00\u653e'));
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
      assert.equal((await fetch(url+"/api/product-preview/report-artifact?kind=calendar")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/period-comparison")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/reports?format=html")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/compare?sites=SX-DEMO-001")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/station/SX-DEMO-001")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/station/SX-DEMO-001/period")).status,404);
      assert.equal((await fetch(url+"/api/product-preview/station/SX-DEMO-001/period/report?format=html")).status,404);
      assert.equal((await fetch(url+"/api/product-preview",{method:"POST",body:JSON.stringify(request)})).status,404);
      const root=await fetch(url);assert.equal(root.status,200);assert.ok(!(await root.text()).includes("fixture-hourly-v1"));
      const formalRoot=await fetch(url,{redirect:'manual'});assert.equal(formalRoot.status,200);
      const formalHome=await formalRoot.text();assert.ok(formalHome.includes('\u8fd0\u884c\u603b\u89c8'));
      for(const sample of ['data-portal-mode','shaanxi-scenario-v1','SX-DEMO-','href="/product-preview'])assert.ok(!formalHome.includes(sample));
    });
    await t.test('site registry and dossiers never expose synthetic assets with preview disabled',async()=>{
      for(const path of ['/sites','/sites?view=relations','/sites/SX-DEMO-001?tab=resources']) {
        const response=await fetch(url+path);assert.equal(response.status,200);
        const html=await response.text();assert.ok(html.includes('\u5c1a\u672a\u5f00\u653e'));
        for(const sample of ['data-sites-mode="demo"','data-site-dossier-mode="demo"','TT-SX-DEMO-','bsmoss-site-registry-demo-v1','data-resource-relationships','bsmoss-site-resource-snapshot-v2']) assert.ok(!html.includes(sample));
      }
    });
    await t.test('station history evidence is inaccessible with preview disabled',async()=>{
      const r=await fetch(url+'/usage-review/history?site=SX-DEMO-001');assert.equal(r.status,404);
      assert.ok(!(await r.text()).includes('data-history-evidence'));
    });
    await t.test('historical cross-domain and reports are gated without weakening formal endpoints',async()=>{
      for(const path of ['/analysis/report','/api/product-preview/history-report'])assert.equal((await fetch(url+path)).status,404);
      for(const path of ['/capacity?history=1','/efficiency?history=1'])assert.ok(!(await (await fetch(url+path)).text()).includes('data-history-context'));
      assert.ok(!(await(await fetch(url+'/capacity')).text()).includes('data-capacity-contributions'));
      assert.ok(!(await(await fetch(url+'/efficiency')).text()).includes('data-runtime-energy'));
    });
    await t.test('cohort and operator analysis fail closed with preview disabled',async()=>{
      for(const view of ['operators','cohorts']) {
        const response=await fetch(url+'/analysis?view='+view);assert.equal(response.status,200);
        const html=await response.text();assert.ok(!html.includes('data-history-analysis'));assert.ok(!html.includes('data-history-'+view));assert.ok(!html.includes('bsmoss-history-v4'));
      }
    });
    await t.test('decision board fails closed with preview disabled',async()=>{
      const response=await fetch(url+'/board');assert.equal(response.status,200);
      const html=await response.text();assert.ok(html.includes('\u51b3\u7b56\u5206\u6790\u5c1a\u672a\u5f00\u653e'));
      for(const sample of ['data-board-mode="demo"','shaanxi-scenario-v1','SX-DEMO-','href="/product-preview'])assert.ok(!html.includes(sample));
    });
  });
  await withServer(true,async url=>{
    await t.test('preview never substitutes sample identities for formal intake supervision',async()=>{
      const id='a'.repeat(64);
      for(const [path,method] of [['/api/intake-tasks','GET'],['/api/intake-tasks/'+id,'GET'],['/api/intake-tasks/'+id+'/terminate','POST']]) {
        const r=await fetch(url+path,{method,...(method==='POST'?{headers:{origin:url,'content-type':'application/json'},body:'{}'}:{})});
        assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'private, no-store');
      }
    });
    await t.test('preview cannot borrow formal update task or recovery permissions',async()=>{
      const id='a'.repeat(64);
      for(const [path,method] of [['/api/data-updates','GET'],['/api/data-updates','POST'],['/api/data-updates/'+id,'GET'],['/api/data-updates/'+id+'/retry','POST']]) {
        const r=await fetch(url+path,{method,...(method==='POST'?{headers:{origin:url,'content-type':'application/json'},body:'{}'}:{})});
        assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'no-store');
      }
      const html=await(await fetch(url+'/operations/data-updates?task='+id)).text();
      assert.ok(html.includes('\u4efb\u52a1\u5de5\u4f5c\u53f0\u5c1a\u672a\u5f00\u653e')); assert.ok(!html.includes('received_evidence'));
      assert.ok(html.includes('href="/operations/aggregation"'));assert.ok(!html.includes('href="/settings/templates"'));
    });
    await t.test('availability reads stable independent source watermarks without creating jobs',async()=>{
      for(const family of ['overview','station','calendar','history','verification']) {
        const endpoint=url+'/api/product-preview/data-availability?family='+family,r=await fetch(endpoint);
        assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');
        const data=await r.json();assert.equal(data.family,family);assert.equal(data.schema,'bsmoss-data-availability-v1');
        assert.ok(data.sources.every(s=>s.syncedAt===null&&s.confirmed));
        assert.deepEqual(await(await fetch(endpoint)).json(),data);
        assert.equal((await fetch(endpoint,{method:'POST',body:'{}'})).status,405);
      }
      for(const query of ['','?family=forged','?family=station&family=history','?family=station&workspaceId=forged','?family=station&through=2030-01-01'])assert.equal((await fetch(url+'/api/product-preview/data-availability'+query)).status,400);
    });
    await t.test('analysis headings separate current data availability from selected analysis time',async()=>{
      for(const [path,cutoff] of [['/','2026-10-26 00:00'],['/sites?hour=12&city=610100','2026-10-26 00:00'],['/capacity?hour=12','2026-10-26 00:00'],['/efficiency?hour=18','2026-10-26 00:00'],['/operator-usage?period=month','2026-11-01 00:00'],['/usage-reports?period=week','2026-11-01 00:00'],['/analysis?city=610100&range=month&month=2026-09','2026-11-01 00:00'],['/usage-review?period=week','2026-11-01 00:00']]) {
        const r=await fetch(url+path);assert.equal(r.status,200);const html=await r.text();
        assert.ok(html.includes('\u6570\u636e\u66f4\u65b0\u81f3'),path);assert.ok(html.includes(cutoff),path);assert.ok(html.includes('\u66f4\u65b0\u6570\u636e'));
        assert.equal((html.match(/aria-label="\u67e5\u770b\u6570\u636e\u66f4\u65b0\u8be6\u60c5"/g)||[]).length,1,path);
      }
    });
    await t.test('runtime energy coverage stays scoped, unallocated and isolated from history and formal APIs',async()=>{
      const html=await(await fetch(url+'/efficiency?city=610100&county=610113&hour=3')).text();
      for(const marker of ['data-runtime-energy','bsmoss-runtime-energy-coverage-v1','\u6570\u636e\u8986\u76d6\u4e0e\u672a\u77e5\u539f\u56e0','\u533a\u57df\u8fd0\u884c\u5bf9\u6bd4','2026-10-25'])assert.ok(html.includes(marker),marker);
      assert.match(html,/<option value="3" selected="">03:00<\/option>/);
      const power=await(await fetch(url+'/efficiency?topic=power&search=SX-DEMO-004&hour=12')).text();assert.ok(power.includes('data-runtime-energy'));assert.ok(power.includes('SX-DEMO-004'));
      const op=await(await fetch(url+'/efficiency?operator=mobile')).text();assert.ok(op.includes('\u8fd0\u8425\u5546\u5206\u8868\u672a\u91c7\u96c6'));assert.ok(op.includes('\u8fd0\u8425\u5546\u7535\u8017\u672a\u5206\u644a'));
      const empty=await(await fetch(url+'/efficiency?search=not-found')).text();assert.ok(empty.includes('\u5f53\u524d\u8303\u56f4\u6682\u65e0\u7ad9\u5740'));
      const invalid=await(await fetch(url+'/efficiency?energy=forged')).text();assert.ok(invalid.includes('role="alert"'));assert.ok(!invalid.includes('data-runtime-energy'));
      const history=await(await fetch(url+'/efficiency?history=1&site=SX-DEMO-001')).text();assert.ok(history.includes('data-history-context'));assert.ok(!history.includes('data-runtime-energy'));
      assert.equal((await fetch(url+'/api/measurements')).status,401);
    });
    await t.test('capacity contributions retain exact scope, source, independent mode and formal boundary',async()=>{
      const html=await(await fetch(url+'/capacity?city=610100&county=610113&operator=telecom&hour=20&search=SX-DEMO-001')).text();
      for(const text of ['data-capacity-contributions','bsmoss-capacity-contributions-v1','\u672a\u63a5\u901a\u8d21\u732e','\u98ce\u9669\u7ed3\u6784\u4e0e\u8986\u76d6','\u91cd\u70b9\u7ad9\u5740\u8bc1\u636e','2026-10-25','SX-DEMO-001'])assert.ok(html.includes(text),text);
      assert.match(html,/<option value="20" selected="">20:00<\/option>/);
      assert.ok(!html.includes('role="alert"'));assert.ok(!html.includes('<canvas'));assert.ok(html.includes('target="_blank"'));
      const empty=await(await fetch(url+'/capacity?search=not-found')).text();assert.ok(empty.includes('data-capacity-contributions'));assert.ok(empty.includes('\u5f53\u524d\u8303\u56f4\u6682\u65e0\u7ad9\u5740'));
      const invalid=await(await fetch(url+'/capacity?capacity=forged')).text();assert.ok(invalid.includes('role="alert"'));assert.ok(!invalid.includes('data-capacity-contributions'));
      const history=await(await fetch(url+'/capacity?history=1&site=SX-DEMO-001')).text();assert.ok(history.includes('data-history-context'));assert.ok(!history.includes('data-capacity-contributions'));
      assert.equal((await fetch(url+'/api/measurements')).status,401);
    });
    await t.test('resource relationships separate equipment unknowns, observation time and unverified validity',async()=>{
      for(const tab of ['resources','services']){
        const response=await fetch(url+'/sites/SX-DEMO-001?tab='+tab+'&operator=telecom&hour=12');assert.equal(response.status,200);
        const html=await response.text();
        for(const text of ['data-resource-relationships','bsmoss-site-resource-snapshot-v2','SX-DEMO-001-telecom','SX-DEMO-001-R2','2026-10-25 12:00','\u5f85\u6765\u6e90\u6838\u5b9e','\u672a\u91c7\u96c6'])assert.ok(html.includes(text),text);
        assert.ok(!html.includes('\u6d6e\u5145'));assert.ok(!html.includes('\u653e\u7535\u4e2d'));
      }
      const invalid=await(await fetch(url+'/sites/SX-DEMO-001?tab=resources&validFrom=2025-01-01')).text();assert.ok(invalid.includes('role="alert"'));assert.ok(!invalid.includes('data-resource-relationships'));
      assert.equal((await fetch(url+'/api/measurements')).status,401);
    });
    await t.test('investigation routes preserve the bounded origin, exact station and distinct evidence sources',async()=>{
      const origin='/usage-review/UV-8d664440f0a922d512b7614f?period=month&recordSession=8c3b637a-e53c-4038-80d7-f0aba583748d&event=5';
      const investigation=encodeURIComponent(JSON.stringify({v:1,href:origin}));
      for(const path of ['/sites/SX-DEMO-001?tab=business','/operator-usage?period=week','/analysis?site=SX-DEMO-001&range=month&month=2026-10','/usage-review/history?site=SX-DEMO-001&range=month&month=2026-10','/capacity?history=1&site=SX-DEMO-001','/analysis/report?site=SX-DEMO-001']){
        const response=await fetch(url+path+'&investigation='+investigation);assert.equal(response.status,200,path);const html=await response.text();assert.ok(html.includes('data-investigation'),path);assert.ok(html.includes('event=5'),path);assert.ok(html.includes('recordSession='),path);assert.ok(!html.includes('role="alert"'),path);
      }
      const exact=await(await fetch(url+'/usage-review?site=DEMO-00037&period=month&investigation='+investigation)).text();assert.ok(exact.includes('DEMO-00037'));assert.ok(exact.includes('data-investigation'));assert.ok(exact.includes('\u5f53\u524d\u8303\u56f4\u6682\u65e0\u6838\u9a8c\u7ebf\u7d22'));
      const map=await(await fetch(url+'/product-preview?hour=7&investigation='+investigation)).text();assert.ok(map.includes('data-investigation'));assert.ok(map.includes('event=5'));
      for(const origin of ['https://evil.example','/settings','/sites?city=610100&county=610300','/sites?investigation=x','/sites?city=all&city=610100']){
        const bad=encodeURIComponent(JSON.stringify({v:1,href:origin}));const html=await(await fetch(url+'/sites?investigation='+bad)).text();assert.ok(html.includes('role="alert"'));assert.ok(!html.includes('data-site-dossier-mode'));assert.equal((await fetch(url+'/product-preview?investigation='+bad)).status,404);
      }
      assert.equal((await fetch(url+'/api/product-preview/review-events',{method:'POST',body:'{}'})).status,404);
    });

    await t.test('local report library gates files, exact digest, preview and existing formal endpoints',async()=>{
      const list=await(await fetch(url+'/reports?city=610100&county=610113')).text();assert.ok(list.includes('data-local-report-library'));assert.ok(list.includes('\u6b63\u5728\u8bfb\u53d6\u62a5\u544a\u5e93'));
      const invalid=await(await fetch(url+'/reports?saved=forged')).text();assert.ok(invalid.includes('role="alert"'));
      const period='city=610100&county=610113&operator=mobile&period=week';
      const page=await(await fetch(url+'/usage-reports?'+period)).text();assert.ok(page.includes('\u4fdd\u5b58\u5230\u62a5\u544a\u5e93'));
      const report=await(await fetch(url+'/api/product-preview/reports?cityId=610100&countyId=610113&operator=mobile&period=week')).json();
      const digest=(await import('node:crypto')).createHash('sha256').update(JSON.stringify(report,null,2)).digest('hex');
      const endpoint=url+'/api/product-preview/report-artifact?kind=calendar&'+period+'&snapshot='+digest;
      const result=await fetch(endpoint);assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');
      const artifact=await result.json(),f=JSON.parse(artifact.content);assert.deepEqual(JSON.parse(f.json),report);assert.equal(f.period,'week');assert.ok(f.html.includes(report.id));
      assert.equal((await import('node:crypto')).createHash('sha256').update(artifact.content).digest('hex'),artifact.digest);
      assert.equal((await fetch(endpoint.replace(digest,'0'.repeat(64)))).status,409);
      for(const extra of ['&snapshot=x','&operator=telecom','&actor=forged','&investigation=forged'])assert.equal((await fetch(endpoint+extra)).status,400);
      assert.equal((await fetch(url+'/api/product-preview/report-artifact?kind=calendar&'+period)).status,400);
      const historical=await(await fetch(url+'/api/product-preview/report-artifact?kind=history&city=610100&county=610113&range=month&month=2026-10&snapshot='+('0'.repeat(64)))).status;assert.equal(historical,409);
      assert.equal((await fetch(url+'/api/reports')).status,401);assert.equal((await fetch(endpoint,{method:'POST',body:'{}'})).status,405);
    });
    await t.test('local review workflow renders no invented events and validates event/session routing',async()=>{
      const list=await(await fetch(url+'/usage-review?period=month')).text();
      const id=list.match(/\/usage-review\/(UV-[a-f0-9]{24})/)?.[1];assert.ok(id);
      const records=await(await fetch(url+'/review-history')).text();assert.ok(records.includes('data-review-history'));assert.ok(records.includes('\u6b63\u5728\u8bfb\u53d6\u8bb0\u5f55'));
      const detail=await(await fetch(url+'/usage-review/'+id+'?period=month')).text();assert.ok(detail.includes('\u539f\u56e0\u4e0e\u590d\u6838'));assert.ok(detail.includes('name="')||detail.includes('aria-label="'));
      for(const query of ['recordSession=forged','recordSession='+ '-'.repeat(36),'event=0','event=1&event=2','recordSession=x&workspace=forged']){
        const html=await(await fetch(url+'/usage-review/'+id+'?'+query)).text();assert.ok(html.includes('role="alert"'));assert.ok(!html.includes('aria-label="\u539f\u56e0\u4e0e\u590d\u6838\u64cd\u4f5c"'));
      }
      const invalidList=await(await fetch(url+'/usage-review?recordSession='+ '-'.repeat(36))).text();assert.ok(invalidList.includes('role="alert"'));
      const bad=await(await fetch(url+'/review-history?recordSession=forged')).text();assert.ok(bad.includes('\u7b5b\u9009\u6761\u4ef6\u65e0\u6548'));
      assert.equal((await fetch(url+'/api/product-preview/review-events',{method:'POST',body:'{}'})).status,404);
    });
    await t.test('historical reports pin exact context, all members and offline counters across cross-domain views',async()=>{
      const scope='city=610100&county=610113&range=custom&from=2026-10-25&to=2026-10-25&metric=bytes&view=cohorts&band=upper&page=2';
      const page=await (await fetch(url+'/analysis/report?'+scope)).text();assert.ok(page.includes('data-history-report'));
      const digest=page.match(/data-report-snapshot="([a-f0-9]{64})"/)?.[1];assert.ok(digest);
      const endpoint=url+'/api/product-preview/history-report?'+scope+'&snapshot='+digest;
      const jsonResponse=await fetch(endpoint+'&format=json');assert.equal(jsonResponse.status,200);assert.equal(jsonResponse.headers.get('x-bsmoss-snapshot'),digest);
      const report=await jsonResponse.json();assert.equal(report.digest,digest);assert.equal(report.payload.data.scope.band,'upper');assert.equal(report.payload.data.scope.page,2);
      const members=report.payload.data.cross.members;assert.equal(members.length,report.payload.data.physicalSites);
      for(const key of ['bytes','voiceSeconds','sms'])assert.equal(members.reduce((n,r)=>n+BigInt(r.values[key]),0n),BigInt(report.payload.data.totals[key]));
      const htmlResponse=await fetch(endpoint+'&format=html');assert.equal(htmlResponse.status,200);assert.match(htmlResponse.headers.get('content-disposition'),/attachment; filename="bsmoss-HR-/);
      assert.match(htmlResponse.headers.get('content-security-policy'),/default-src 'none'/);const html=await htmlResponse.text();
      const raw=html.match(/<script id="bsmoss-history-snapshot" type="application\/json">([\s\S]*?)<\/script>/)?.[1];assert.deepEqual(JSON.parse(raw),report);
      for(const kind of ['capacity','efficiency']){const cross=await (await fetch(url+'/'+kind+'?history=1&'+scope)).text();assert.ok(cross.includes('data-history-context'));assert.ok(cross.includes('from=2026-10-25'));assert.ok(cross.includes('band=upper'));}
      assert.equal((await fetch(endpoint.replace(digest,'0'.repeat(64))+'&format=html')).status,409);
      for(const extra of ['&format=pdf','&snapshot=duplicate','&returnTo=https://evil.example','&site=forged','&month=2026-10'])assert.equal((await fetch(endpoint+extra)).status,400);
      assert.equal((await fetch(url+'/api/product-preview/history-report?'+scope)).status,400);
      assert.equal((await fetch(url+'/api/analysis')).status,401);assert.equal((await fetch(url+'/api/reports')).status,401);
    });
    await t.test('single-station history and verification share exact evidence scope, references and return context',async()=>{
      const scope='city=610100&county=610113&site=SX-DEMO-001&range=month&month=2026-10&evidence=2026-10-25&slot=18&operator=mobile&peerLevel=province';
      const panel=await (await fetch(url+'/analysis?'+scope)).text();assert.ok(panel.includes('data-station-history'));assert.ok(panel.includes('/usage-review/history?'));
      const evidenceResponse=await fetch(url+'/usage-review/history?'+scope);assert.equal(evidenceResponse.status,200);
      const evidence=await evidenceResponse.text();assert.ok(evidence.includes('data-history-evidence'));assert.ok(evidence.includes('bsmoss-demo-calendar-v3'));assert.ok(!evidence.includes('bsmoss-demo-review-scenarios-v1'));
      const digest=panel.match(/HE-[a-f0-9]{24}/)?.[0];assert.ok(digest);assert.ok(evidence.includes(digest));assert.ok(evidence.includes('peerLevel=province'));assert.ok(evidence.includes('slot=18'));
      const early=await (await fetch(url+'/usage-review/history?site=SX-DEMO-001&range=month&month=2024-11&evidence=2024-11-01&slot=0')).text();assert.ok(early.includes('\u8d85\u51fa\u5386\u53f2\u8986\u76d6'));assert.ok(early.includes('\u57fa\u7ebf\u4e0d\u8db3'));
      for(const query of ['site=SX-DEMO-001&slot=24','site=SX-DEMO-001&evidence=2024-10-31','evidence=2026-10-25','site=SX-DEMO-001&returnTo=https://evil.example','site=SX-DEMO-001&city=610300','site=forged']) {
        const invalid=await (await fetch(url+'/usage-review/history?'+query)).text();assert.ok(invalid.includes('\u6838\u9a8c\u6761\u4ef6\u65e0\u6548'));assert.ok(!invalid.includes('data-history-evidence'));
      }
      assert.equal((await fetch(url+'/usage-review/history?site=SX-DEMO-001&scene=mountain')).status,404);
      assert.equal((await fetch(url+'/api/analysis')).status,401);
    });
    await t.test('operator and cohort workspaces preserve scope, distributions and strict filters',async()=>{
      const base='/analysis?city=610100&county=610113&range=month&month=2026-10';
      const operators=await (await fetch(url+base+'&view=operators')).text();assert.ok(operators.includes('data-history-operators'));assert.ok(!operators.includes('data-history-cohorts'));assert.ok(operators.includes('bsmoss-history-v4'));
      const cohorts=await (await fetch(url+base+'&view=cohorts&groupBy=sharing&band=growth&sort=decline&page=2')).text();assert.ok(cohorts.includes('data-history-cohorts'));assert.ok(cohorts.includes('data-cohort-members'));assert.ok(!cohorts.includes('data-history-operators'));
      const empty=await (await fetch(url+base+'&view=cohorts&scene=urban&siteType=ground')).text();assert.ok(empty.includes('data-history-cohorts'));assert.ok(!empty.includes('data-history-operators'));
      const old=await (await fetch(url+'/analysis?view=operators&range=month&month=2024-11&city=610100&county=610113')).text();assert.ok(old.includes('data-history-operators'));assert.ok(old.includes('\u5f53\u524d\u8303\u56f4\u65e0\u53ef\u7528\u540c\u6bd4\u8d21\u732e'));
      for(const query of ['view=invalid','groupBy=operator','scene=invalid','siteType=invalid','sharing=shared','band=invalid','sort=invalid','page=0','view=cohorts&view=operators']) {
        const invalid=await (await fetch(url+base+'&'+query)).text();assert.ok(invalid.includes('\u5206\u6790\u6761\u4ef6\u65e0\u6548'));assert.ok(!invalid.includes('data-history-analysis'));
      }
      assert.equal((await fetch(url+'/api/analysis')).status,401);
    });
    await t.test("annual business analysis exposes scoped history, validates windows and preserves incomplete baselines",async()=>{
      const r=await fetch(url+'/analysis?city=all&county=all');assert.equal(r.status,200);
      const html=await r.text();assert.ok(html.includes('data-history-analysis'));assert.ok(html.includes('2025-11-01'));
      assert.ok(html.includes('\u5730\u5e02\u7ecf\u8425\u5bf9\u6bd4'));assert.ok(!html.includes('maplibregl-canvas'));
      const county=await (await fetch(url+'/analysis?city=610100&county=610113&range=month&month=2026-10')).text();
      assert.ok(county.includes('\u7ad9\u5740\u7ecf\u8425\u5bf9\u6bd4'));assert.ok(county.includes('2026-10-01'));
      const invalid=await (await fetch(url+'/analysis?city=610300&county=610113')).text();
      assert.ok(invalid.includes('\u5206\u6790\u6761\u4ef6\u65e0\u6548'));assert.ok(!invalid.includes('data-history-analysis'));
      const old=await (await fetch(url+'/analysis?range=month&month=2024-11&city=610100&county=610113')).text();
      assert.ok(old.includes('\u7f3a\u5c11\u5b8c\u6574\u4e0a\u5e74\u540c\u671f\u57fa\u671f'));
    });
    await t.test("remembered regions scope the first server render and explicit links take precedence",async()=>{
      const headers={cookie:'bsmoss-region-v1-preview=v1.610000.610100.610113'};
      for(const path of ['/','/sites','/capacity','/board','/usage-review','/product-preview']) {
        const response=await fetch(url+path,{headers});assert.equal(response.status,200);
        const html=await response.text();
        if(path!=='/product-preview') assert.ok(html.includes('aria-label="\u9009\u62e9\u533a\u57df\uff1a\u9655\u897f\u7701\u00b7\u897f\u5b89\u5e02\u00b7\u96c1\u5854\u533a"'),path);
        if(path==='/sites') {assert.ok(html.includes('16 \u5ea7\u7ad9\u5740'));assert.ok(!html.includes('SX-DEMO-003'));}
      }
      const explicit=await (await fetch(url+'/sites?city=610300',{headers})).text();
      assert.ok(explicit.includes('140 \u5ea7\u7ad9\u5740'));assert.ok(!explicit.includes('aria-label="\u9009\u62e9\u533a\u57df\uff1a\u9655\u897f\u7701\u00b7\u897f\u5b89\u5e02\u00b7\u96c1\u5854\u533a"'));
      const reset=await (await fetch(url+'/sites?city=all&county=all',{headers})).text();assert.ok(reset.includes('1,080 \u5ea7\u7ad9\u5740'));
      const invalid=await (await fetch(url+'/sites?city=610300&county=610113',{headers})).text();assert.ok(invalid.includes('\u7ad9\u5740\u7b5b\u9009\u65e0\u6548'));
    });
    await t.test("usage review list and evidence are independent, strictly scoped and preserve return context",async()=>{
      const response=await fetch(url+'/usage-review');assert.equal(response.status,200);
      const html=await response.text();assert.ok(html.includes('data-usage-review="list"'));
      assert.ok(html.includes('\u6f14\u793a\u8bb0\u5f55\u00b7\u672c\u673a'));assert.ok(!html.includes('maplibregl-canvas'));
      const match=html.match(/href="(\/usage-review\/UV-[a-f0-9]{24}\?[^"]+)"/);assert.ok(match);
      const detailPath=match[1].replaceAll('&amp;','&');
      const detail=await (await fetch(url+detailPath)).text();
      assert.ok(detail.includes('data-usage-review="detail"'));assert.ok(detail.includes('bsmoss-demo-review-scenarios-v1'));
      assert.ok(detail.includes('\u56db\u5468\u53c2\u8003\u539f\u503c'));assert.ok(detail.includes('\u7cbe\u786e\u539f\u59cb\u8ba1\u6570'));
      assert.ok(!detail.includes('maplibregl-canvas'));assert.ok(detail.includes('/usage-review?'));
      const other=await fetch(url+detailPath+'&selection='+encodeURIComponent('circle:105,32,1000'));assert.equal(other.status,404);
      assert.equal((await fetch(url+'/usage-review/UV-'+'0'.repeat(24))).status,404);
      for(const invalid of ['period=hour','city=610300&county=610113','city=610100&city=610200','workspaceId=forged','page=0']) {
        const invalidHtml=await (await fetch(url+'/usage-review?'+invalid)).text();assert.ok(invalidHtml.includes('\u6838\u9a8c\u7b5b\u9009\u65e0\u6548'));assert.ok(!invalidHtml.includes('data-usage-review="list"'));
      }
      const empty=await (await fetch(url+'/usage-review?status=closed')).text();assert.ok(empty.includes('\u5f53\u524d\u8303\u56f4\u6682\u65e0\u6838\u9a8c\u7ebf\u7d22'));
      const month=await (await fetch(url+'/usage-review?period=month&page=2')).text();assert.ok(month.includes('data-usage-review="list"'));
    });
    await t.test('standalone business modules render without maps and link to scoped map analysis',async()=>{
      const scope='city=610100&county=610113&operator=mobile&hour=17&search=SX-DEMO-006&selection='+encodeURIComponent('circle:108.95,34.26,10000');
      for(const kind of ['capacity','efficiency','operator-usage','usage-reports']) {
        const period=kind==='operator-usage'||kind==='usage-reports'?'&period=week':'';
        const response=await fetch(url+'/'+kind+'?'+scope+period);assert.equal(response.status,200);
        const html=await response.text();assert.ok(html.includes('data-business-analysis="'+kind+'"'));assert.ok(html.includes('SX-DEMO-006'));
        assert.ok(html.includes('/product-preview?city=610100'));assert.ok(html.includes('search=SX-DEMO-006'));
        assert.ok(!html.includes('maplibregl-canvas'));assert.ok(!html.includes('mw-map-loading'));
        assert.ok(!html.includes('aria-label="\\u'));assert.ok(!html.includes('>\\u'));
      }
      for(const kind of ['capacity','efficiency','operator-usage','usage-reports']) for(const query of ['city=110100','county=610113','city=610100&city=610200','workspaceId=forged','hour=24','search='+('a'.repeat(81))]) {
        const html=await (await fetch(url+'/'+kind+'?'+query)).text();
        assert.ok(html.includes('\u7b5b\u9009\u65e0\u6548'));assert.ok(!html.includes('data-business-analysis='));
      }
      const home=await (await fetch(url+'/')).text();
      for(const path of ['/capacity','/efficiency','/operator-usage','/usage-reports'])assert.ok(home.includes('href="'+path));
    });
    await t.test('site business pages support geographic relations and six dossier layers without formal access',async()=>{
      const list=await (await fetch(url+'/sites?city=610100&county=610113&operator=telecom')).text();
      assert.ok(list.includes('data-sites-mode="demo"'));assert.ok(list.includes('/sites/SX-DEMO-001'));
      assert.ok(list.includes('data-slot="input-group"'));assert.ok(!list.includes('aria-label="\u72b6\u6001\u65f6\u6bb5"'));
      const firstRead=list.match(/<time\b[^>]*dateTime="([^"]+)"/i)[1];assert.ok(Number.isFinite(Date.parse(firstRead)));
      const reread=await (await fetch(url+'/sites?city=610100&county=610113&operator=telecom')).text();
      assert.equal(reread.match(/<time\b[^>]*dateTime="([^"]+)"/i)[1],firstRead);
      assert.equal((reread.match(/<time\b/g)??[]).length,1);
      const rooftop=await (await fetch(url+'/sites?siteType=rooftop&search=SX-DEMO-001&hour=17')).text();
      assert.ok(rooftop.includes('/sites/SX-DEMO-001'));assert.ok(rooftop.includes('2026-10-25 17:00'));
      const ground=await (await fetch(url+'/sites?siteType=ground&search=SX-DEMO-001')).text();
      assert.ok(!ground.includes('href="/sites/SX-DEMO-001'));
      const relations=await (await fetch(url+'/sites?view=relations&search=SX-DEMO-001')).text();
      assert.ok(relations.includes('SX-DEMO-001-mobile'));assert.ok(relations.includes('SX-DEMO-001-telecom'));
      for(const tab of ['overview','resources','services','runtime','business','sources']) {
        const response=await fetch(url+'/sites/SX-DEMO-001?tab='+tab+'&period=month');assert.equal(response.status,200);
        const html=await response.text();assert.ok(html.includes('data-site-dossier-mode="demo"'));assert.ok(html.includes('SX-DEMO-001'));
      }
      assert.equal((await fetch(url+'/sites/unknown')).status,404);
      for(const query of ['siteType=indoor','siteType=ground&siteType=rooftop','city=110100','county=610113','city=610100&city=610200','workspaceId=forged','hour=24']) {
        const html=await (await fetch(url+'/sites?'+query)).text();
        assert.ok(!html.includes('data-sites-mode="demo"'));assert.ok(html.includes('\u7b5b\u9009\u65e0\u6548'));
      }
      assert.equal((await fetch(url+'/api/measurements')).status,401);
    });
    await t.test('synthetic preview never grants formal aggregate access or falls back to sample results',async()=>{
      assert.equal((await fetch(url+'/api/templates?code=qa-page')).status,401);
      assert.equal((await fetch(url+'/api/analysis?at=2026-11-03T00%3A00%3A00Z')).status,401);
      const response=await fetch(url+'/api/aggregates?sourceId=src&mappingId=map&metricCode=service.data.uplink_bytes&metricVersion=1&grain=day&at=2026-10-25T00%3A00%3A00Z');
      assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(response.headers.get('vary').split(',').map(s=>s.trim().toLowerCase()).includes('cookie'));
      const body=await response.json();assert.equal(body.code,'AUTH_REQUIRED');assert.ok(!JSON.stringify(body).includes('9007199254740993'));
      const rollup=await fetch(url+'/api/aggregates/rollups?rollupId=fixture&grain=day&at=2026-10-25T00%3A00%3A00Z');assert.equal(rollup.status,401);assert.equal(rollup.headers.get('x-content-type-options'),'nosniff');assert.ok(rollup.headers.get('vary').toLowerCase().includes('cookie'));assert.equal((await rollup.json()).code,'AUTH_REQUIRED');
      const report=await fetch(url+'/api/reports/demo-report?revision=1');assert.equal(report.status,401);assert.equal(report.headers.get('x-content-type-options'),'nosniff');assert.ok(report.headers.get('vary').toLowerCase().includes('cookie'));assert.equal((await report.json()).code,'AUTH_REQUIRED');
      const publication=await fetch(url+'/api/reports/demo-report/publication');assert.equal(publication.status,401);assert.equal(publication.headers.get('x-content-type-options'),'nosniff');assert.ok(publication.headers.get('vary').toLowerCase().includes('cookie'));assert.equal((await publication.json()).code,'AUTH_REQUIRED');
      const exported=await fetch(url+'/api/report-exports/demo-job?format=html');assert.equal(exported.status,401);assert.equal(exported.headers.get('x-content-type-options'),'nosniff');assert.ok(exported.headers.get('vary').toLowerCase().includes('cookie'));assert.equal((await exported.json()).code,'AUTH_REQUIRED');
      for(const path of ['/api/report-jobs?kind=export','/api/report-jobs/untrusted?kind=generation'])assert.equal((await fetch(url+path)).status,401);assert.equal((await fetch(url+'/operations/reports')).status,200);assert.equal((await fetch(url+'/api/aggregate-jobs?status=dead')).status,401);assert.equal((await fetch(url+'/api/aggregate-jobs/demo-job/recover',{method:'POST',headers:{origin:url,'content-type':'application/json'},body:'{}'})).status,401);
    });
    await t.test("overview scopes its business summaries and leaves map navigation to the launcher",async()=>{
      const root=await fetch(url,{redirect:"manual"});assert.equal(root.status,200);
      const home=await root.text();assert.ok(home.includes('data-portal-mode="demo"'));assert.ok(home.includes('2026-10-25'));
      assert.ok(home.includes('data-overview-attention="capacity"'));assert.ok(home.includes('data-overview-verification'));
      assert.ok(home.includes('data-overview-report="day"'));assert.ok(home.includes('bsmoss-demo-review-scenarios-v1'));
      assert.ok(home.includes('data-overview-metrics="bsmoss-overview-metrics-v1"'));
      assert.ok(home.includes('\u6570\u636e\u66f4\u65b0\u81f3'));assert.ok(home.includes('2026-10-26 00:00'));assert.ok(home.includes('\u72b6\u6001\u65f6\u70b9 18:00'));assert.ok(!home.includes('\u81ea\u52a8\u65f6\u6bb5'));
      assert.ok(!home.includes('\u5168\u65e5 00:00\u201324:00 \u00b7 \u65f6\u70b9'));
      assert.ok(home.includes('\u8f83\u6628\u65e5'));
      const settings=await (await fetch(url+'/preferences/overview')).text();assert.ok(settings.includes('data-overview-display-settings'));
      const config=await (await fetch(url+'/settings')).text();assert.ok(!config.includes('href="/preferences/overview"'));assert.ok(config.includes('href="/settings/metrics"'));
      for(const period of ['week','month']) {
        const report=await (await fetch(url+'/?reportPeriod='+period)).text();
        assert.ok(report.includes('data-overview-report="'+period+'"'));
        assert.ok(report.includes('period='+period+'&amp;format=html'));
      }
      assert.ok(!home.includes('href="/product-preview?hour=18"'));assert.ok(!home.includes('maplibregl-canvas'));
      const scoped=await (await fetch(url+'/?city=610100&county=610113')).text();
      assert.ok(scoped.includes('href="/sites?city=610100&amp;county=610113"'));
      assert.ok(scoped.includes('data-overview-structure="bytes"'));
      assert.ok(!scoped.includes('/sites/DEMO-00419'));
      for(const query of ['city=110100','county=610113','city=610100&city=610200','workspaceId=forged','hour=12','reportPeriod=year','reportPeriod=day&reportPeriod=week']) {
        const invalid=await (await fetch(url+'/?'+query)).text();
        assert.ok(invalid.includes('\u603b\u89c8\u8303\u56f4\u65e0\u6548'));assert.ok(!invalid.includes('data-portal-mode="demo"'));
      }
      const page=await fetch(url+"/product-preview");assert.equal(page.status,200);
      const html=await page.text();assert.ok(html.includes("SX-DEMO-001"));assert.ok(html.includes("shaanxi-scenario-v1"));
    });
    await t.test('decision board is independent, scoped and has no default station selection',async()=>{
      const response=await fetch(url+'/board');assert.equal(response.status,200);
      const html=await response.text();assert.ok(html.includes('data-board-mode="demo"'));assert.ok(html.includes('2026-10-25'));
      assert.ok(html.includes('\u51b3\u7b56\u5206\u6790'));assert.ok(!html.includes('mw-app mw-hud'));
      const scoped=await (await fetch(url+'/board?city=610100&hour=12')).text();
      assert.ok(scoped.includes('12:00'));assert.ok(scoped.includes('/product-preview?hour=12&amp;city=610100'));
      for(const query of ['city=110100','hour=24','hour=12&hour=18','workspaceId=forged']){
        const invalid=await (await fetch(url+'/board?'+query)).text();
        assert.ok(invalid.includes('\u51b3\u7b56\u5206\u6790\u7b5b\u9009\u65e0\u6548'));assert.ok(!invalid.includes('data-board-mode="demo"'));
      }
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
