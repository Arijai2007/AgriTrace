import { BrowserProvider, JsonRpcProvider, Interface } from 'ethers';
import { isHash, receiptFields } from './transactionModel.mjs';

const ledgerInterface = new Interface(['function commit(bytes32,bytes32,string,uint256,bytes)']);
export function receiptOperation(data) {
  try {
    const call = ledgerInterface.parseTransaction({ data });
    const record = JSON.parse(call.args[2]);
    return { HARVEST: 'create', TRANSFER: 'transfer', SENSOR: 'sensor', CERTIFICATE: 'certificates', RECALL: 'recall', COMPLAINT: 'complaint', COMPLAINT_RESOLVED: 'resolveComplaint' }[record.events.at(-1).type] || 'imported';
  } catch { return 'imported'; }
}

export async function inspectReceipt(hash, ethereum) {
  if (!isHash(hash)) throw new Error('Enter a valid Ethereum transaction hash (0x followed by 64 hex characters).');
  if (!ethereum?.contract) throw new Error('Ethereum is not configured.');
  let provider, owned = false;
  if (window.ethereum && Number(await window.ethereum.request({ method: 'eth_chainId' })) === ethereum.chainId) provider = new BrowserProvider(window.ethereum);
  else if (ethereum.chainId === 11155111) {
    provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com', 11155111, { batchMaxCount: 1 }); owned = true;
  } else throw new Error('Select the configured local network in MetaMask to inspect a receipt.');
  try {
    const receipt = await provider.getTransactionReceipt(hash);
    const tx = await provider.getTransaction(hash);
    const evidence = receipt || tx;
    if (!evidence) throw new Error('Transaction not found on this network.');
    if (evidence.to?.toLowerCase() !== ethereum.contract.toLowerCase()) throw new Error('This transaction is not for the configured AgriTrace contract.');
    return { hash, from: evidence.from, operation: receiptOperation(tx?.data), ...(receipt ? receiptFields(receipt) : { status: 'pending' }) };
  } finally { if (owned) provider.destroy(); }
}
