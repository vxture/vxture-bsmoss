import {readFile} from 'node:fs/promises';
import pg from 'pg';
// Explicit additive schema application for an existing BS-MOSS database.
// This is separate from empty-database initialization and never runs at startup.
const connectionString=process.env.BSMOSS_DEMO_ADMIN_URL;
if(!connectionString)throw Error('BSMOSS_DEMO_ADMIN_URL_required');
const client=new pg.Client({connectionString});
try {
 await client.connect();
 await client.query('BEGIN');
 await client.query("SELECT pg_advisory_xact_lock(hashtextextended('bsmoss-demo-schema-v1',0))");
 const exists=await client.query("SELECT 1 FROM pg_namespace WHERE nspname='bsmoss_demo'");
 if(exists.rows.length)throw Error('demo_schema_already_exists_verify_before_applying');
 await client.query(await readFile(new URL('../../deploy/database/ddl/90_demo.sql',import.meta.url),'utf8'));
 await client.query('COMMIT');console.log('demo schema v1 applied; no demo data loaded');
} catch(error) {
 await client.query('ROLLBACK').catch(()=>{});
 console.error('demo schema failed:',error.code??error.message);process.exitCode=1;
} finally{await client.end();}
