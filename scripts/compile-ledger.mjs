import solc from 'solc';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const source = await readFile(new URL('../contracts/AgriTraceLedger.sol', import.meta.url), 'utf8');
const result = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'AgriTraceLedger.sol': { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } } })));
for (const e of result.errors || []) if (e.severity === 'error') throw new Error(e.formattedMessage);
const c = result.contracts['AgriTraceLedger.sol'].AgriTraceLedger;
export const artifact = { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
await mkdir(new URL('../contracts/artifacts/', import.meta.url), { recursive: true });
await writeFile(new URL('../contracts/artifacts/AgriTraceLedger.json', import.meta.url), JSON.stringify(artifact, null, 2));
