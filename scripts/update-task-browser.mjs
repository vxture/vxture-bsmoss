// Isolated loopback component harness. Synthetic HTTP records only; never
// mounts product routes, uses real auth, connects a DB or executes workers.
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';
const root = resolve('portals/app'), id = 'a'.repeat(64), other = 'b'.repeat(64);
const summary = { id, kind: 'received_evidence', partitionId: 'Shaanxi usage / reviewed source', partitionRevision: '1', createdAt: '2026-11-06T06:00:00.000Z' };
let phase = 'recomputing', changed = false, unavailable = false, retryMode = 'ok', savedCommand = null, postCount = 0, detailReads = 0;
const bundle = await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Workspace from './app/operations/data-updates/workspace.tsx';createRoot(document.getElementById('root')).render(<Workspace/>);`, resolveDir: root, loader: 'tsx' }, absWorkingDir: root, bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
const script = bundle.outputFiles[0].text;
const css = readdirSync(join(root, '.next/static/css')).filter(x => x.endsWith('.css')).map(x => readFileSync(join(root, '.next/static/css', x), 'utf8')).join('\n');
function detail(taskId) {
  const fail = phase === 'failed';
  return { ...summary, id: taskId, configurationChanged: changed, publishesAvailability: false,
    progress: { phase, inputs: { total: 8, dispatched: fail ? 7 : 8, blocked: fail ? 1 : 0 }, results: { total: 12, succeeded: phase === 'processed' ? 12 : 7, failed: fail ? 1 : 0, running: phase === 'recomputing' ? 1 : 0, waiting: phase === 'recomputing' ? 4 : 0 },
      failures: fail ? [{ kind: 'input', id: 'input-fixture', code: 'evidence_invalid', canRetry: true, expectedRevision: '5', retryAt: null }, { kind: 'result', id: 'result-fixture', code: 'source_unavailable', canRetry: true, expectedAttempt: 5 }] : [] } };
}
const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  res.setHeader('cache-control', 'no-store');
  const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (u.pathname === '/qa/state') {
    phase = u.searchParams.get('phase') ?? phase; changed = u.searchParams.get('changed') === '1'; unavailable = u.searchParams.get('denied') === '1'; retryMode = u.searchParams.get('retry') ?? 'ok'; savedCommand = null; postCount = 0;
    return json(200, { phase, changed, unavailable, retryMode });
  }
  if (u.pathname === '/qa/stats') return json(200, { postCount, detailReads, savedCommand });
  if (u.pathname === '/bundle.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(script); }
  if (u.pathname === '/styles.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(css); }
  if (u.pathname.startsWith('/_next/static/media/')) {
    const name = u.pathname.split('/').at(-1); if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return json(404, {});
    try { res.writeHead(200, { 'content-type': name.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream' }); return res.end(readFileSync(join(root, '.next/static/media', name))); } catch { return res.end(); }
  }
  if (u.pathname === '/api/data-updates') return unavailable ? json(403, {}) : json(200, { items: [summary, { ...summary, id: other, partitionId: 'Second received evidence task' }], next: null });
  if (u.pathname === '/api/data-updates/' + id + '/retry' && req.method === 'POST') {
    let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 4096) return json(413, {}); }
    const command = JSON.parse(text); postCount++;
    if (retryMode === 'conflict') return json(409, {});
    if (savedCommand && JSON.stringify(savedCommand) !== JSON.stringify(command)) return json(409, {});
    savedCommand = command;
    if (retryMode === 'uncertain' && postCount === 1) return json(503, {});
    phase = 'dispatching'; return json(202, { status: 'reopened' });
  }
  if (u.pathname.startsWith('/api/data-updates/')) { detailReads++; return unavailable ? json(403, {}) : json(200, detail(u.pathname.split('/').at(-1))); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html class="dark" lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><title>Isolated update task QA</title><body class="bg-background text-foreground"><div class="flex flex-wrap gap-sm p-md border-b border-border" id="qa"><span>ISOLATED QA</span>${['recomputing','failed','processed','uncertain','conflict','changed','denied'].map(x => `<button class="border border-border rounded-md px-sm" data-mode="${x}">QA ${x}</button>`).join('')}<span id="qa-state"></span></div><div class="product-workspace"><main class="product-workspace-content" id="root"></main></div><script>document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=async()=>{let m=b.dataset.mode;let q=['uncertain','conflict'].includes(m)?'phase=failed&retry='+m:m==='changed'?'phase=failed&changed=1':m==='denied'?'denied=1':'phase='+m;await fetch('/qa/state?'+q);document.getElementById('qa-state').textContent=m;});</script><script src="/bundle.js"></script></body></html>`);
});
server.listen(63334, '127.0.0.1', () => console.log('Isolated update task QA: http://127.0.0.1:63334/'));
