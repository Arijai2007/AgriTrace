import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID, createPrivateKey } from 'node:crypto';
import domain from '../chaincode/lib/domain.cjs';
export class DemoLedger {
  mode = 'demo';
  constructor(file) { this.file = file; this.queue = Promise.resolve(); }
  async list() {
    try {
      const records = JSON.parse(await readFile(this.file, 'utf8'));
      if (!Array.isArray(records) || records.some(b => !domain.verifyBatch(b))) throw new Error('Ledger integrity check failed');
      return records;
    } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  }
  async get(id) { const b = (await this.list()).find(b => b.id === id); if (!b) throw new Error('Batch not found'); return b; }
  async write(operation) {
    const task = this.queue.then(async () => {
      const records = await this.list(); const result = operation(records);
      await mkdir(dirname(this.file), { recursive: true });
      const temp = this.file + '.tmp'; await writeFile(temp, JSON.stringify(records, null, 2));
      // Windows file scanners can briefly hold an otherwise atomic rename open.
      for (let attempt = 0; ; attempt++) {
        try { await rename(temp, this.file); break; }
        catch (e) { if (attempt >= 4 || !['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) throw e; await new Promise(r => setTimeout(r, 25 * (attempt + 1))); }
      }
      return result;
    });
    this.queue = task.catch(() => {}); return task;
  }
  async create(input, actor) {
    return this.write(records => { if (records.some(b => b.id === input.id)) throw new Error('Batch ID already exists'); const batch = domain.createBatch(input, actor, { timestamp: new Date().toISOString(), txId: randomUUID() }); records.push(batch); return batch; });
  }
  async update(id, action, input, actor) {
    return this.write(records => { const i = records.findIndex(b => b.id === id); if (i < 0) throw new Error('Batch not found'); return records[i] = domain.mutateBatch(records[i], action, input, actor, { timestamp: new Date().toISOString(), txId: randomUUID() }); });
  }
}
export class FabricLedger {
  mode = 'fabric';
  constructor(accounts) { this.accounts = accounts; }
  async call(actor, method, args, submit) {
    const { connect, signers } = await import('@hyperledger/fabric-gateway');
    const grpc = await import('@grpc/grpc-js');
    const account = this.accounts.find(a => a.id === actor.id);
    if (!account?.fabric) throw new Error('Fabric identity not configured');
    const f = account.fabric;
    const [certificate, key, tls] = await Promise.all([readFile(f.certificate), readFile(f.privateKey), readFile(f.tlsCertificate)]);
    const client = new grpc.Client(f.endpoint, grpc.credentials.createSsl(tls), { 'grpc.ssl_target_name_override': f.hostAlias });
    const gateway = connect({ client, identity: { mspId: f.mspId, credentials: certificate }, signer: signers.newPrivateKeySigner(createPrivateKey(key)), evaluateOptions: () => ({ deadline: Date.now() + 15000 }), endorseOptions: () => ({ deadline: Date.now() + 30000 }), submitOptions: () => ({ deadline: Date.now() + 15000 }), commitStatusOptions: () => ({ deadline: Date.now() + 60000 }) });
    try { const contract = gateway.getNetwork(f.channel || 'agritrace').getContract(f.chaincode || 'agritrace'); const data = submit ? await contract.submitTransaction(method, ...args) : await contract.evaluateTransaction(method, ...args); return JSON.parse(Buffer.from(data).toString()); }
    finally { gateway.close(); client.close(); }
  }
  reader() { return this.accounts.find(a => a.role === 'regulator') || this.accounts[0]; }
  list() { return this.call(this.reader(), 'ListBatches', [], false); }
  get(id) { return this.call(this.reader(), 'ReadBatch', [id], false); }
  create(input, actor) { return this.call(actor, 'CreateBatch', [JSON.stringify(input)], true); }
  update(id, action, input, actor) { return this.call(actor, 'UpdateBatch', [id, action, JSON.stringify(input)], true); }
}
