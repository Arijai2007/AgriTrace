import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runtimeConfig } from '../server/config.mjs';
const run = promisify(execFile), root = resolve(import.meta.dirname, '..');

test('hosted startup requires a stable JWT secret and binds on the hosting interface', () => {
  assert.throws(() => runtimeConfig({ NODE_ENV: 'production' }), /JWT_SECRET/);
  const config = runtimeConfig({ RENDER: 'true', JWT_SECRET: 'x'.repeat(48), PORT: '10000', TRUST_PROXY_HOPS: '1' });
  assert.equal(config.host, '0.0.0.0'); assert.equal(config.port, 10000); assert.equal(config.trustProxyHops, 1);
  assert.equal(runtimeConfig({}).host, '127.0.0.1');
  assert.throws(() => runtimeConfig({ TRUST_PROXY_HOPS: 'true' }), /TRUST_PROXY_HOPS/);
  assert.throws(() => runtimeConfig({ PORT: 'invalid' }), /PORT/);
});

test('Render-style startup seeds the configured file, preserves changes and keeps sign-ins valid across restart', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'agritrace-hosted-'));
  const file = join(directory, 'persistent', 'ledger.json');
  const env = { ...process.env, NODE_ENV: 'production', LEDGER_MODE: 'demo', DATA_FILE: file, HOST: '127.0.0.1', PORT: '0', TRUST_PROXY_HOPS: '1', JWT_SECRET: 'hosted-test-secret-with-more-than-32-characters', DEMO_PASSWORD: 'classroom-test-password' };
  let child;
  async function stop() { if (child && child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; } child = undefined; }
  t.after(async () => { await stop(); await rm(directory, { recursive: true, force: true }); });
  async function start() {
    child = spawn(process.execPath, ['server/index.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    return new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Hosted startup timed out: ' + output)), 15000);
      child.stderr.on('data', data => { output += data; });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error('Hosted process exited: ' + code + ' ' + output)); });
      child.stdout.on('data', data => { output += data; const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/); if (match) { clearTimeout(timeout); resolve('http://127.0.0.1:' + match[1]); } });
    });
  }
  await run(process.execPath, ['server/seed.mjs'], { cwd: root, env });
  let base = await start();
  assert.equal((await fetch(base + '/api/health')).status, 200);
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.17' }, body: JSON.stringify({ id: 'farmer-1', password: env.DEMO_PASSWORD }) });
  assert.equal(login.status, 200); const { token } = await login.json();
  const batches = JSON.parse(await readFile(file, 'utf8')); assert.equal(batches.length, 3);
  const created = await fetch(base + '/api/batches', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'AGR-HOSTED', crop: 'Demo wheat', quantity: 10, price: 20, organic: false, harvestDate: new Date().toISOString().slice(0, 10), location: { name: 'Demo farm', lat: 28, lng: 77 } }) });
  assert.equal(created.status, 201);
  await stop();
  await run(process.execPath, ['server/seed.mjs'], { cwd: root, env });
  assert.equal(JSON.parse(await readFile(file, 'utf8')).length, 4, 'Reseeding must preserve user-created batches');
  base = await start();
  assert.equal((await fetch(base + '/api/me', { headers: { Authorization: 'Bearer ' + token } })).status, 200);
  assert.equal((await (await fetch(base + '/api/trace/AGR-HOSTED')).json()).verification.valid, true);
  const rejected = await run(process.execPath, ['server/seed.mjs'], { cwd: root, env: { ...env, LEDGER_MODE: 'fabric' } }).then(() => false, () => true);
  assert.equal(rejected, true, 'Fabric must never receive demo seed records');
});
