const { test } = require('node:test');
const assert = require('node:assert/strict');
const d = require('../chaincode/lib/domain.cjs');
const farmer = { id: 'f', name: 'Farmer', role: 'farmer' }, transporter = { id: 't', name: 'Carrier', role: 'transporter' }, retailer = { id: 'r', name: 'Retailer', role: 'retailer' }, regulator = { id: 'g', name: 'Regulator', role: 'regulator' };
const context = { timestamp: '2026-11-07T12:00:00.000Z', txId: 'transaction-1' };
const location = { name: 'Farm', lat: 28, lng: 77 };
const input = { id: 'AGR-1', crop: 'Tomatoes', quantity: 100, price: 20, harvestDate: '2026-11-06', organic: true, location };
const make = () => d.createBatch(input, farmer, context);
const transfer = (batch, from = farmer, to = transporter) => d.mutateBatch(batch, 'transfer', { recipient: to, quantity: 99, price: 25, grade: 'A', location }, from, { ...context, txId: 'transfer-1' });
test('harvest captures a valid immutable first event and verifies its projections', () => { const b = make(); assert.equal(b.holder.id, farmer.id); assert.equal(d.verifyBatch(b), true); assert.equal(b.events.length, 1); });
test('only a farmer can create; input bounds, dates and declarations are enforced', () => {
  assert.throws(() => d.createBatch(input, retailer, context), /Only farmers/);
  for (const change of [{quantity:-1},{harvestDate:'2027-01-01'},{harvestDate:'2026-02-31'},{organic:'true'},{location:{...location,lat:91}},{price:NaN},{limits:{minTemp:15,maxTemp:2,maxHumidity:90}}]) assert.throws(() => d.createBatch({...input,...change},farmer,context));
});
test('custody changes only when current holder signs; old holder loses authority', () => {
  assert.throws(() => transfer(make(), retailer), /current holder/);
  const b = transfer(make()); assert.equal(b.holder.id, transporter.id); assert.equal(b.quantity, 99); assert.equal(d.verifyBatch(b), true);
  assert.throws(() => transfer(b), /current holder/);
  assert.throws(() => d.mutateBatch(b,'transfer',{recipient:retailer,quantity:101,price:40,grade:'A',location},transporter,context),/quantity/);
});
test('sensor readings flag temperature and humidity excursions without dropping evidence', () => {
  const b = transfer(make());
  const safe = d.mutateBatch(b,'sensor',{temperature:8,humidity:70,deviceId:'D1',location},transporter,context);
  assert.equal(safe.events.at(-1).data.alert, false);
  const hot = d.mutateBatch(safe,'sensor',{temperature:25,humidity:95,deviceId:'D1',location},transporter,context);
  assert.equal(hot.events.at(-1).data.alert,true); assert.equal(d.verifyBatch(hot),true);
  assert.throws(()=>d.mutateBatch(b,'sensor',{temperature:8,humidity:70,deviceId:'D1',location},farmer,context),/current holder/);
});
test('only regulator recalls; recalled batches cannot transfer or accept readings', () => {
  assert.throws(()=>d.mutateBatch(make(),'recall',{reason:'Audit'},farmer,context),/Only regulators/);
  const b=d.mutateBatch(transfer(make()),'recall',{reason:'Contamination'},regulator,context);
  assert.equal(d.verifyBatch(b),true); assert.throws(()=>transfer(b,transporter,retailer),/Recalled/);
});
test('certificates require real-looking CID and digest; duplicate attachment rejected',()=>{
  const c={name:'Lab test',type:'Pesticides',issuer:'Lab',sha256:'a'.repeat(64),cid:'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'};
  const b=d.mutateBatch(make(),'certificate',c,farmer,context); assert.equal(d.verifyBatch(b),true);
  assert.throws(()=>d.mutateBatch(b,'certificate',c,farmer,context),/already/);
  assert.throws(()=>d.mutateBatch(make(),'certificate',{...c,cid:'pretend-ipfs'},farmer,context),/Invalid IPFS/);
});
test('complaint resolution is regulator-only and preserves report',()=>{
  const b=d.mutateBatch(make(),'complaint',{message:'Investigate'},retailer,context);
  assert.throws(()=>d.mutateBatch(b,'resolveComplaint',{id:context.txId,resolution:'Reviewed'},farmer,context),/Only regulators/);
  const result=d.mutateBatch(b,'resolveComplaint',{id:context.txId,resolution:'Reviewed'},regulator,context);
  assert.equal(result.complaints[0].status,'resolved'); assert.equal(result.events[1].data.status,'open'); assert.equal(d.verifyBatch(result),true);
});
test('Merkle inclusion proofs verify every odd/even leaf and reject tampering',()=>{
  let b=transfer(make()); b=d.mutateBatch(b,'sensor',{temperature:9,humidity:70,deviceId:'D1',location},transporter,context);
  for(let i=0;i<b.events.length;i++) { const p=d.merkleProof(b.events,i); assert.equal(d.verifyProof(b.events[i],p,b.root),true); assert.equal(d.verifyProof({...b.events[i],timestamp:'edited'},p,b.root),false); }
  assert.throws(()=>d.merkleProof(b.events,-1),/Invalid/);
});
test('edited events and projections fail integrity checks',()=>{
  for (const edit of [b=>b.events[0].data.price=99,b=>b.holder=retailer,b=>b.quantity=100000,b=>b.status='recalled',b=>b.crop='Rice',b=>b.limits.maxTemp=99,b=>b.certificates.push({name:'Fake'})]) { const b=make(); edit(b); assert.equal(d.verifyBatch(b),false); }
});
test('canonical hashing is independent of JSON property order',()=>assert.equal(d.hash({b:2,a:1}),d.hash({a:1,b:2})));
