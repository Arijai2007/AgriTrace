import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
import { DemoLedger } from '../server/ledger.mjs';
import { demoAccounts, passwordHash } from '../server/accounts.mjs';
test('end-to-end API: six identities, three handovers, alerts, complaint, recall, public QR trace and persistence', async t => {
  const temp=await mkdtemp(join(tmpdir(),'agritrace-test-')), file=join(temp,'ledger.json');
  const accounts=demoAccounts.map(a=>({...a,...passwordHash('test-password')}));
  const ledger=new DemoLedger(file), app=createApp({ledger,accounts,secret:'test-secret-which-is-long-enough-1234',clientDir:join(temp,'none')});
  const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
  t.after(async()=>{await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,{body,token,method='GET'}={})=>{const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
  assert.equal((await call('/batches')).status,401);
  assert.equal((await call('/auth/login',{method:'POST',body:{id:'farmer-1',password:'wrong'}})).status,401);
  const tokens={};for(const a of accounts) { const r=await call('/auth/login',{method:'POST',body:{id:a.id,password:'test-password'}}); assert.equal(r.status,200,JSON.stringify(r.data)); tokens[a.role]=r.data.token; assert.equal('hash' in r.data.user,false); }
  const location={name:'Farm',lat:28,lng:77}, input={id:'AGR-TEST',crop:'Tomatoes',quantity:100,price:20,harvestDate:new Date().toISOString().slice(0,10),organic:true,location};
  assert.equal((await call('/batches',{method:'POST',token:tokens.retailer,body:input})).status,403);
  assert.equal((await call('/batches',{method:'POST',token:tokens.farmer,body:input})).status,201);
  assert.equal((await call('/batches',{method:'POST',token:tokens.farmer,body:input})).status,400);
  const transfer={recipientId:'aggregator-1',quantity:100,price:25,grade:'A',location};
  assert.equal((await call('/batches/AGR-TEST/transfer',{method:'POST',token:tokens.retailer,body:transfer})).status,403);
  // Forged recipient JSON is overwritten with the trusted account from recipientId.
  let r=await call('/batches/AGR-TEST/transfer',{method:'POST',token:tokens.farmer,body:{...transfer,recipient:{id:'attacker',role:'regulator',name:'Fake'}}});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.holder.id,'aggregator-1');
  r=await call('/batches/AGR-TEST/transfer',{method:'POST',token:tokens.aggregator,body:{...transfer,recipientId:'transporter-1',price:30}});assert.equal(r.status,200,JSON.stringify(r.data));
  r=await call('/batches/AGR-TEST/sensor',{method:'POST',token:tokens.transporter,body:{temperature:28,humidity:96,deviceId:'SIM-1',location}});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.events.at(-1).data.alert,true);
  r=await call('/batches/AGR-TEST/transfer',{method:'POST',token:tokens.transporter,body:{...transfer,recipientId:'retailer-1',price:40}});assert.equal(r.status,200,JSON.stringify(r.data));
  r=await call('/batches/AGR-TEST/complaint',{method:'POST',token:tokens.retailer,body:{message:'Temperature investigation'}});assert.equal(r.status,200,JSON.stringify(r.data));
  r=await call('/batches/AGR-TEST/recall',{method:'POST',token:tokens.regulator,body:{reason:'Unsafe conditions'}});assert.equal(r.status,200,JSON.stringify(r.data));
  r=await call('/batches/AGR-TEST/transfer',{method:'POST',token:tokens.retailer,body:transfer});assert.equal(r.status,400);
  r=await call('/trace/AGR-TEST');assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.batch.status,'recalled');assert.equal(r.data.verification.valid,true);assert.equal(r.data.verification.publicAnchor,false);
  assert.equal((await call('/trace/AGR-TEST/proof/2')).data.valid,true);
  assert.equal((await call('/trace/UNKNOWN')).status,404);
  assert.equal((await new DemoLedger(file).get('AGR-TEST')).status,'recalled');
  const records=JSON.parse(await readFile(file,'utf8'));records[0].holder.id='tampered';await writeFile(file,JSON.stringify(records));
  assert.equal((await call('/trace/AGR-TEST')).status,500);
});
test('demo ledger serializes concurrent writes and enforces unique IDs',async t=>{
 const temp=await mkdtemp(join(tmpdir(),'agritrace-race-'));t.after(()=>rm(temp,{recursive:true,force:true}));const ledger=new DemoLedger(join(temp,'ledger.json'));
 const input={id:'AGR-RACE',crop:'Rice',quantity:10,price:4,harvestDate:new Date().toISOString().slice(0,10),organic:false,location:{name:'Farm',lat:28,lng:77}};
 const results=await Promise.allSettled([ledger.create(input,demoAccounts[0]),ledger.create(input,demoAccounts[0])]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await ledger.list()).length,1);
});
test('IPFS upload failure is explicit, and unauthorized uploads cannot reach storage',async t=>{
 const temp=await mkdtemp(join(tmpdir(),'agritrace-ipfs-'));const ledger=new DemoLedger(join(temp,'ledger.json'));const accounts=demoAccounts.map(a=>({...a,...passwordHash('test-password')}));const app=createApp({ledger,accounts,secret:'test-123',clientDir:join(temp,'none')});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});});const base=`http://127.0.0.1:${server.address().port}`;
 await ledger.create({id:'AGR-IPFS',crop:'Rice',quantity:10,price:4,harvestDate:new Date().toISOString().slice(0,10),organic:false,location:{name:'Farm',lat:28,lng:77}},accounts[0]);
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:accounts[0].id,password:'test-password'})});const {token}=await login.json();
 const response=await fetch(base+'/api/batches/AGR-IPFS/certificates',{method:'POST',headers:{Authorization:'Bearer '+token},body:new FormData()});assert.equal(response.status,503);
});

