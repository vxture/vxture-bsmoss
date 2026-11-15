import {build} from 'esbuild';
import {builtinModules} from 'node:module';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts/maintenance',{recursive:true});
const result=await build({entryPoints:['scripts/database/demo-cli.mjs'],outfile:'artifacts/maintenance/demo.cjs',
 bundle:true,platform:'node',target:'node22',format:'cjs',metafile:true,external:['pg-native'],
 define:{'import.meta.url':'"bundled-demo-maintenance"'},logLevel:'warning'});
const builtins=new Set(builtinModules.flatMap(name=>[name,'node:'+name]));
const imports=Object.values(result.metafile.outputs).flatMap(output=>output.imports.filter(item=>item.external).map(item=>item.path));
if(imports.some(name=>name!=='pg-native'&&!builtins.has(name)))throw Error('demo_unbundled_dependency');
console.log('[demo-build] standalone maintenance CLI compiled');
