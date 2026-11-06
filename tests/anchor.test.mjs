import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import solc from 'solc';
test('Solidity anchor compiles without errors and exposes versioned roots and publisher authorization', async()=>{
 const content=await readFile(new URL('../contracts/BatchAnchor.sol',import.meta.url),'utf8');
 const result=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'BatchAnchor.sol':{content}},settings:{evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode']}}}})));
 assert.deepEqual((result.errors||[]).filter(e=>e.severity==='error'),[]);
 const c=result.contracts['BatchAnchor.sol'].BatchAnchor;assert.ok(c.evm.bytecode.object.length>100);assert.ok(c.abi.some(e=>e.name==='anchor'));assert.ok(c.abi.some(e=>e.name==='setPublisher'));assert.ok(c.abi.some(e=>e.name==='roots'));
});
