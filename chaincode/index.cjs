'use strict';
const { Contract } = require('fabric-contract-api');
const domain = require('./lib/domain.cjs');
class AgriTrace extends Contract {
  _actor(ctx) {
    // Attributes are issued by the enrollment CA; never accept the caller's JSON role.
    const role = ctx.clientIdentity.getAttributeValue('role');
    const name = ctx.clientIdentity.getAttributeValue('displayName');
    const id = `${ctx.clientIdentity.getMSPID()}:${ctx.clientIdentity.getAttributeValue('hf.EnrollmentID')}`;
    domain.assert(ctx.clientIdentity.getAttributeValue('hf.EnrollmentID'), 'Enrollment ID missing');
    return domain.identity({ id, role, name });
  }
  _context(ctx) {
    const ts = ctx.stub.getTxTimestamp();
    return { timestamp: new Date(Number(ts.seconds.toString()) * 1000 + Math.floor(ts.nanos / 1e6)).toISOString(), txId: ctx.stub.getTxID() };
  }
  async ReadBatch(ctx, id) {
    const value = await ctx.stub.getState(`batch:${id}`);
    domain.assert(value.length, 'Batch not found'); return value.toString();
  }
  async ListBatches(ctx) {
    const iterator = await ctx.stub.getStateByRange('batch:', 'batch;'); const batches = [];
    try { for (;;) { const item = await iterator.next(); if (item.value?.value) batches.push(JSON.parse(item.value.value.toString())); if (item.done) break; } } finally { await iterator.close(); }
    return JSON.stringify(batches);
  }
  async CreateBatch(ctx, json) {
    const input = JSON.parse(json); domain.assert(!(await ctx.stub.getState(`batch:${input.id}`)).length, 'Batch ID already exists');
    const batch = domain.createBatch(input, this._actor(ctx), this._context(ctx));
    await ctx.stub.putState(`batch:${batch.id}`, Buffer.from(domain.canonical(batch))); return JSON.stringify(batch);
  }
  async UpdateBatch(ctx, id, action, json) {
    const input = JSON.parse(json);
    if (action === 'transfer') {
      const record = await ctx.stub.getState(`participant:${input.recipient?.id}`);
      domain.assert(record.length, 'Recipient is not enrolled in the participant registry');
      input.recipient = JSON.parse(record.toString());
    }
    const batch = domain.mutateBatch(JSON.parse(await this.ReadBatch(ctx, id)), action, input, this._actor(ctx), this._context(ctx));
    await ctx.stub.putState(`batch:${id}`, Buffer.from(domain.canonical(batch))); return JSON.stringify(batch);
  }
  async RegisterParticipant(ctx) {
    const actor = this._actor(ctx);
    const key = `participant:${actor.id}`;
    const existing = await ctx.stub.getState(key);
    domain.assert(!existing.length || domain.canonical(JSON.parse(existing.toString())) === domain.canonical(actor), 'Identity already registered with different attributes');
    await ctx.stub.putState(key, Buffer.from(domain.canonical(actor)));
    return JSON.stringify(actor);
  }
}
module.exports.contracts = [AgriTrace];
