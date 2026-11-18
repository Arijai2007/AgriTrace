import { sha256, toUtf8Bytes } from 'ethers';

export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export const eventHash = event => sha256(toUtf8Bytes(canonical(event))).slice(2);
const pairHash = (a, b) => sha256(toUtf8Bytes([a, b].sort().join(''))).slice(2);

export function eventProof(events, index) {
  if (!Number.isInteger(index) || index < 0 || index >= events.length) throw new Error('Select a recorded event.');
  let level = events.map(eventHash); const proof = [];
  while (level.length > 1) {
    proof.push(level[index ^ 1] || level[index]);
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(pairHash(level[i], level[i + 1] || level[i]));
    index = Math.floor(index / 2); level = next;
  }
  return proof;
}

export function verifyEventCopy(event, proof, root) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('The event must be a JSON object.');
  if (!Array.isArray(proof) || ![root, ...proof].every(value => /^[0-9a-f]{64}$/.test(value))) throw new Error('Invalid Merkle proof or root.');
  const leaf = eventHash(event);
  const computedRoot = proof.reduce(pairHash, leaf);
  return { leaf, computedRoot, valid: computedRoot === root };
}
