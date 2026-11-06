'use strict';
const { createHash } = require('node:crypto');
const ROLES = ['farmer', 'aggregator', 'transporter', 'processor', 'retailer', 'regulator'];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
function text(value, name, max = 160) {
  assert(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `Invalid ${name}`);
  return value.trim();
}
function number(value, name, min, max) {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, `Invalid ${name}`);
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const businessDate = timestamp => new Date(Date.parse(timestamp) + 19_800_000).toISOString().slice(0, 10);
const pairHash = (a, b) => hash(Buffer.compare(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')) <= 0 ? a + b : b + a);
function merkleRoot(events) {
  if (!events.length) return hash('');
  let level = events.map(e => hash(e));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(pairHash(level[i], level[i + 1] || level[i]));
    level = next;
  }
  return level[0];
}
function merkleProof(events, index) {
  assert(Number.isInteger(index) && index >= 0 && index < events.length, 'Invalid event index');
  let level = events.map(e => hash(e)); const proof = [];
  while (level.length > 1) {
    proof.push(level[index ^ 1] || level[index]);
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(pairHash(level[i], level[i + 1] || level[i]));
    index = Math.floor(index / 2); level = next;
  }
  return proof;
}
const verifyProof = (event, proof, root) => proof.reduce((h, sibling) => pairHash(h, sibling), hash(event)) === root;
function location(input) {
  assert(input && typeof input === 'object', 'Location required');
  return { name: text(input.name, 'location'), lat: number(input.lat, 'latitude', -90, 90), lng: number(input.lng, 'longitude', -180, 180) };
}
function identity(actor) {
  assert(actor && ROLES.includes(actor.role), 'Unverified role');
  return { id: text(actor.id, 'identity', 512), name: text(actor.name, 'name'), role: actor.role };
}
function append(batch, type, actor, data, context) {
  const event = { index: batch.events.length, type, actor: identity(actor), timestamp: context.timestamp, txId: context.txId, previousHash: batch.events.length ? hash(batch.events.at(-1)) : '0'.repeat(64), data: structuredClone(data) };
  batch.events.push(event); batch.root = merkleRoot(batch.events); batch.updatedAt = context.timestamp;
  return batch;
}
function createBatch(input, actor, context) {
  assert(actor.role === 'farmer', 'Only farmers can register a batch');
  const id = text(input.id, 'batch ID', 64);
  assert(/^[A-Za-z0-9-]+$/.test(id), 'Batch ID must contain letters, numbers or hyphens');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(input.harvestDate) && !Number.isNaN(Date.parse(input.harvestDate)) && new Date(input.harvestDate).toISOString().slice(0, 10) === input.harvestDate && input.harvestDate <= businessDate(context.timestamp), 'Invalid or future harvest date');
  assert(typeof input.organic === 'boolean', 'Organic declaration required');
  const limits = input.limits || { minTemp: 2, maxTemp: 15, maxHumidity: 90 };
  number(limits.minTemp, 'minimum temperature', -50, 80); number(limits.maxTemp, 'maximum temperature', limits.minTemp, 80); number(limits.maxHumidity, 'humidity limit', 0, 100);
  const batch = { id, crop: text(input.crop, 'crop'), quantity: number(input.quantity, 'quantity', 0.001, 1e9), unit: 'kg', harvestDate: input.harvestDate, organic: input.organic, origin: location(input.location), holder: identity(actor), status: 'active', limits: { minTemp: limits.minTemp, maxTemp: limits.maxTemp, maxHumidity: limits.maxHumidity }, certificates: [], complaints: [], events: [], createdAt: context.timestamp };
  return append(batch, 'HARVEST', actor, { crop: batch.crop, quantity: batch.quantity, unit: batch.unit, harvestDate: batch.harvestDate, organic: batch.organic, location: batch.origin, limits: batch.limits, price: number(input.price, 'price per kg', 0, 1e7) }, context);
}
function mutateBatch(current, action, input, actor, context) {
  const batch = structuredClone(current); identity(actor);
  assert(verifyBatch(batch), 'Ledger integrity check failed');
  assert(batch.events.length < 5000, 'Batch event capacity reached');
  if (action === 'complaint') {
    const complaint = { id: context.txId, message: text(input.message, 'complaint', 2000), status: 'open' };
    batch.complaints.push(complaint); return append(batch, 'COMPLAINT', actor, complaint, context);
  }
  if (action === 'resolveComplaint') {
    assert(actor.role === 'regulator', 'Only regulators can resolve complaints');
    const complaint = batch.complaints.find(c => c.id === input.id);
    assert(complaint && complaint.status === 'open', 'Open complaint not found');
    complaint.status = 'resolved'; complaint.resolution = text(input.resolution, 'resolution', 2000);
    return append(batch, 'COMPLAINT_RESOLVED', actor, { ...complaint }, context);
  }
  if (action === 'recall') {
    assert(actor.role === 'regulator', 'Only regulators can recall batches');
    assert(batch.status !== 'recalled', 'Batch is already recalled');
    batch.status = 'recalled'; batch.recallReason = text(input.reason, 'recall reason', 2000);
    return append(batch, 'RECALL', actor, { reason: batch.recallReason }, context);
  }
  assert(batch.status === 'active', 'Recalled batches cannot be modified or transferred');
  assert(batch.holder.id === actor.id, 'Only the current holder can perform this action');
  if (action === 'transfer') {
    const recipient = identity(input.recipient);
    assert(recipient.id !== actor.id && recipient.role !== 'regulator' && recipient.role !== 'farmer', 'Invalid custody recipient');
    const data = { from: batch.holder, to: recipient, quantity: number(input.quantity, 'received quantity', 0.001, batch.quantity), price: number(input.price, 'price per kg', 0, 1e7), grade: text(input.grade, 'grade', 40), location: location(input.location), note: text(input.note || 'Custody transferred', 'note', 1000) };
    if (input.shelfLifeDate) { assert(/^\d{4}-\d{2}-\d{2}$/.test(input.shelfLifeDate) && !Number.isNaN(Date.parse(input.shelfLifeDate)) && new Date(input.shelfLifeDate).toISOString().slice(0,10) === input.shelfLifeDate && input.shelfLifeDate >= businessDate(context.timestamp), 'Invalid shelf life date'); data.shelfLifeDate = input.shelfLifeDate; }
    batch.holder = recipient; batch.quantity = data.quantity;
    return append(batch, 'TRANSFER', actor, data, context);
  }
  if (action === 'sensor') {
    assert(['transporter', 'processor', 'retailer'].includes(actor.role), 'Only a cold-chain holder can record sensor readings');
    const temperature = number(input.temperature, 'temperature', -80, 100), humidity = number(input.humidity, 'humidity', 0, 100);
    const data = { temperature, humidity, deviceId: text(input.deviceId, 'device ID', 80), location: location(input.location), alert: temperature < batch.limits.minTemp || temperature > batch.limits.maxTemp || humidity > batch.limits.maxHumidity };
    return append(batch, 'SENSOR', actor, data, context);
  }
  if (action === 'certificate') {
    assert(/^[a-f0-9]{64}$/.test(input.sha256), 'Invalid SHA-256 digest');
    assert(typeof input.cid === 'string' && /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,120})$/.test(input.cid), 'Invalid IPFS CID');
    assert(!batch.certificates.some(c => c.sha256 === input.sha256), 'Certificate already attached');
    const certificate = { name: text(input.name, 'certificate name'), type: text(input.type, 'certificate type', 80), cid: input.cid, sha256: input.sha256, issuer: text(input.issuer, 'issuer') };
    batch.certificates.push(certificate); return append(batch, 'CERTIFICATE', actor, certificate, context);
  }
  throw new Error('Unknown batch action');
}
function verifyBatch(batch) {
  if (!batch.events?.length || batch.root !== merkleRoot(batch.events)) return false;
  for (let i = 0; i < batch.events.length; i++) {
    const e = batch.events[i];
    if (e.index !== i || e.previousHash !== (i ? hash(batch.events[i - 1]) : '0'.repeat(64))) return false;
  }
  // Rebuild mutable projections: changing a holder/status outside the event log must fail too.
  const first = batch.events[0]; if (first.type !== 'HARVEST') return false;
  const initial = first.data;
  let holder = first.actor, quantity = initial.quantity, status = 'active', recallReason;
  const certificates = [], complaints = [];
  for (const e of batch.events.slice(1)) {
    if (e.type === 'TRANSFER') { holder = e.data.to; quantity = e.data.quantity; }
    if (e.type === 'RECALL') { status = 'recalled'; recallReason = e.data.reason; }
    if (e.type === 'CERTIFICATE') certificates.push(e.data);
    if (e.type === 'COMPLAINT') complaints.push({ ...e.data });
    if (e.type === 'COMPLAINT_RESOLVED') { const c = complaints.find(c => c.id === e.data.id); if (!c) return false; Object.assign(c, e.data); }
  }
  return canonical(batch.holder) === canonical(holder) && batch.quantity === quantity && batch.status === status && batch.recallReason === recallReason && batch.crop === initial.crop && batch.unit === initial.unit && batch.harvestDate === initial.harvestDate && batch.organic === initial.organic && canonical(batch.origin) === canonical(initial.location) && canonical(batch.limits) === canonical(initial.limits) && canonical(batch.certificates) === canonical(certificates) && canonical(batch.complaints) === canonical(complaints) && batch.createdAt === first.timestamp && batch.updatedAt === batch.events.at(-1).timestamp;
}
module.exports = { ROLES, assert, canonical, hash, merkleRoot, merkleProof, verifyProof, createBatch, mutateBatch, verifyBatch, identity, businessDate };
