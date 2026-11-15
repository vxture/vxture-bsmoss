import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from '../portals/app/node_modules/next/server.js';
import {middleware} from '../portals/app/middleware.ts';
test('demo fails closed without identity and preserves login callback / health routes',async()=>{
 const saved=process.env.BSMOSS_DATA_MODE;
 process.env.BSMOSS_DATA_MODE='demo';
 try{
  const page=await middleware(new NextRequest('http://localhost:3000/tower-service/services?city=610100'));
  assert.equal(page.status,307);assert.match(page.headers.get('location'),/\/entry\?returnTo=/);
  assert.equal((await middleware(new NextRequest('http://localhost:3000/api/product-preview/map'))).status,401);
  for(const path of ['/entry','/auth/login','/api/auth/oidc/callback','/api/health','/api/ready'])
   assert.equal((await middleware(new NextRequest('http://localhost:3000'+path))).status,200,path);
 }finally{if(saved===undefined)delete process.env.BSMOSS_DATA_MODE;else process.env.BSMOSS_DATA_MODE=saved;}
});
