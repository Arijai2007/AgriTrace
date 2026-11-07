// Exercise the built app using disposable records, without touching the demo workspace.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
const directory = await mkdtemp(join(tmpdir(), 'agritrace-smoke-')), root = resolve(import.meta.dirname, '..');
const env = { ...process.env, NODE_ENV: 'production', LEDGER_MODE: 'demo', HOST: '127.0.0.1', PORT: '0', DATA_FILE: join(directory, 'ledger.json'), TRUST_PROXY_HOPS: '1', JWT_SECRET: 'disposable-smoke-test-secret-with-32-characters', DEMO_PASSWORD: 'smoke-test-password' };
let child;
try {
  await promisify(execFile)(process.execPath, ['server/seed.mjs'], { cwd: root, env });
  child = spawn(process.execPath, ['server/index.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const base = await new Promise((resolve, reject) => {
    let output = ''; const timer = setTimeout(() => reject(new Error('Smoke startup timed out')), 15000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => { clearTimeout(timer); reject(new Error('Smoke server exited: ' + code + ' ' + output)); });
    child.stderr.on('data', data => { output += data; });
    child.stdout.on('data', data => { output += data; const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/); if (match) { clearTimeout(timer); resolve('http://127.0.0.1:' + match[1]); } });
  });
  for (const route of ['/', '/trace/AGR-2026-001']) {
    const response = await fetch(base + route); assert.equal(response.status, 200);
    assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', 'Map requests must retain an origin referrer');
    assert.ok(response.headers.get('content-security-policy').includes('https://tile.openstreetmap.org'), 'Map tile origin must be allowed');
    const html = await response.text(); assert.match(html, /<title>AgriTrace/);
    const asset = html.match(/src="([^"]+\.js)"/); assert.ok(asset, 'Built JavaScript must be present');
    assert.equal((await fetch(base + asset[1])).status, 200);
  }
  const trace = await (await fetch(base + '/api/trace/AGR-2026-001')).json(); assert.equal(trace.verification.valid, true);
  assert.equal((await fetch(base + '/api/not-a-real-route')).status, 404);
  console.log('Hosted smoke check passed: frontend, assets, public QR route and API share one server.');
} finally {
  if (child && child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
  await rm(directory, { recursive: true, force: true });
}
