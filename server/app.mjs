import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { randomBytes, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import domain from '../chaincode/lib/domain.cjs';
import { publicAccount, passwordMatches } from './accounts.mjs';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
export function createApp({ ledger, accounts, secret = randomBytes(48).toString('hex'), ipfsApi = process.env.IPFS_API, clientDir = resolve(import.meta.dirname, '../client/dist'), trustProxyHops = 0 }) {
  const app = express(); app.disable('x-powered-by');
  // Only trust the configured number of hosting proxies, rather than all forwarded headers.
  app.set('trust proxy', trustProxyHops);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org'], connectSrc: ["'self'", 'https://*.tile.openstreetmap.org', 'https://*.infura.io', 'https://*.alchemy.com', 'https://ethereum-sepolia-rpc.publicnode.com'], objectSrc: ["'none'"] } } }));
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false }));
  const safe = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const auth = (req, res, next) => {
    try { const claims = jwt.verify((req.headers.authorization || '').replace(/^Bearer /, ''), secret, { algorithms: ['HS256'], issuer: 'agritrace', audience: 'agritrace-web' }); req.actor = accounts.find(a => a.id === claims.sub); if (!req.actor) throw new Error(); next(); }
    catch { res.status(401).json({ error: 'Please sign in again' }); }
  };
  app.get('/api/health', (req, res) => res.json({ status: 'ok', ledgerMode: ledger.mode, ipfsConfigured: Boolean(ipfsApi), anchorAddress: process.env.ANCHOR_ADDRESS || null }));
  app.get('/api/demo/accounts', (req, res) => ledger.mode === 'demo' ? res.json(accounts.map(publicAccount)) : res.status(404).json({ error: 'Demo login is disabled' }));
  app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, limit: 30 }), safe(async (req, res) => {
    const account = accounts.find(a => a.id === req.body.id);
    if (!account || !passwordMatches(req.body.password, account)) return res.status(401).json({ error: 'Incorrect account or password' });
    res.json({ user: publicAccount(account), token: jwt.sign({}, secret, { algorithm: 'HS256', subject: account.id, issuer: 'agritrace', audience: 'agritrace-web', expiresIn: '2h' }) });
  }));
  app.get('/api/me', auth, (req, res) => res.json(publicAccount(req.actor)));
  app.get('/api/participants', auth, (req, res) => res.json(accounts.map(publicAccount)));
  app.get('/api/batches', auth, safe(async (req, res) => res.json(await ledger.list())));
  app.post('/api/batches', auth, safe(async (req, res) => res.status(201).json(await ledger.create(req.body, req.actor))));
  // Consumer read access is deliberately public. No unauthenticated write endpoint exists.
  app.get('/api/trace/:id', safe(async (req, res) => {
    const batch = await ledger.get(req.params.id);
    res.json({ batch, verification: { valid: domain.verifyBatch(batch), root: batch.root, eventCount: batch.events.length, ledgerMode: ledger.mode, publicAnchor: false } });
  }));
  app.get('/api/trace/:id/proof/:index', safe(async (req, res) => {
    const b = await ledger.get(req.params.id), index = Number(req.params.index);
    const proof = domain.merkleProof(b.events, index);
    res.json({ algorithm: 'SHA-256 canonical JSON; sorted pairs hashed as concatenated lowercase hex text; duplicate odd leaf', event: b.events[index], proof, root: b.root, valid: domain.verifyProof(b.events[index], proof, b.root) });
  }));
  app.post('/api/batches/:id/:action', auth, safe(async (req, res, next) => {
    if (req.params.action === 'certificates') return next();
    const allowed = ['transfer', 'sensor', 'recall', 'complaint', 'resolveComplaint'];
    if (!allowed.includes(req.params.action)) return res.status(404).json({ error: 'Unknown action' });
    const input = { ...req.body };
    if (req.params.action === 'transfer') {
      const recipient = accounts.find(a => a.id === input.recipientId);
      if (!recipient) return res.status(400).json({ error: 'Choose a registered recipient' });
      input.recipient = publicAccount(recipient); delete input.recipientId;
    }
    res.json(await ledger.update(req.params.id, req.params.action, input, req.actor));
  }));
  app.post('/api/batches/:id/certificates', auth, upload.single('file'), safe(async (req, res) => {
    const batch = await ledger.get(req.params.id);
    if (batch.holder.id !== req.actor.id || batch.status !== 'active') return res.status(403).json({ error: 'Only the active batch holder can add a certificate' });
    if (!ipfsApi) return res.status(503).json({ error: 'Start IPFS and configure IPFS_API to upload certificates. Demo files are not presented as IPFS uploads.' });
    if (!req.file) return res.status(400).json({ error: 'Choose a certificate file (maximum 5 MB)' });
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(req.file.mimetype)) return res.status(400).json({ error: 'Only PDF, PNG and JPEG certificates are accepted' });
    const form = new FormData(); form.append('file', new Blob([req.file.buffer]), 'certificate');
    const response = await fetch(`${ipfsApi.replace(/\/$/, '')}/api/v0/add?pin=true&cid-version=1`, { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error('IPFS upload failed');
    const result = JSON.parse((await response.text()).trim().split('\n').at(-1));
    const input = { name: req.body.name || req.file.originalname, type: req.body.type || 'Lab test', issuer: req.body.issuer, cid: result.Hash, sha256: createHash('sha256').update(req.file.buffer).digest('hex') };
    res.status(201).json(await ledger.update(batch.id, 'certificate', input, req.actor));
  }));
  if (existsSync(clientDir)) { app.use(express.static(clientDir)); app.get('/{*path}', (req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(resolve(clientDir, 'index.html'))); }
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error, req, res, next) => {
    const message = error.message || 'Request failed';
    const status = error instanceof multer.MulterError ? 400 : /not found/i.test(message) ? 404 : /Only |Unverified/.test(message) ? 403 : /integrity|IPFS upload failed/.test(message) ? 500 : 400;
    // Do not reveal gateway credentials, filesystem paths or stack traces.
    const safeMessage = /grpc|endorse|deadline|ENOENT|UNAVAILABLE/i.test(message) ? 'Fabric gateway unavailable. Check the network and identity configuration.' : message;
    res.status(status).json({ error: safeMessage.slice(0, 500) });
  });
  return app;
}
