import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
await mkdir('artifacts/worker', { recursive: true });
const result = await build({ entryPoints: ['portals/app/app/domains/workers/entry.ts'], outfile: 'artifacts/worker/worker.cjs',
  bundle: true, platform: 'node', target: 'node22', format: 'cjs', sourcemap: false, metafile: true,
  external: ['pg-native'], logLevel: 'warning' });
const builtins = new Set(builtinModules.flatMap(name => [name, 'node:' + name]));
const external = Object.values(result.metafile.outputs).flatMap(output => output.imports.filter(item => item.external).map(item => item.path));
if (external.some(name => name !== 'pg-native' && !builtins.has(name))) throw Error('worker_unbundled_dependency');
await writeFile('artifacts/worker/metafile.json', JSON.stringify(result.metafile, null, 2) + '\n');
console.log('[worker-build] standalone Node22 worker compiled; only builtins and unused optional pg-native remain external');
