import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {relative,resolve,sep} from 'node:path';
import {getPool} from '../../lib/db';
import {authenticatedDemoEnabled} from '../../lib/demo-mode';
import type {Pool,PoolClient} from 'pg';

export async function readPgDemoArtifact(client:Pick<Pool|PoolClient,'query'>,dataset:string,path:string):Promise<Buffer> {
 if(!/^[a-f0-9]{64}$/.test(dataset))throw Error('demo_dataset_unconfigured');
 const result=await client.query<{digest:string|null;content:string|null}>(
  `SELECT a.digest,a.content FROM bsmoss_demo.dataset d LEFT JOIN bsmoss_demo.artifact a
   ON a.dataset_id=d.id AND a.path=$2 WHERE d.id=$1 AND d.status='ready'`,[dataset,path]);
 if(!result.rows.length)throw Error('demo_dataset_not_ready');
 const row=result.rows[0];
 if(row.content===null)throw Object.assign(Error('demo_artifact_not_installed'),{code:'ENOENT'});
 const bytes=Buffer.from(row.content,'base64');
 if(createHash('sha256').update(bytes).digest('hex')!==row.digest)throw Error('demo_artifact_corrupt');
 return bytes;
}

// A dataset is pinned for the process lifetime. Publication never changes it.
export async function readDemoArtifact(file:string,root:string):Promise<Buffer> {
 if(!authenticatedDemoEnabled())return readFile(file);
 const storage=process.env.BSMOSS_DEMO_STORAGE??'file';
 if(!['file','postgres'].includes(storage))throw Error('invalid_demo_storage');
 if(storage==='file')return readFile(file);
 const dataset=process.env.BSMOSS_DEMO_DATASET??'';
 if(!/^[a-f0-9]{64}$/.test(dataset))throw Error('demo_dataset_unconfigured');
 const path=relative(resolve(root),resolve(file)).split(sep).join('/');
 if(path.startsWith('../')||path==='..'||path.startsWith('/'))throw Error('invalid_demo_artifact_path');
 return readPgDemoArtifact(getPool(),dataset,path);
}
