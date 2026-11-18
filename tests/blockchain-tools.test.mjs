import test from 'node:test';
import assert from 'node:assert/strict';
import domain from '../chaincode/lib/domain.cjs';
import { eventProof, verifyEventCopy, eventHash } from '../client/src/integrity.mjs';
import { trackWalletTransaction } from '../client/src/transactionFlow.mjs';
import { summarizeTransactions, receiptFields, readTransactions } from '../client/src/transactionModel.mjs';
import { receiptOperation } from '../client/src/receiptLookup.mjs';
import { Interface } from 'ethers';

test('receipt operation is derived from mined commit input, with unknown inputs labelled explicitly', () => {
  const contract = new Interface(['function commit(bytes32,bytes32,string,uint256,bytes)']);
  const input = contract.encodeFunctionData('commit', ['0x' + '0'.repeat(64), '0x' + '0'.repeat(64), JSON.stringify({ events: [{ type: 'HARVEST' }, { type: 'TRANSFER' }] }), 1234, '0x']);
  assert.equal(receiptOperation(input), 'transfer');
  assert.equal(receiptOperation('0x1234'), 'imported');
});

test('browser Merkle checks match ledger proofs for odd/even histories and detect edited files', () => {
  for (const length of [1, 2, 3, 5, 8, 9]) {
    const events = Array.from({ length }, (_, i) => ({ index: i, actor: { name: 'Kavita' }, data: { quantity: 100 - i, note: 'Harvest 🌱' } }));
    const before = JSON.stringify(events), root = domain.merkleRoot(events);
    events.forEach((event, index) => {
      const proof = eventProof(events, index);
      assert.deepEqual(proof, domain.merkleProof(events, index));
      assert.equal(eventHash(event), domain.hash(event));
      assert.equal(verifyEventCopy(event, proof, root).valid, true);
      const copy = structuredClone(event); copy.data.quantity++;
      assert.equal(verifyEventCopy(copy, proof, root).valid, false);
      const reordered = { data: event.data, actor: event.actor, index: event.index };
      assert.equal(verifyEventCopy(reordered, proof, root).valid, true);
    });
    assert.equal(JSON.stringify(events), before, 'Demo must leave original records untouched');
  }
  assert.throws(() => verifyEventCopy({}, ['invalid'], '0'.repeat(64)), /Invalid Merkle/);
  assert.throws(() => eventProof([], 0), /Select/);
});

const originalHash = '0x' + '1'.repeat(64), replacementHash = '0x' + '2'.repeat(64);
const tx = { chainId: 11155111, to: '0xcontract', from: '0xfarmer', data: '0xdata' };
const mined = { status: 1, hash: originalHash, blockNumber: 321, gasUsed: 100000n, gasPrice: 2000000000n };
function harness({ wait = async () => mined, sendError, apiError } = {}) {
  const updates = [], apiCalls = []; let clock = 0;
  return { updates, apiCalls, deps: {
    connect: async () => ({ getSigner: async () => ({ getAddress: async () => tx.from, sendTransaction: async () => {
      if (sendError) throw sendError;
      return { hash: originalHash, wait };
    } }) }),
    api: async path => { apiCalls.push(path); if (apiError) throw apiError; return { id: 'BATCH-1' }; },
    save: record => updates.push(structuredClone(record)), now: () => { clock += 1000; return clock; }, makeId: () => 'attempt-1'
  } };
}
test('wallet lifecycle records pending then mined receipt, exact gas fee and measured time', async () => {
  const h = harness();
  assert.deepEqual(await trackWalletTransaction(tx, h.deps), { id: 'BATCH-1' });
  assert.deepEqual(h.updates.map(r => r.status), ['awaiting-wallet', 'pending', 'confirmed']);
  assert.equal(h.updates.at(-1).feeWei, '200000000000000');
  assert.equal(h.updates.at(-1).confirmationMs, 1000);
  assert.equal(h.updates.at(-1).blockNumber, 321);
  assert.deepEqual(h.apiCalls, ['/transactions/' + originalHash]);
});
test('rejection, revert and RPC interruption are distinguished without reporting an unknown transaction as failed', async () => {
  const rejected = harness({ sendError: Object.assign(new Error('User rejected'), { code: 'ACTION_REJECTED' }) });
  await assert.rejects(trackWalletTransaction(tx, rejected.deps));
  assert.equal(rejected.updates.at(-1).status, 'rejected');
  assert.equal(rejected.updates.at(-1).hash, undefined);
  const reverted = harness({ wait: async () => { throw Object.assign(new Error('Revert'), { receipt: { ...mined, status: 0 } }); } });
  await assert.rejects(trackWalletTransaction(tx, reverted.deps), /reverted/);
  assert.equal(reverted.updates.at(-1).status, 'reverted');
  assert.equal(reverted.updates.at(-1).gasUsed, '100000');
  assert.deepEqual(reverted.apiCalls, []);
  const interrupted = harness({ wait: async () => { throw new Error('RPC offline'); } });
  await assert.rejects(trackWalletTransaction(tx, interrupted.deps));
  assert.equal(interrupted.updates.at(-1).status, 'pending');
  assert.equal(interrupted.updates.at(-1).confirmationMs, undefined);
});
test('speedups follow the replacement hash and cancellation does not claim a batch commit', async () => {
  const replacement = { code: 'TRANSACTION_REPLACED', cancelled: false, receipt: { ...mined, hash: replacementHash } };
  const h = harness({ wait: async () => { throw replacement; } });
  await trackWalletTransaction(tx, h.deps);
  assert.equal(h.updates.at(-1).originalHash, originalHash);
  assert.equal(h.updates.at(-1).hash, replacementHash);
  assert.deepEqual(h.apiCalls, ['/transactions/' + replacementHash]);
  const cancelled = harness({ wait: async () => { throw { ...replacement, cancelled: true, replacement: { hash: replacementHash } }; } });
  await assert.rejects(trackWalletTransaction(tx, cancelled.deps));
  assert.equal(cancelled.updates.at(-1).status, 'cancelled');
  assert.deepEqual(cancelled.apiCalls, []);
});
test('a post-confirmation API error preserves the mined status', async () => {
  const h = harness({ apiError: new Error('API offline') });
  await assert.rejects(trackWalletTransaction(tx, h.deps));
  assert.equal(h.updates.at(-1).status, 'confirmed');
  assert.match(h.updates.at(-1).error, /Confirmed on-chain/);
});
test('performance averages exclude missing timings, failed attempts and reverted gas samples', () => {
  const records = [
    { ...receiptFields(mined), confirmationMs: 1000 },
    { ...receiptFields(mined), confirmationMs: null },
    { ...receiptFields({ ...mined, status: 0 }), confirmationMs: 9000 },
    { status: 'pending' }, { status: 'rejected' }
  ];
  assert.deepEqual(summarizeTransactions(records), { confirmed: 2, gasSamples: 2, timedSamples: 1, averageGas: 100000, averageMs: 1000, totalFeeWei: '600000000000000' });
  assert.equal(summarizeTransactions([]).averageMs, null);
  assert.deepEqual(readTransactions({ getItem: () => 'broken json' }), []);
  assert.deepEqual(readTransactions({ getItem: () => '{}' }), []);
});
