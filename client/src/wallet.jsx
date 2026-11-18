import React, { useState } from 'react';
import { BrowserProvider } from 'ethers';
import { trackWalletTransaction } from './transactionFlow.mjs';
import { saveTransaction } from './transactionModel.mjs';
export async function connectWallet(chainId) {
  if (!window.ethereum) throw new Error('Install MetaMask to connect your wallet.');
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  const hex = '0x' + chainId.toString(16);
  try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] }); }
  catch (e) {
    if (e.code !== 4902 || ![1337,31337].includes(chainId)) throw e;
    await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: hex, chainName: 'AgriTrace Local', nativeCurrency: { name: 'Test Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['http://127.0.0.1:8545'] }] });
  }
  const provider = new BrowserProvider(window.ethereum);
  if (Number((await provider.getNetwork()).chainId) !== chainId) throw new Error('Select the configured blockchain in MetaMask.');
  return provider;
}
export async function submitWalletTransaction(tx, api, operation) {
  return trackWalletTransaction(tx, { connect: connectWallet, api, operation, save: record => {
    if (record.hash) { try { sessionStorage.setItem('agritrace-last-transaction', record.hash); } catch { /* Optional browser convenience. */ } }
    saveTransaction(record);
  } });
}
export function WalletStatus({ health }) {
  const [address, setAddress] = useState(''), [error, setError] = useState('');
  React.useEffect(() => {
    let cancelled = false, revision = 0;
    const sync = async () => {
      const current = ++revision;
      try {
        if (!window.ethereum || health?.ledgerMode !== 'ethereum') return;
        const [accounts, chain] = await Promise.all([
          window.ethereum.request({ method: 'eth_accounts' }),
          window.ethereum.request({ method: 'eth_chainId' })
        ]);
        if (!cancelled && current === revision) setAddress(Number(chain) === health.ethereum.chainId ? accounts[0] || '' : '');
      } catch { if (!cancelled && current === revision) setAddress(''); }
    };
    sync();
    window.ethereum?.on?.('accountsChanged', sync); window.ethereum?.on?.('chainChanged', sync);
    return () => { cancelled = true; window.ethereum?.removeListener?.('accountsChanged', sync); window.ethereum?.removeListener?.('chainChanged', sync); };
  }, [health?.ledgerMode, health?.ethereum?.chainId]);
  const [hash, setHash] = useState(sessionStorage.getItem('agritrace-last-transaction'));
  React.useEffect(() => { const update = () => setHash(sessionStorage.getItem('agritrace-last-transaction')); window.addEventListener('agritrace-transaction', update); return () => window.removeEventListener('agritrace-transaction', update); }, []);
  if (health?.ledgerMode !== 'ethereum') return null;
  return <div className="demo-note"><div><strong>Ethereum · {health.ethereum.chainId === 11155111 ? 'Sepolia testnet' : 'Local blockchain'}</strong><p>Every change requires a wallet transaction. Confirm in MetaMask and wait for mining.</p><button type="button" className="button secondary small" onClick={async () => { try { const p = await connectWallet(health.ethereum.chainId); setAddress(await (await p.getSigner()).getAddress()); setError(''); } catch(e) { setError(e.shortMessage || e.message); } }}>{address ? address.slice(0,8) + '…' + address.slice(-6) : 'Connect MetaMask'}</button><p role="status">{error}</p>{hash && <p className="hash">Last submitted transaction: {health.ethereum.chainId === 11155111 ? <a href={'https://sepolia.etherscan.io/tx/' + hash} target="_blank" rel="noreferrer">{hash}</a> : hash}</p>}</div></div>;
}
