import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractFactory, JsonRpcProvider, Wallet } from 'ethers';
if (!process.env.SEPOLIA_RPC_URL || !process.env.DEPLOYER_PRIVATE_KEY) throw new Error('Set SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY in your local environment. Never commit a private key.');
const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error('Deployment is restricted to Sepolia testnet');
const artifact = JSON.parse(await readFile(resolve(import.meta.dirname, '../contracts/artifacts/BatchAnchor.json'), 'utf8'));
const contract = await new ContractFactory(artifact.abi, artifact.bytecode, new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider)).deploy();
await contract.waitForDeployment(); console.log('ANCHOR_ADDRESS=' + await contract.getAddress());
