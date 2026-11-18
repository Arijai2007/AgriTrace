import React, { useEffect, useState } from 'react';
import { formatEther } from 'ethers';
import { getTransactions, saveTransaction, summarizeTransactions, operationLabels, isHash } from '../transactionModel.mjs';
import { inspectReceipt } from '../receiptLookup.mjs';

const statuses = { 'awaiting-wallet': 'Awaiting wallet approval', pending: 'Pending confirmation', confirmed: 'Confirmed', reverted: 'Reverted', rejected: 'Wallet request rejected', failed: 'Not submitted', cancelled: 'Cancelled / replaced' };
const number = value => value == null ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value);
const seconds = value => value == null ? 'Not measured' : `${number(value / 1000)} s`;
const fee = value => value == null ? '—' : `${formatEther(value)} ETH`;
const sameNetwork = (record, health) => record.chainId === health?.ethereum?.chainId && record.contract?.toLowerCase() === health?.ethereum?.contract?.toLowerCase();

function useTransactions(health) {
  const [records, setRecords] = useState(getTransactions);
  useEffect(() => { const refresh = () => setRecords(getTransactions()); window.addEventListener('agritrace-transaction', refresh); return () => window.removeEventListener('agritrace-transaction', refresh); }, []);
  return records.filter(record => sameNetwork(record, health));
}

function HashLink({ hash, chainId }) {
  if (!isHash(hash)) return <span>Not submitted</span>;
  return chainId === 11155111 ? <a className="receipt-link" href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">{hash} ↗</a> : <code className="receipt-link">{hash}</code>;
}

function ReceiptDetails({ record }) {
  return <div className="receipt-details"><HashLink hash={record.hash} chainId={record.chainId}/><dl><div><dt>Status</dt><dd>{statuses[record.status] || record.status}</dd></div><div><dt>Block</dt><dd>{record.blockNumber ?? '—'}</dd></div><div><dt>Gas used</dt><dd>{number(record.gasUsed)}</dd></div><div><dt>Transaction fee</dt><dd>{fee(record.feeWei)}</dd></div><div><dt>Observed confirmation time</dt><dd>{seconds(record.confirmationMs)}</dd></div></dl>{record.originalHash && <p className="small muted">Original hash: {record.originalHash}</p>}{isHash(record.replacementHash) && <p className="small muted">Replacement: <HashLink hash={record.replacementHash} chainId={record.chainId}/></p>}{record.error && <p className="receipt-error">{record.error}</p>}</div>;
}

export function TransactionNotice({ health }) {
  const records = useTransactions(health), [dismissed, setDismissed] = useState('');
  const record = records[0];
  if (!record || record.id === dismissed) return null;
  return <aside className={`transaction-notice status-${record.status}`} aria-label="Latest wallet transaction"><div className="transaction-notice-head"><div role="status"><strong>{statuses[record.status]}</strong><span>{operationLabels[record.operation] || 'Batch update'}</span></div>{!['pending', 'awaiting-wallet'].includes(record.status) && <button className="icon-btn" onClick={() => setDismissed(record.id)} aria-label="Dismiss transaction status">×</button>}</div><details><summary>Transaction details</summary><ReceiptDetails record={record}/></details></aside>;
}

export function PerformanceDashboard({ health, suggestedHash }) {
  const records = useTransactions(health), summary = summarizeTransactions(records);
  const [hash, setHash] = useState(suggestedHash || ''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const check = async (input, existing) => {
    setBusy(true); setError('');
    try {
      const receipt = await inspectReceipt(input.trim(), health.ethereum);
      const previous = existing || records.find(r => r.hash?.toLowerCase() === receipt.hash.toLowerCase());
      saveTransaction({ ...previous, id: previous?.id || crypto.randomUUID(), operation: previous?.operation || 'imported', createdAt: previous?.createdAt || Date.now(), chainId: health.ethereum.chainId, contract: health.ethereum.contract, ...receipt, error: '', ...(previous?.status !== 'confirmed' ? { confirmationMs: null } : {}) });
    } catch (err) { setError(err.shortMessage || err.message); }
    finally { setBusy(false); }
  };
  if (health?.ledgerMode !== 'ethereum') return <p className="muted">Transaction measurements are available in Ethereum mode.</p>;
  const groups = Object.keys(operationLabels).map(operation => ({ operation, ...summarizeTransactions(records.filter(r => r.operation === operation)) })).filter(group => group.confirmed);
  return <section className="performance-dashboard" aria-label="Blockchain performance"><p className="muted">Receipt data and wallet submissions saved in this browser (latest 100 attempts). Confirmation time runs from the wallet’s returned transaction hash until this tab observes a mined receipt; it includes network and polling delay. It is not a network throughput benchmark.</p>
    <div className="performance-stats">{[
      ['Confirmed transactions', summary.confirmed], ['Average gas used', number(summary.averageGas)], ['Average observed confirmation', seconds(summary.averageMs)], ['Total measured fee', fee(summary.totalFeeWei)]
    ].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><p className="small muted">Gas samples: {summary.gasSamples} · Confirmation-time samples: {summary.timedSamples}. Imported or recovered receipts have no historical timing measurement. Fees include recorded reverted transactions and are paid in test ETH on Sepolia.</p>
    <form className="receipt-lookup" onSubmit={e => { e.preventDefault(); check(hash); }}><label className="field"><span>Inspect an existing AgriTrace transaction</span><input value={hash} onChange={e => setHash(e.target.value)} placeholder="0x… transaction hash" required maxLength={66}/></label><button className="button secondary" disabled={busy}>{busy ? 'Checking receipt…' : 'Inspect receipt'}</button></form>{suggestedHash && !hash && <button className="text-link" onClick={() => setHash(suggestedHash)}>Use this batch’s latest transaction</button>}{error && <p className="receipt-error" role="alert">{error}</p>}
    <div className="metrics-heading"><h3>Measurements by operation</h3><button className="button secondary small" disabled={!records.length} onClick={() => {
      const payload = { exportedAt: new Date().toISOString(), chainId: health.ethereum.chainId, contract: health.ethereum.contract, scope: 'This browser; confirmation time includes receipt polling delay. Imported receipts have no measured confirmation time.', summary, transactions: records };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'agritrace-performance.json'; a.click(); URL.revokeObjectURL(url);
    }}>Export measurements</button></div>
    {groups.length ? <div className="table-scroll"><table><thead><tr><th>Operation</th><th>Confirmed</th><th>Average gas</th><th>Average observed time</th><th>Time samples</th></tr></thead><tbody>{groups.map(group => <tr key={group.operation}><td>{operationLabels[group.operation]}</td><td>{group.confirmed}</td><td>{number(group.averageGas)}</td><td>{seconds(group.averageMs)}</td><td>{group.timedSamples}</td></tr>)}</tbody></table></div> : <p className="metrics-empty">No measured receipts yet. Submit a batch update or inspect a transaction hash to begin.</p>}
    <h3 className="metrics-heading">Transaction history</h3><p className="small muted">Use “Check status” after a reload or connection interruption. A pending transaction may still confirm; check it before submitting the action again.</p>
    <div className="transaction-history">{records.map(record => <details key={record.id}><summary><span>{operationLabels[record.operation] || 'Batch update'}</span><span className={`transaction-status status-${record.status}`}>{statuses[record.status]}</span></summary><ReceiptDetails record={record}/>{isHash(record.hash) && <button className="button secondary small" disabled={busy} onClick={() => check(record.hash, record)}>Check status</button>}</details>)}</div>
  </section>;
}
