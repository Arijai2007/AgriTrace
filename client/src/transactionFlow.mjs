import { receiptFields } from './transactionModel.mjs';

// Dependencies are supplied so the complete lifecycle can be tested without wallet prompts.
export async function trackWalletTransaction(tx, { connect, api, save, now = Date.now, makeId = () => crypto.randomUUID(), operation = 'create' }) {
  let record = { id: makeId(), chainId: tx.chainId, contract: tx.to, from: tx.from, operation, createdAt: now(), status: 'awaiting-wallet' };
  const update = patch => { record = { ...record, ...patch }; save(record); };
  update({});
  let receipt;
  try {
    const provider = await connect(tx.chainId), signer = await provider.getSigner();
    if ((await signer.getAddress()).toLowerCase() !== tx.from.toLowerCase()) throw new Error('Switch MetaMask to the registered wallet: ' + tx.from);
    const sent = await signer.sendTransaction({ to: tx.to, data: tx.data });
    update({ hash: sent.hash, submittedAt: now(), status: 'pending' });
    try { receipt = await sent.wait(); }
    catch (error) {
      if (error.code === 'TRANSACTION_REPLACED') {
        if (error.cancelled) { update({ status: 'cancelled', replacementHash: error.replacement?.hash, error: 'Transaction cancelled or replaced with a different action in the wallet.' }); throw error; }
        receipt = error.receipt;
        update({ originalHash: sent.hash });
      } else if (error.receipt) receipt = error.receipt;
      else throw error;
    }
    const confirmedAt = now();
    update({ ...receiptFields(receipt), confirmedAt, confirmationMs: confirmedAt - record.submittedAt, error: '' });
    if (record.status !== 'confirmed') throw new Error('Blockchain transaction reverted. Gas may still have been spent.');
  } catch (error) {
    if (record.status === 'awaiting-wallet') update({ status: error.code === 4001 || error.code === 'ACTION_REJECTED' ? 'rejected' : 'failed', error: error.shortMessage || error.message });
    else if (record.status === 'pending') update({ error: 'Confirmation could not be checked. Refresh this receipt before submitting again.' });
    throw error;
  }
  // A refresh failure must never turn a mined transaction into a failed transaction.
  try { return await api('/transactions/' + record.hash); }
  catch (error) { update({ error: 'Confirmed on-chain. The app could not refresh the saved batch; refresh records before trying again.' }); throw error; }
}
