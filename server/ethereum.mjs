import { Contract, JsonRpcProvider, Wallet, AbiCoder, keccak256, toUtf8Bytes, getBytes, id, ZeroHash } from 'ethers';
import { randomUUID } from 'node:crypto';
import domain from '../chaincode/lib/domain.cjs';
export const ledgerAbi = [
  'function validator() view returns (address)', 'function heads(bytes32) view returns (bytes32)',
  'function count() view returns (uint256)', 'function keyAt(uint256) view returns (bytes32)',
  'function read(bytes32) view returns (string)',
  'function commit(bytes32,bytes32,string,uint256,bytes)',
  'event BatchCommitted(bytes32 indexed key,address indexed actor,bytes32 digest)'
];
export class EthereumLedger {
  mode = 'ethereum';
  constructor({ rpcUrl, address, validatorKey, chainId, deploymentBlock = 0 }) {
    this.provider = new JsonRpcProvider(rpcUrl, undefined, { cacheTimeout: -1 });
    this.contract = new Contract(address, ledgerAbi, this.provider);
    this.validator = new Wallet(validatorKey);
    this.chainId = Number(chainId);
    this.deploymentBlock = Number(deploymentBlock);
    if (!Number.isSafeInteger(this.deploymentBlock) || this.deploymentBlock < 0) throw new Error('Invalid Ethereum deployment block');
  }
  async ready() {
    if (Number((await this.provider.getNetwork()).chainId) !== this.chainId) throw new Error('Ethereum chain ID mismatch');
    if (![1337, 31337, 11155111].includes(this.chainId)) throw new Error('Only local chains and Sepolia are supported');
    if ((await this.contract.validator()).toLowerCase() !== this.validator.address.toLowerCase()) throw new Error('Incorrect Ethereum validator');
  }
  async list() {
    const result = [];
    const count = Number(await this.contract.count());
    for (let i = 0; i < count; i++) result.push(JSON.parse(await this.contract.read(await this.contract.keyAt(i))));
    return result;
  }
  async get(batchId) {
    const value = await this.contract.read(id(batchId));
    if (!value) throw new Error('Batch not found');
    const batch = JSON.parse(value);
    if (!domain.verifyBatch(batch)) throw new Error('Ledger integrity check failed');
    return batch;
  }
  async prepare(batch, actor, previous) {
    if (!actor.wallet) throw new Error('Participant wallet is not configured');
    const key = id(batch.id), record = domain.canonical(batch);
    const block = await this.provider.getBlock('latest');
    const deadline = block.timestamp + 600;
    const digest = keccak256(toUtf8Bytes(record));
    const approval = keccak256(AbiCoder.defaultAbiCoder().encode(
      ['uint256','address','address','bytes32','bytes32','bytes32','uint256'],
      [this.chainId, this.contract.target, actor.wallet, key, previous, digest, deadline]));
    const signature = await this.validator.signMessage(getBytes(approval));
    return { walletTransaction: { chainId: this.chainId, from: actor.wallet, to: this.contract.target,
      data: this.contract.interface.encodeFunctionData('commit', [key, previous, record, deadline, signature]) } };
  }
  async create(input, actor) {
    const previous = await this.contract.heads(id(input.id));
    if (previous !== ZeroHash) throw new Error('Batch ID already exists');
    return this.prepare(domain.createBatch(input, actor, { timestamp: new Date().toISOString(), txId: randomUUID() }), actor, previous);
  }
  async update(batchId, action, input, actor) {
    const current = await this.get(batchId);
    // Derive the expected head from the exact state validated, avoiding concurrent-read races.
    const previous = keccak256(toUtf8Bytes(domain.canonical(current)));
    const batch = domain.mutateBatch(current, action, input, actor, { timestamp: new Date().toISOString(), txId: randomUUID() });
    return this.prepare(batch, actor, previous);
  }
  async evidence(batchId, batch) {
    const expected = batch ? keccak256(toUtf8Bytes(domain.canonical(batch))) : null;
    const filter = this.contract.filters.BatchCommitted(id(batchId));
    for (let end = await this.provider.getBlockNumber(); end >= this.deploymentBlock;) {
      const start = Math.max(this.deploymentBlock, end - 4999);
      const logs = await this.contract.queryFilter(filter, start, end);
      const log = logs.reverse().find(l => !expected || l.args.digest === expected);
      if (log) return { transactionHash: log.transactionHash, blockNumber: log.blockNumber, chainId: this.chainId, contract: this.contract.target };
      end = start - 1;
    }
    return null;
  }
  async receipt(hash, actor) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('Invalid transaction hash');
    const receipt = await this.provider.getTransactionReceipt(hash);
    if (!receipt || receipt.status !== 1) throw new Error('Transaction has not confirmed successfully');
    if (receipt.to?.toLowerCase() !== this.contract.target.toLowerCase() || receipt.from.toLowerCase() !== actor.wallet.toLowerCase()) throw new Error('Transaction wallet or contract mismatch');
    const log = receipt.logs.filter(l => l.address.toLowerCase() === this.contract.target.toLowerCase()).map(l => this.contract.interface.parseLog(l)).find(l => l?.name === 'BatchCommitted');
    if (!log) throw new Error('No batch commit in receipt');
    const tx = await this.provider.getTransaction(hash);
    const call = this.contract.interface.parseTransaction({ data: tx.data });
    const batch = JSON.parse(call.args[2]);
    return { ...batch, blockchain: { transactionHash: hash, blockNumber: receipt.blockNumber, chainId: this.chainId, contract: this.contract.target } };
  }
}
