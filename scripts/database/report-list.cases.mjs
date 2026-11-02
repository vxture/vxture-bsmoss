import assert from 'node:assert/strict';
import { PgReportStore } from '../../portals/app/app/domains/reports/pg-store.ts';
import { createAuthorizedReports } from '../../portals/app/app/domains/access/reports.ts';
import { FIRST_METRICS } from '../../portals/app/app/domains/catalog/first-metrics.ts';

export async function reportListCases(t,{db,adapterPool,access,scope,api,sms,up,putTemplate,panel,intercept}) {
  const make=(currentScope,pool=adapterPool,change=()=>{})=>{
    let reads=0;
    const ports={...access,async readLocalGrant(){reads++;change(reads);return {...await access.readLocalGrant(),scope:currentScope};}};
    return createAuthorizedReports(ports,{create:s=>new PgReportStore(pool,s)},'interactive');
  };
  const minimal={...scope,sourceIds:[],stationIds:[],serviceIds:[],deviceIds:[],metricKeys:[sms.code+'@1'],allowSiteParameters:false};
  const ids=[];
  for(let i=0;i<5;i++) {
    const code='report-list-sms-'+i;
    await putTemplate(code,{schema:'periodic-report-template-v1',title:code,grain:'day',panels:[panel('sms',sms)],bindings:[{panelId:'sms',kind:'not_connected'}]});
    ids.push((await api.generate({templateCode:code,templateVersion:1,at:'2026-12-01T00:00:00+08:00',expectedRevision:null})).record.reportId);
  }
  await putTemplate('report-list-hidden',{schema:'periodic-report-template-v1',title:'Hidden report',grain:'day',panels:[panel('up',up)],bindings:[{panelId:'up',kind:'not_connected'}]});
  const hidden=(await api.generate({templateCode:'report-list-hidden',templateVersion:1,at:'2026-12-02T00:00:00+08:00',expectedRevision:null})).record;
  await t.test('report list applies every finite scope before paging, fills pages behind hidden newer rows and orders equal periods without duplicates',async()=>{
    const allowed=(await db.query(`SELECT r.report_id,r.manifest FROM bsmoss_analysis.report_series s JOIN bsmoss_analysis.report_revision r
      ON (r.workspace_id,r.report_id,r.revision)=(s.workspace_id,s.id,s.current_revision) WHERE s.workspace_id='w' ORDER BY s.period_start DESC,s.id COLLATE "C" DESC`)).rows
      .filter(r=>['sourceIds','stationIds','serviceIds','deviceIds','metricKeys'].every(k=>r.manifest.requiredScope[k].every(id=>minimal[k].includes(id)))&&!r.manifest.requiredScope.allowSiteParameters).map(r=>r.report_id);
    const reader=make(minimal),seen=[];let after;
    do {
      const page=await reader.list({limit:2,...(after?{after}:{})});
      assert.ok(page.items.length>0);assert.ok(page.items.length<=2);
      for(const item of page.items){assert.ok(allowed.includes(item.reportId));assert.notEqual(item.reportId,hidden.reportId);assert.equal(item.freshness,'unchecked');assert.equal(item.capturedCompleteness,'incomplete');assert.ok(!('manifest' in item));seen.push(item.reportId);}
      if(page.next)assert.equal(page.items.length,2);after=page.next;
    }while(after);
    assert.deepEqual(seen,allowed);assert.deepEqual(seen.slice(0,5),[...ids].sort().reverse());assert.equal(new Set(seen).size,allowed.length);
    assert.deepEqual(await new PgReportStore(adapterPool,{...minimal,workspaceId:'absent-workspace'}).list({limit:20},async()=>{}),{items:[],next:null});
  });
  await t.test('report list filters source station service device metric and physical-site authority against complete historical scope',async()=>{
    const rows=(await db.query(`SELECT r.report_id,r.manifest FROM bsmoss_analysis.report_series s JOIN bsmoss_analysis.report_revision r
      ON (r.workspace_id,r.report_id,r.revision)=(s.workspace_id,s.id,s.current_revision) WHERE s.workspace_id='w' ORDER BY s.period_start DESC,s.id COLLATE "C" DESC`)).rows;
    for(const key of ['sourceIds','stationIds','serviceIds','deviceIds','metricKeys']) {
      const s={...scope,[key]:[]},expected=rows.filter(r=>['sourceIds','stationIds','serviceIds','deviceIds','metricKeys'].every(k=>r.manifest.requiredScope[k].every(id=>s[k].includes(id)))&&(!r.manifest.requiredScope.allowSiteParameters||s.allowSiteParameters)).map(r=>r.report_id),seen=[];
      const reader=make(s);let after;
      do{const page=await reader.list({limit:3,...(after?{after}:{})});seen.push(...page.items.map(i=>i.reportId));after=page.next;}while(after);
      assert.deepEqual(seen,expected,key);
    }
  });
  await t.test('report pages revalidate only the required union and discard data on final scope authority or identity changes',async()=>{
    const current=structuredClone(minimal);
    const reader=make(current,adapterPool,n=>{if(n===2)current.metricKeys=[];});await assert.rejects(reader.list({limit:2}),/report_scope_denied/);
    const unrelated=structuredClone(scope),allowed=make(unrelated,adapterPool,n=>{if(n===2){unrelated.sourceIds=[];unrelated.stationIds=[];unrelated.serviceIds=[];unrelated.deviceIds=[];unrelated.metricKeys=[sms.code+'@1'];}});
    // Page 1 contains only the five newer sms entries when hidden up is filtered.
    unrelated.metricKeys=[sms.code+'@1'];assert.equal((await allowed.list({limit:2})).items.length,2);
    const denied={...access,async readLocalGrant(){const g=await access.readLocalGrant();return {...g,permissions:[]};}};
    await assert.rejects(createAuthorizedReports(denied,{create:s=>new PgReportStore(adapterPool,s)},'interactive').list({limit:2}),/permission_denied/);
  });
  await t.test('physical station reports require the independent site-parameter flag even when all identifier lists match',async()=>{
    const energy={code:'runtime.energy.site_wh',version:1},def=FIRST_METRICS.get(energy);
    await db.query(`INSERT INTO bsmoss_catalog.metric_version VALUES ($1,1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[energy.code,def.category,def.semantic,def.unit,def]);
    await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,version,valid_from,valid_to)
      VALUES ('w','report-list-site-map','report-src','station','report-list-site-map','st',1,'2026-01-01Z','2027-01-01Z')`);
    await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w','report-list-energy-cap','report-src',$1,1,'day','active','fixture://report-list-reviewed',$2,'2026-01-01Z','2027-01-01Z')`,
      [energy.code,{intervalAggregation:{version:1,inputMode:'direct',authorityRef:'fixture://report-list-energy'}}]);
    await putTemplate('report-list-physical',{schema:'periodic-report-template-v1',title:'Physical energy',grain:'day',panels:[{...panel('energy',energy),displayUnit:'Wh'}],bindings:[{panelId:'energy',kind:'aggregate',sourceId:'report-src',mappingId:'report-list-site-map'}]});
    const physicalScope={...scope,metricKeys:[energy.code+'@1'],allowSiteParameters:true},reader=make(physicalScope);
    const record=(await reader.generate({templateCode:'report-list-physical',templateVersion:1,at:'2026-07-06T00:00:00+08:00',expectedRevision:null})).record;
    assert.equal(record.manifest.requiredScope.allowSiteParameters,true);assert.equal((await reader.list({limit:25})).items[0].reportId,record.reportId);
    assert.deepEqual(await make({...physicalScope,allowSiteParameters:false}).list({limit:25}),{items:[],next:null});
  });
  await t.test('report list never masks corrupt manifests or SQL failures as an empty page',async()=>{
    const broken=intercept((c,sql,args)=>sql.includes('ORDER BY s.period_start DESC')?c.query('SELECT * FROM report_list_fixture_missing'):c.query(sql,args));
    await assert.rejects(make(minimal,broken).list({limit:2}),e=>e.code==='42P01');
    const corrupt=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(sql.includes('ORDER BY s.period_start DESC')&&result.rows.length)result.rows[0].manifest_sha256='0'.repeat(64);return result;});
    await assert.rejects(make(minimal,corrupt).list({limit:2}),/invalid_report_record/);
  });
}
