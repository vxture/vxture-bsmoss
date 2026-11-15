import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {pageMetadata} from './page-metadata';
const root=path.resolve('portals/app/app');
function pages(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?pages(path.join(dir,e.name)):e.name==='page.tsx'?[path.join(dir,e.name)]:[]);}
test('every page inherits a registered module browser title',()=>{
 for(const file of pages(root)){
  let dir=path.dirname(file);
  while(dir!==root&&!existsSync(path.join(dir,'layout.tsx')))dir=path.dirname(dir);
  assert.ok(dir!==root||file===path.join(root,'page.tsx'),'Missing module layout: '+file);
  const owner='/'+path.relative(root,dir).replaceAll('\\','/');
  const title=(pageMetadata(owner).title as {absolute:string}).absolute;
  assert.ok(title.startsWith('BSMOSS \u00b7 '),file);
  if(dir!==root)assert.match(readFileSync(path.join(dir,'layout.tsx'),'utf8'),/pageMetadata\(/,file);
  assert.doesNotMatch(readFileSync(file,'utf8'),/export (?:const metadata|(?:async )?function generateMetadata)/,file);
 }
});
test('detail and analysis views keep module ownership',()=>{
 for(const [a,b] of [['/sites','/sites/123'],['/reports','/reports/new'],['/product-preview','/product-preview/copyright'],['/tower-service/judgment','/tower-service/network'],['/tower-service/services','/usage-review/123']])assert.deepEqual(pageMetadata(a),pageMetadata(b));
});


