import express from 'express';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Wallet, JsonRpcProvider, ContractFactory } from 'ethers';
import { build } from 'esbuild';
import { artifact } from './compile-ledger.mjs';

const folder = resolve('.local/sepolia');
await mkdir(folder, { recursive: true });
const keyFile = resolve(folder, 'validator.json');
let validator;
try { validator = JSON.parse(await readFile(keyFile, 'utf8')); }
catch (e) {
  if (e.code !== 'ENOENT') throw e;
  const wallet = Wallet.createRandom();
  validator = { address: wallet.address, privateKey: wallet.privateKey };
  await writeFile(keyFile, JSON.stringify(validator, null, 2), { mode: 0o600 });
}
const token = randomBytes(32).toString('hex');
const rpc = process.env.ETH_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const client = await build({ stdin: { contents: await readFile(new URL('./setup-sepolia-client.mjs', import.meta.url), 'utf8'), resolveDir: resolve('.') }, bundle: true, write: false, format: 'esm', minify: true });
const app = express();
app.use((req, res, next) => {
  if (req.headers.host !== '127.0.0.1:4317') return res.sendStatus(403);
  if (req.headers.origin && req.headers.origin !== 'http://127.0.0.1:4317') return res.sendStatus(403);
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json({ limit: '4kb' }));
app.get('/', (req, res) => res.type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AgriTrace · Sepolia setup</title><style>body{font:18px system-ui;background:#eef3e8;color:#183e2e;margin:0;padding:50px}main{max-width:850px;margin:auto;background:white;border-radius:22px;padding:40px}h1{font-size:40px}button{background:#214e38;color:white;border:0;border-radius:9px;padding:16px 24px;font:inherit;cursor:pointer;margin:8px 8px 8px 0}button:disabled{opacity:.5}code,pre{overflow-wrap:anywhere;white-space:pre-wrap}#status{padding:20px;background:#edf4e7;border-radius:12px;line-height:1.6}small{display:block;line-height:1.7}</style><main><p>AGRITRACE / TESTNET SETUP</p><h1>Connect your wallet.<br>Deploy on Sepolia.</h1><p>This page deploys the actual AgriTraceLedger contract. Your wallet stays inside MetaMask. The separate API validator key stays on this computer.</p><ol><li>Use a dedicated test wallet with Sepolia test ETH.</li><li>Connect MetaMask and select Sepolia.</li><li>Review the deployment transaction in MetaMask and approve it yourself.</li></ol><button id="connect">Connect MetaMask</button><button id="deploy" disabled>Deploy AgriTrace contract</button><button id="check" disabled>Check submitted deployment</button><p id="status" role="status">Ready. No transaction has been sent.</p><small>Sepolia chain ID: 11155111. Test ETH only; no purchase is required. Approval is entirely your choice. This step does not switch the hosted app out of demo mode.</small><pre id="details"></pre><script type="module" src="/client.js"></script></main></html>`));
app.get('/client.js', (req, res) => res.type('application/javascript').send(client.outputFiles[0].text));
app.use('/api', (req, res, next) => req.headers['x-setup-token'] === token ? next() : res.sendStatus(403));
app.get('/api/config', (req, res) => res.json({ artifact, validator: validator.address, rpc }));
app.post('/api/deployment', async (req, res) => {
  const provider = new JsonRpcProvider(rpc);
  try {
    const { hash } = req.body;
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('Invalid transaction hash');
    if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error('RPC is not Sepolia');
    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt) return res.status(409).json({ error: 'Not mined yet. Use Check submitted deployment again shortly.' });
    if (receipt.status !== 1 || !receipt.contractAddress) throw new Error('Deployment did not succeed');
    const tx = await provider.getTransaction(hash);
    const expected = await new ContractFactory(artifact.abi, artifact.bytecode).getDeployTransaction(validator.address);
    if (tx.to !== null || tx.value !== 0n || tx.data.toLowerCase() !== expected.data.toLowerCase()) throw new Error('Transaction does not deploy the prepared AgriTrace contract');
    const result = { address: receipt.contractAddress, transactionHash: hash, blockNumber: receipt.blockNumber, deployer: tx.from, validator: validator.address, chainId: 11155111, rpc };
    await writeFile(resolve(folder, 'deployment.json'), JSON.stringify(result, null, 2));
    res.json(result);
  } catch(e) { res.status(400).json({ error: e.shortMessage || e.message }); }
  finally { provider.destroy(); }
});
const server = app.listen(4317, '127.0.0.1', () => console.log('Open wallet setup: http://127.0.0.1:4317/?token=' + token));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
