// Loopback-only synthetic component QA; no product route, identity or DB.
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';
const root = resolve('portals/app');
let mode = 'recomputing', reads = 0;
const bundle = await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{ThemeProvider}from'@vxture/design-system';import Tools from './app/portal/header-tools.tsx';createRoot(document.getElementById('root')).render(<ThemeProvider defaultMode="dark"><Tools authenticated={true} loginEnabled={true}/></ThemeProvider>);`, resolveDir: root, loader: 'tsx' }, absWorkingDir: root, bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env': '{"NODE_ENV":"production"}' }, logLevel: 'silent' });
const css = readdirSync(join(root, '.next/static/css')).filter(x => x.endsWith('.css')).map(x => readFileSync(join(root, '.next/static/css', x), 'utf8')).join('\n');
function item(i) {
  const phase = ['failed', 'processed', 'dispatching'].includes(mode) ? mode : 'recomputing';
  return { id: String(i).repeat(64), kind: 'received_evidence', partitionId: i === 1 ? 'Shaanxi-usage-reviewed-source' : 'Secondary-reviewed-evidence', partitionRevision: '1', createdAt: '2026-11-06T06:00:00.000Z',
    configurationChanged: mode === 'changed', phase, publishesAvailability: false,
    inputs: { total: 8, dispatched: phase === 'failed' ? 7 : 8, blocked: phase === 'failed' ? 1 : 0 },
    results: { total: 12, succeeded: phase === 'processed' ? 12 : 7, failed: phase === 'failed' ? 1 : 0, running: phase === 'recomputing' ? 1 : 0, waiting: phase === 'recomputing' ? 4 : 0 } };
}
const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost'); res.setHeader('cache-control', 'no-store');
  const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (u.pathname === '/qa/state') { mode = u.searchParams.get('mode') ?? mode; if (mode.endsWith('-later')) { const later = mode.slice(0, -6); mode = 'recomputing'; setTimeout(() => { mode = later; }, 2000); } return json(200, { mode, reads }); }
  if (u.pathname === '/qa/stats') return json(200, { mode, reads });
  if (u.pathname === '/bundle.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(bundle.outputFiles[0].text); }
  if (u.pathname === '/styles.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(css); }
  if (u.pathname.startsWith('/_next/static/media/')) {
    const name = u.pathname.split('/').at(-1); if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return json(404, {});
    try { res.writeHead(200, { 'content-type': name.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream' }); return res.end(readFileSync(join(root, '.next/static/media', name))); } catch { return res.end(); }
  }
  if (u.pathname === '/api/data-updates/notifications') {
    reads++; if (mode === 'denied') return json(403, {}); if (mode === 'error') return json(503, {});
    return json(200, { items: mode === 'empty' ? [] : u.searchParams.has('after') ? [item(2)] : [item(1)], next: !u.searchParams.has('after') && mode !== 'empty' ? 'qa-next' : null });
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html class="dark" lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><title>Isolated task messages QA</title><body class="bg-background text-foreground"><header class="flex items-center justify-between gap-md p-lg border-b border-border"><span>ISOLATED QA</span><div id="root"></div></header><main class="p-xl"><h1 id="qa-heading" class="text-heading-2 break-all">${u.pathname === '/second' ? 'Second analysis page' : u.pathname.startsWith('/settings/') ? 'Exact task detail' : 'Analysis overview'}</h1><a class="text-primary" href="/second">QA second page</a><div class="flex flex-wrap gap-md py-lg">${['recomputing','failed','processed','changed','denied','error','empty','processed-later','denied-later','error-later'].map(x => `<button class="border border-border rounded-md px-md" data-mode="${x}">QA ${x}</button>`).join('')}<button id="stats">QA stats</button></div><p id="qa-state"></p></main><script>if(location.pathname.startsWith('/settings/')) document.getElementById('qa-heading').textContent='Exact task detail: '+(new URLSearchParams(location.search).get('task')??'none');document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=async()=>{const r=await fetch('/qa/state?mode='+b.dataset.mode);document.getElementById('qa-state').textContent=JSON.stringify(await r.json());});document.getElementById('stats').onclick=async()=>{const r=await fetch('/qa/stats');document.getElementById('qa-state').textContent=JSON.stringify(await r.json());};</script><script src="/bundle.js"></script></body></html>`);
});
server.listen(63334, '127.0.0.1', () => console.log('Isolated messages QA: http://127.0.0.1:63334/'));
