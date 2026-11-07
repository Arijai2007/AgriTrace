import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import { ContractFactory, JsonRpcProvider, Wallet, id } from 'ethers';
import { artifact } from '../scripts/compile-ledger.mjs';
import { EthereumLedger } from '../server/ethereum.mjs';
import domain from '../chaincode/lib/domain.cjs';

test('Ethereum: mined wallet writes, on-chain reads, custody, tamper rejection, replay protection and receipts', async () => {
  const node = ganache.server({ logging: { quiet: true }, chain: { chainId: 1337 } });
  await node.listen(0, '127.0.0.1');
  const rpcUrl = `http://127.0.0.1:${node.address().port}`;
  const provider = new JsonRpcProvider(rpcUrl, undefined, { cacheTimeout: -1 });
  try {
    const keys = Object.values(node.provider.getInitialAccounts()).map(a => a.secretKey);
    const validator = new Wallet(keys[0], provider), farmerWallet = new Wallet(keys[1], provider), receiverWallet = new Wallet(keys[2], provider);
    const contract = await new ContractFactory(artifact.abi, artifact.bytecode, validator).deploy(validator.address);
    await contract.waitForDeployment();
    const ledger = new EthereumLedger({ rpcUrl, address: await contract.getAddress(), validatorKey: keys[0], chainId: 1337 });
    await ledger.ready();
    const farmer = { id: 'farmer-1', name: 'Farmer', role: 'farmer', wallet: farmerWallet.address };
    const receiver = { id: 'transporter-1', name: 'Driver', role: 'transporter', wallet: receiverWallet.address };
    const input = { id: 'REAL-001', crop: 'Rice', quantity: 100, price: 20, harvestDate: new Date().toISOString().slice(0,10), organic: false, location: { name: 'Farm', lat: 28, lng: 77 } };
    await assert.rejects(ledger.create(input, receiver), /Only farmers/);
    const prepared = await ledger.create(input, farmer);
    assert.equal((await ledger.list()).length, 0, 'Preparation does not write');
    const tx = prepared.walletTransaction;
    await assert.rejects(receiverWallet.sendTransaction({ to: tx.to, data: tx.data }), 'Another wallet cannot submit approval');
    const parsed = contract.interface.parseTransaction({ data: tx.data });
    const altered = contract.interface.encodeFunctionData('commit', [parsed.args[0], parsed.args[1], parsed.args[2].replace('Rice','Gold'), parsed.args[3], parsed.args[4]]);
    await assert.rejects(farmerWallet.sendTransaction({ to: tx.to, data: altered }));
    const sent = await farmerWallet.sendTransaction({ to: tx.to, data: tx.data }); await sent.wait();
    const receipt = await ledger.receipt(sent.hash, farmer);
    assert.equal(receipt.blockchain.transactionHash, sent.hash);
    assert.ok(receipt.blockchain.blockNumber > 0);
    assert.equal((await ledger.get(input.id)).crop, 'Rice');
    assert.ok(domain.verifyBatch(await ledger.get(input.id)));
    await assert.rejects(farmerWallet.sendTransaction({ to: tx.to, data: tx.data }));
    const next = await ledger.update(input.id, 'transfer', { recipient: receiver, quantity: 99, price: 25, grade: 'A', note: 'Real transaction', location: input.location }, farmer);
    const moved = await farmerWallet.sendTransaction({ to: next.walletTransaction.to, data: next.walletTransaction.data }); await moved.wait();
    assert.equal((await ledger.get(input.id)).holder.id, receiver.id);
    await assert.rejects(ledger.update(input.id, 'sensor', { temperature: 8, humidity: 70, deviceId: 'S1', location: input.location }, farmer));
    assert.equal((await ledger.list()).length, 1);
    assert.notEqual(await contract.heads(id(input.id)), parsed.args[1]);
    assert.equal((await provider.getTransactionReceipt(sent.hash)).status, 1);
    ledger.provider.destroy();
  } finally { provider.destroy(); await node.close(); }
});
