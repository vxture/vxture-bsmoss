import pg from 'pg';
import assert from 'node:assert/strict';
import {inspectBundle,seedDemo,rebuildDemo,recomputeDemoRollups,verify} from './demo-data.mjs';
import {readPgDemoArtifact,readPgDemoPeriods} from '../../portals/app/app/domains/tower-service/demo-artifact.ts';

export function ownerConfiguration(values) {
 if(!Array.isArray(values)||values.some(v=>typeof v!=='string'))throw Error('invalid_db_environment');
 const env=Object.fromEntries(values.map(value=>{const at=value.indexOf('=');return [value.slice(0,at),value.slice(at+1)];}));
 if(!env.POSTGRES_USER||!env.POSTGRES_DB||!env.POSTGRES_PASSWORD)throw Error('owner_configuration_missing');
 return {host:'db',port:5432,user:env.POSTGRES_USER,database:env.POSTGRES_DB,password:env.POSTGRES_PASSWORD};
}
export async function run(command,configuration,root) {
 if(!['seed','rollup','verify','runtime-check'].includes(command))throw Error('invalid_demo_operation');
 let bundle=await inspectBundle(root);
 if(command==='rollup')bundle=await recomputeDemoRollups(bundle);
 if(command==='runtime-check' && process.env.BSMOSS_DEMO_DATASET!==bundle.id)throw Error('runtime_dataset_image_mismatch');
 const client=new pg.Client({...configuration,application_name:'bsmoss-demo-'+command,connectionTimeoutMillis:10000});
 await client.connect();
 try {
  let status;
  if(command==='seed')status=await seedDemo(client,bundle);
  else if(command==='rollup')status=await rebuildDemo(client,bundle);
  else if(command==='verify'){
   await verify(client,bundle);
   const state=await client.query("SELECT status FROM bsmoss_demo.dataset WHERE id=$1",[bundle.id]);
   assert.equal(state.rows[0]?.status,'ready');
   const artifacts=await client.query("SELECT path,digest,encode(sha256(decode(content,'base64')),'hex') AS actual FROM bsmoss_demo.artifact WHERE dataset_id=$1",[bundle.id]);
   assert.equal(artifacts.rowCount,bundle.manifest.length);
   const expected=new Map(bundle.manifest.map(file=>[file.path,file.digest]));
   for(const row of artifacts.rows){assert.equal(row.digest,expected.get(row.path));assert.equal(row.actual,row.digest);}
   const periods=await client.query('SELECT count(*)::int AS n FROM bsmoss_demo.period_rollup WHERE dataset_id=$1',[bundle.id]);
   assert.equal(periods.rows[0].n,bundle.rollups.length);status='verified';
  }else{
   const role=await client.query("SELECT current_user AS name,has_table_privilege(current_user,'bsmoss_demo.dataset','UPDATE') AS writable");
   assert.equal(role.rows[0].name,'bsmoss_svc');assert.equal(role.rows[0].writable,false);
   const file=bundle.files.find(f=>f.path.startsWith('pages/'));
   const started=performance.now();assert.deepEqual(await readPgDemoArtifact(client,bundle.id,file.path),file.bytes);
   const pageReadMs=Math.round((performance.now()-started)*100)/100;
   const period=bundle.rollups[0].id,at=performance.now();
   assert.ok((await readPgDemoPeriods(client,bundle.id,[period])).length);
   return {dataset:bundle.id,status:'runtime-verified',role:role.rows[0].name,pageReadMs,periodReadMs:Math.round((performance.now()-at)*100)/100};
  }
  return {dataset:bundle.id,status,facts:bundle.daily.length/4,periods:bundle.rollups.length,artifacts:bundle.files.length};
 }finally{await client.end();}
}
export async function main(){
 const command=process.argv[2];let configuration;
 if(command==='runtime-check'){
  if(process.env.BSMOSS_DEMO_STORAGE!=='postgres'||!process.env.DATABASE_URL)throw Error('runtime_postgres_not_configured');
  configuration={connectionString:process.env.DATABASE_URL};
 }else{
  const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
  configuration=ownerConfiguration(JSON.parse(Buffer.concat(chunks).toString('utf8')));
 }
 const result=await run(command,configuration,process.env.BSMOSS_DEMO_ROOT+'/demo-history');
 console.log(JSON.stringify(result));
}
