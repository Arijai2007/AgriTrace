import ganache from 'ganache';
import { ContractFactory, JsonRpcProvider, Wallet, randomBytes, hexlify } from 'ethers';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { artifact } from './compile-ledger.mjs';
import { demoAccounts, passwordHash } from '../server/accounts.mjs';
const dir = resolve('.local'); await mkdir(dir, { recursive: true });
const configPath = resolve(dir, 'network.json');
let saved;
try { saved = JSON.parse(await readFile(configPath, 'utf8')); } catch(e) { if (e.code !== 'ENOENT') throw e; }
// Random development identities, persisted locally. Never reused on public chains.
const keys = saved?.keys || Array.from({ length: 7 }, () => hexlify(randomBytes(32)));
const node = ganache.server({ chain: { chainId: 1337 }, wallet: { accounts: keys.map(secretKey => ({ secretKey, balance: '0x3635c9adc5dea00000' })) }, database: { dbPath: resolve(dir, 'chain') }, logging: { quiet: true } });
await node.listen(8545, '127.0.0.1');
try {
  const provider = new JsonRpcProvider('http://127.0.0.1:8545');
  const validator = new Wallet(keys[6], provider);
  let address = saved?.address;
  if (!address || await provider.getCode(address) === '0x') {
    const c = await new ContractFactory(artifact.abi, artifact.bytecode, validator).deploy(validator.address);
    await c.waitForDeployment(); address = await c.getAddress();
  }
  await writeFile(configPath, JSON.stringify({ keys, address }, null, 2));
  const accounts = demoAccounts.map((a, i) => ({ ...a, wallet: new Wallet(keys[i]).address, ...passwordHash(process.env.LOCAL_PASSWORD || 'agritrace-local') }));
  await writeFile(resolve(dir, 'accounts.json'), JSON.stringify(accounts, null, 2));
  const envPath = resolve('.env.ethereum.local');
  await writeFile(envPath, `LEDGER_MODE=ethereum\nETH_RPC_URL=http://127.0.0.1:8545\nETH_CHAIN_ID=1337\nETH_LEDGER_ADDRESS=${address}\nETH_VALIDATOR_KEY=${keys[6]}\nACCOUNTS_FILE=.local/accounts.json\nJWT_SECRET=${saved?.jwtSecret || hexlify(randomBytes(48))}\nHOST=127.0.0.1\nPORT=4000\n`);
  await writeFile(resolve(dir, 'wallet-import.txt'), accounts.map((a,i) => `${a.role}: ${a.wallet}\nLocal test private key: ${keys[i]}\n`).join('\n'));
  console.log(`Local Ethereum running at http://127.0.0.1:8545 (chain 1337)\nContract: ${address}\nMetaMask import details: .local/wallet-import.txt (local test accounts only)\nSign-in password: ${process.env.LOCAL_PASSWORD ? '(configured LOCAL_PASSWORD)' : 'agritrace-local'}\nIn another terminal: npm run start:ethereum`);
} catch(e) { await node.close(); throw e; }
for (const sig of ['SIGINT','SIGTERM']) process.on(sig, async () => { await node.close(); process.exit(0); });
