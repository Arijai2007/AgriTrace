import solc from 'solc';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const source = await readFile(resolve(root, 'contracts/BatchAnchor.sol'), 'utf8');
const result = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'BatchAnchor.sol': { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } } })));
for (const error of result.errors || []) { if (error.severity === 'error') throw new Error(error.formattedMessage); }
const contract = result.contracts['BatchAnchor.sol'].BatchAnchor;
await mkdir(resolve(root, 'contracts/artifacts'), { recursive: true });
await writeFile(resolve(root, 'contracts/artifacts/BatchAnchor.json'), JSON.stringify({ abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object }, null, 2));
console.log('BatchAnchor compiled successfully with solc ' + solc.version());
