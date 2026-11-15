import {readdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import pg from 'pg';
import {pathToFileURL} from 'node:url';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function inspectBundle(root) {
 const files=[];
 async function walk(directory,prefix='') {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
   const path=prefix+entry.name;
   if(entry.isDirectory())await walk(join(directory,entry.name),path+'/');
   else if(entry.isFile() && /(?:\.json\.gz|\.summaries-v3\.gz)$/.test(path)) {
    const bytes=await readFile(join(root,path));
    files.push({path,digest:hash(bytes),bytes});
   }
  }
 }
 await walk(root);files.sort((a,b)=>a.path<b.path?-1:1);
 const sources=files.filter(f=>/^tower-demo-history-v1-[a-f0-9]{64}\.json\.gz$/.test(f.path));
 if(sources.length!==1)throw Error('exactly_one_demo_history_required');
 const source=sources[0],raw=JSON.parse(gunzipSync(source.bytes));
 const daily=Buffer.from(raw.daily,'base64');
 if(raw.version!=='tower-demo-history-v1'||!Number.isInteger(raw.days)||raw.days<=0||!Array.isArray(raw.relations)||
    !raw.relations.length||daily.length!==raw.relations.length*raw.days*4)throw Error('invalid_demo_source');
 const summaries=files.find(f=>f.path===source.path+'.summaries-v3.gz');
 if(!summaries)throw Error('demo_summaries_required');
 const rollups=JSON.parse(gunzipSync(summaries.bytes));
 if(rollups.sourceDigest!==source.digest||hash(JSON.stringify(rollups.rows))!==rollups.digest||
    hash(JSON.stringify(rollups.rules))!==rollups.rulesDigest)throw Error('invalid_demo_summaries');
 if(!files.some(f=>f.path==='published.json.gz')||!files.some(f=>f.path.startsWith('pages/'))||!files.some(f=>f.path.startsWith('monitoring-v1/')))throw Error('demo_read_models_required');
 const manifest=files.map(({path,digest})=>({path,digest}));
 const {daily:ignored,...metadata}=raw;
 return {id:hash(JSON.stringify(manifest)),manifest,files,source,daily,metadata,rollups:rollups.rows};
}
async function locked(client,id,run) {
 await client.query('BEGIN');
 try {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('bsmoss-demo:'||$1,0))",[id]);
  const result=await run();await client.query('COMMIT');return result;
 }catch(error){await client.query('ROLLBACK');throw error;}
}
export async function verify(client,bundle) {
 const result=await client.query('SELECT count(*)::text AS count,coalesce(sum(quantity),0)::text AS total FROM bsmoss_demo.daily_fact WHERE dataset_id=$1',[bundle.id]);
 let total=0n;for(let i=0;i<bundle.daily.length;i+=4)total+=BigInt(bundle.daily.readUInt32LE(i));
 if(result.rows[0].count!==String(bundle.daily.length/4)||result.rows[0].total!==String(total))throw Error('demo_fact_reconciliation_failed');
 const fingerprints=await client.query(`SELECT relation,count(*)::int AS count,min(day) AS first,max(day) AS last,
  encode(sha256(convert_to(string_agg(quantity::text,',' ORDER BY day),'UTF8')),'hex') AS digest
  FROM bsmoss_demo.daily_fact WHERE dataset_id=$1 GROUP BY relation ORDER BY relation`,[bundle.id]);
 if(fingerprints.rows.length!==bundle.metadata.relations.length)throw Error('demo_relation_reconciliation_failed');
 for(const row of fingerprints.rows){
  const values=[];
  for(let day=0;day<bundle.metadata.days;day++)values.push(bundle.daily.readUInt32LE((row.relation*bundle.metadata.days+day)*4));
  if(row.count!==bundle.metadata.days||row.first!==0||row.last!==bundle.metadata.days-1||hash(values.join(','))!==row.digest)
   throw Error('demo_fact_digest_mismatch');
 }
}
export async function seedDemo(client,bundle) {
 return locked(client,bundle.id,async()=>{
  const existing=await client.query('SELECT id FROM bsmoss_demo.dataset WHERE id=$1',[bundle.id]);
  if(existing.rows.length){await verify(client,bundle);return 'unchanged';}
  await client.query("INSERT INTO bsmoss_demo.dataset(id,source_digest,manifest,metadata,status) VALUES($1,$2,$3,$4,'seeded')",
   [bundle.id,bundle.source.digest,JSON.stringify(bundle.manifest),JSON.stringify(bundle.metadata)]);
  const size=10000,count=bundle.daily.length/4;
  for(let first=0;first<count;first+=size) {
   const relations=[],days=[],quantities=[];
   for(let i=first;i<Math.min(count,first+size);i++){
    relations.push(Math.floor(i/bundle.metadata.days));days.push(i%bundle.metadata.days);quantities.push(bundle.daily.readUInt32LE(i*4));
   }
   await client.query('INSERT INTO bsmoss_demo.daily_fact(dataset_id,relation,day,quantity) SELECT $1,* FROM unnest($2::integer[],$3::integer[],$4::bigint[])',
    [bundle.id,relations,days,quantities]);
  }
  await verify(client,bundle);return 'seeded';
 });
}
export async function rebuildDemo(client,bundle) {
 return locked(client,bundle.id,async()=>{
  const existing=await client.query('SELECT source_digest,status FROM bsmoss_demo.dataset WHERE id=$1 FOR UPDATE',[bundle.id]);
  if(!existing.rows.length||existing.rows[0].source_digest!==bundle.source.digest)throw Error('seed_demo_first');
  await verify(client,bundle);
  if(existing.rows[0].status==='ready')return 'unchanged';
  // Publish all read artifacts and period rows together; readers cannot see a partial release.
  for(let i=0;i<bundle.rollups.length;i+=1000){
   const rows=bundle.rollups.slice(i,i+1000);
   await client.query(`INSERT INTO bsmoss_demo.period_rollup(dataset_id,period_id,city,county,operator,payload)
    SELECT $1,v->>'id',v->>'city',v->>'county',v->>'operator',v FROM jsonb_array_elements($2::jsonb) v`,[bundle.id,JSON.stringify(rows)]);
  }
  for(const file of bundle.files)await client.query('INSERT INTO bsmoss_demo.artifact(dataset_id,path,digest,content) VALUES($1,$2,$3,$4)',
   [bundle.id,file.path,file.digest,file.bytes.toString('base64')]);
  await client.query("UPDATE bsmoss_demo.dataset SET status='ready' WHERE id=$1",[bundle.id]);
  await client.query('ANALYZE bsmoss_demo.daily_fact');
  await client.query('ANALYZE bsmoss_demo.period_rollup');
  await client.query('ANALYZE bsmoss_demo.artifact');
  return 'ready';
 });
}
export async function resetDemo(client,id) {
 if(!/^[a-f0-9]{64}$/.test(id))throw Error('explicit_dataset_id_required');
 return locked(client,id,async()=>{
  const result=await client.query('DELETE FROM bsmoss_demo.dataset WHERE id=$1 RETURNING id',[id]);
  return result.rowCount;
 });
}
export async function recomputeDemoRollups(bundle) {
 const {buildHistoryRollups}=await import('../../portals/app/app/domains/tower-service/history.ts');
 const daily=new Uint32Array(bundle.daily.buffer.slice(bundle.daily.byteOffset,bundle.daily.byteOffset+bundle.daily.byteLength));
 const rows=buildHistoryRollups({...bundle.metadata,daily});
 if(hash(JSON.stringify(rows))!==hash(JSON.stringify(bundle.rollups)))throw Error('demo_rollup_recomputation_mismatch');
 return {...bundle,rollups:rows};
}
async function main(){
 const [command,...args]=process.argv.slice(2);
 if(!['seed','rebuild','verify','reset'].includes(command)||args.length!==2||
    args[0]!== (command==='reset'?'--dataset':'--bundle'))throw Error('Usage: demo-data.mjs seed|rebuild|verify --bundle <prepared-directory> OR reset --dataset <digest>');
 const connectionString=process.env.BSMOSS_DEMO_ADMIN_URL;
 if(!connectionString)throw Error('BSMOSS_DEMO_ADMIN_URL_required');
 const client=new pg.Client({connectionString,application_name:'bsmoss-demo-maintenance'});
 await client.connect();
 try {
  if(command==='reset')console.log(JSON.stringify({dataset:args[1],deleted:await resetDemo(client,args[1])}));
  else {
   let bundle=await inspectBundle(resolve(args[1]));
   if(command==='rebuild')bundle=await recomputeDemoRollups(bundle);
   const status=command==='seed'?await seedDemo(client,bundle):command==='rebuild'?await rebuildDemo(client,bundle):await verify(client,bundle)??'verified';
   console.log(JSON.stringify({dataset:bundle.id,status,facts:bundle.daily.length/4,artifacts:bundle.files.length}));
  }
 }finally{await client.end();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{
 // Do not print connection strings or PostgreSQL statement parameters.
 console.error('demo maintenance failed:',error.code??error.message);process.exitCode=1;
});
