import { ContractFactory, JsonRpcProvider, Wallet } from 'ethers';
import { artifact } from './compile-ledger.mjs';
if (!process.env.ETH_RPC_URL || !process.env.DEPLOYER_PRIVATE_KEY || !process.env.ETH_VALIDATOR_KEY) throw new Error('Set ETH_RPC_URL, DEPLOYER_PRIVATE_KEY and ETH_VALIDATOR_KEY in the local environment.');
const provider = new JsonRpcProvider(process.env.ETH_RPC_URL);
try {
  if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error('Deployment restricted to Sepolia testnet');
  const validator = new Wallet(process.env.ETH_VALIDATOR_KEY);
  const c = await new ContractFactory(artifact.abi, artifact.bytecode, new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider)).deploy(validator.address);
  await c.waitForDeployment();
  console.log('ETH_LEDGER_ADDRESS=' + await c.getAddress());
  console.log('Deployment transaction: ' + c.deploymentTransaction().hash);
} finally { provider.destroy(); }
