import React, { useState } from 'react';
import { BrowserProvider } from 'ethers';
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
export async function submitWalletTransaction(tx, api) {
  const provider = await connectWallet(tx.chainId), signer = await provider.getSigner();
  if ((await signer.getAddress()).toLowerCase() !== tx.from.toLowerCase()) throw new Error('Switch MetaMask to the registered wallet: ' + tx.from);
  const sent = await signer.sendTransaction({ to: tx.to, data: tx.data });
  sessionStorage.setItem('agritrace-last-transaction', sent.hash);
  window.dispatchEvent(new Event('agritrace-transaction'));
  const receipt = await sent.wait();
  if (receipt.status !== 1) throw new Error('Blockchain transaction failed.');
  return api('/transactions/' + sent.hash);
}
export function WalletStatus({ health }) {
  const [address, setAddress] = useState(''), [error, setError] = useState('');
  React.useEffect(() => {
    const changed = () => setAddress('');
    window.ethereum?.on?.('accountsChanged', changed); window.ethereum?.on?.('chainChanged', changed);
    return () => { window.ethereum?.removeListener?.('accountsChanged', changed); window.ethereum?.removeListener?.('chainChanged', changed); };
  }, []);
  const [hash, setHash] = useState(sessionStorage.getItem('agritrace-last-transaction'));
  React.useEffect(() => { const update = () => setHash(sessionStorage.getItem('agritrace-last-transaction')); window.addEventListener('agritrace-transaction', update); return () => window.removeEventListener('agritrace-transaction', update); }, []);
  if (health?.ledgerMode !== 'ethereum') return null;
  return <div className="demo-note"><div><strong>Ethereum · {health.ethereum.chainId === 11155111 ? 'Sepolia testnet' : 'Local blockchain'}</strong><p>Every change requires a wallet transaction. Confirm in MetaMask and wait for mining.</p><button type="button" className="button secondary small" onClick={async () => { try { const p = await connectWallet(health.ethereum.chainId); setAddress(await (await p.getSigner()).getAddress()); setError(''); } catch(e) { setError(e.shortMessage || e.message); } }}>{address ? address.slice(0,8) + '…' + address.slice(-6) : 'Connect MetaMask'}</button><p role="status">{error}</p>{hash && <p className="hash">Last submitted transaction: {health.ethereum.chainId === 11155111 ? <a href={'https://sepolia.etherscan.io/tx/' + hash} target="_blank" rel="noreferrer">{hash}</a> : hash}</p>}</div></div>;
}
