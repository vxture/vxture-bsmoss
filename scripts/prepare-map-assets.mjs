// Keep MapLibre workers and their relative shared module on the same local origin.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { mkdirSync, copyFileSync, readFileSync, existsSync } from 'node:fs';
const require=createRequire(new URL('../portals/app/package.json',import.meta.url));
const packageRoot=dirname(require.resolve('maplibre-gl/package.json'));
const {version}=JSON.parse(readFileSync(join(packageRoot,'package.json'),'utf8'));
const target=new URL('../portals/app/public/vendor/maplibre/',import.meta.url);
mkdirSync(target,{recursive:true});
for(const name of ['maplibre-gl-worker.mjs','maplibre-gl-shared.mjs'])copyFileSync(join(packageRoot,'dist',name),new URL(name,target));
for(const name of ['LICENSE.txt','LICENSE'])if(existsSync(join(packageRoot,name)))copyFileSync(join(packageRoot,name),new URL('LICENSE.txt',target));
console.log('Prepared local MapLibre worker assets '+version);
