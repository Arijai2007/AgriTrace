export const TRANSACTION_KEY = 'agritrace-transactions-v1';
export const isHash = value => /^0x[0-9a-fA-F]{64}$/.test(value || '');
export const operationLabels = { create: 'Register batch', transfer: 'Transfer custody', sensor: 'Record conditions', certificates: 'Attach certificate', recall: 'Recall batch', complaint: 'Report issue', resolveComplaint: 'Resolve complaint', imported: 'Imported receipt' };

export function operationFor(path) {
  return path === '/batches' ? 'create' : path.split('/').at(-1);
}

export function receiptFields(receipt) {
  const gasUsed = BigInt(receipt.gasUsed), gasPrice = BigInt(receipt.gasPrice);
  return { status: Number(receipt.status) === 1 ? 'confirmed' : 'reverted', hash: receipt.hash,
    blockNumber: receipt.blockNumber, gasUsed: gasUsed.toString(), gasPrice: gasPrice.toString(),
    feeWei: (gasUsed * gasPrice).toString() };
}

export function summarizeTransactions(records) {
  const confirmed = records.filter(r => r.status === 'confirmed');
  const gas = confirmed.filter(r => /^\d+$/.test(r.gasUsed || ''));
  const timed = confirmed.filter(r => Number.isFinite(r.confirmationMs) && r.confirmationMs >= 0);
  const fees = records.filter(r => /^\d+$/.test(r.feeWei || ''));
  return { confirmed: confirmed.length, gasSamples: gas.length, timedSamples: timed.length,
    averageGas: gas.length ? gas.reduce((sum, r) => sum + Number(r.gasUsed), 0) / gas.length : null,
    averageMs: timed.length ? timed.reduce((sum, r) => sum + r.confirmationMs, 0) / timed.length : null,
    totalFeeWei: fees.reduce((sum, r) => sum + BigInt(r.feeWei), 0n).toString() };
}

export function readTransactions(storage) {
  try { const records = JSON.parse(storage.getItem(TRANSACTION_KEY) || '[]'); return Array.isArray(records) ? records.filter(r => r && typeof r.id === 'string').slice(0, 100) : []; }
  catch { return []; }
}

let memoryRecords;
export function getTransactions() {
  try { return memoryRecords ?? readTransactions(window.localStorage); } catch { return memoryRecords ?? []; }
}

export function saveTransaction(record) {
  const records = getTransactions();
  const previous = records.find(r => r.id === record.id);
  memoryRecords = [{ ...previous, ...record }, ...records.filter(r => r.id !== record.id)].slice(0, 100);
  try { window.localStorage.setItem(TRANSACTION_KEY, JSON.stringify(memoryRecords)); } catch { /* Wallet submission must still work when browser storage is full. */ }
  window.dispatchEvent(new Event('agritrace-transaction'));
}
