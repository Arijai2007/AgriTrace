const {test}=require('node:test');
const assert=require('node:assert/strict');
const {contracts:[AgriTrace]}=require('../chaincode/index.cjs');
function context(storage, user, role, msp='FarmersMSP') {
 return {clientIdentity:{getMSPID:()=>msp,getAttributeValue:k=>({'hf.EnrollmentID':user,role,displayName:user}[k]||null)},stub:{getState:async k=>storage.get(k)||Buffer.alloc(0),putState:async(k,v)=>storage.set(k,v),getTxID:()=>`tx-${storage.size}`,getTxTimestamp:()=>({seconds:{toString:()=>String(Date.parse('2026-11-07T12:00:00Z')/1000)},nanos:0}),getStateByRange:async(start,end)=>{const values=[...storage.entries()].filter(([k])=>k>=start&&k<end);let i=0;return{next:async()=>i<values.length?{value:{value:values[i++][1]},done:false}:{done:true},close:async()=>{}}}}};
}
test('Fabric contract uses CA attributes, preserves transaction timestamp, and rejects unregistered or forged recipients',async()=>{
 const contract=new AgriTrace(),state=new Map(),farmer=context(state,'farmer','farmer'),retailer=context(state,'retailer','retailer','RetailMSP');
 const input={id:'AGR-FABRIC',crop:'Rice',quantity:100,price:20,organic:false,harvestDate:'2026-11-06',location:{name:'Farm',lat:28,lng:77}};
 const created=JSON.parse(await contract.CreateBatch(farmer,JSON.stringify({...input,role:'regulator'})));
 assert.equal(created.holder.id,'FarmersMSP:farmer');assert.equal(created.events[0].timestamp,'2026-11-07T12:00:00.000Z');
 await assert.rejects(()=>contract.CreateBatch(retailer,JSON.stringify({...input,id:'AGR-FAIL'})),/Only farmers/);
 const data={recipient:{id:'RetailMSP:retailer',name:'Forged name',role:'transporter'},quantity:100,price:30,grade:'A',location:input.location};
 await assert.rejects(()=>contract.UpdateBatch(farmer,input.id,'transfer',JSON.stringify(data)),/not enrolled/);
 await contract.RegisterParticipant(retailer);
 const moved=JSON.parse(await contract.UpdateBatch(farmer,input.id,'transfer',JSON.stringify(data)));
 assert.equal(moved.holder.role,'retailer');assert.equal(moved.holder.name,'retailer');
 await assert.rejects(()=>contract.UpdateBatch(farmer,input.id,'transfer',JSON.stringify(data)),/current holder/);
 const list=JSON.parse(await contract.ListBatches(farmer));assert.equal(list.length,1);
});
test('Fabric contract rejects identities without required certificate attributes',async()=>{
 const contract=new AgriTrace();assert.throws(()=>contract._actor(context(new Map(),'unknown',null)),/Unverified/);
});
