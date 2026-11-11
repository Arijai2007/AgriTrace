import { BrowserProvider, ContractFactory, formatEther } from 'ethers';
const status = document.querySelector('#status'), details = document.querySelector('#details');
const token = new URLSearchParams(location.search).get('token');
let provider, wallet, config;
const api = async (path, body) => {
  const r = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', headers: { 'X-Setup-Token': token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await r.json(); if (!r.ok) throw new Error(result.error || 'Setup request failed'); return result;
};
const showError = e => { status.textContent = e.code === 4001 || e.code === 'ACTION_REJECTED' ? 'You declined the wallet request. No deployment was approved.' : e.shortMessage || e.message; };
const savedHash = () => localStorage.getItem('agritrace-sepolia-' + config.validator);
document.querySelector('#connect').onclick = async () => {
  try {
    config = await api('config');
    if (!window.ethereum) throw new Error('MetaMask is not available in this browser. Install the official extension and create or unlock your test wallet, then reload this page.');
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
    provider = new BrowserProvider(window.ethereum); wallet = await provider.getSigner();
    if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error('Select Sepolia in MetaMask.');
    const address = await wallet.getAddress(), balance = await provider.getBalance(address);
    status.textContent = 'Connected: ' + address + '\nSepolia balance: ' + formatEther(balance) + ' ETH.\n' + (savedHash() ? 'A submitted deployment is saved. Check it before sending another transaction.' : 'Review and approve the deployment in MetaMask when ready.');
    details.textContent = 'API validator address: ' + config.validator;
    document.querySelector('#deploy').disabled = balance === 0n || Boolean(savedHash());
    document.querySelector('#check').disabled = !savedHash();
  } catch(e) { showError(e); }
};
document.querySelector('#deploy').onclick = async () => {
  document.querySelector('#deploy').disabled = true;
  try {
    if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error('Select Sepolia.');
    const factory = new ContractFactory(config.artifact.abi, config.artifact.bytecode, wallet);
    const request = await factory.getDeployTransaction(config.validator);
    const gas = await wallet.estimateGas(request), fees = await provider.getFeeData();
    details.textContent += '\nEstimated network fee: ' + formatEther(gas * (fees.maxFeePerGas || fees.gasPrice)) + ' test ETH. Final fee appears in MetaMask.';
    status.textContent = 'Review the contract deployment in MetaMask. Approve only if you want to proceed.';
    const contract = await factory.deploy(config.validator);
    const hash = contract.deploymentTransaction().hash;
    localStorage.setItem('agritrace-sepolia-' + config.validator, hash);
    status.textContent = 'Submitted: ' + hash + '\nWaiting for Sepolia confirmation. Keep this page open.';
    document.querySelector('#check').disabled = false;
    await contract.waitForDeployment();
    await check();
  } catch(e) { showError(e); document.querySelector('#deploy').disabled = Boolean(savedHash()); }
};
async function check() {
  try {
    const result = await api('deployment', { hash: savedHash() });
    status.textContent = 'Deployment confirmed in block ' + result.blockNumber + '.\nContract: ' + result.address + '\nPublic deployment details saved locally. Return to the chat so Render and participant wallets can be configured.';
    details.textContent = JSON.stringify(result, null, 2);
  } catch(e) { showError(e); }
}
document.querySelector('#check').onclick = check;
window.ethereum?.on?.('accountsChanged', () => location.reload());
window.ethereum?.on?.('chainChanged', () => location.reload());
