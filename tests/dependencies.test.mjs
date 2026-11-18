import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('macOS file watchers remain optional for Linux and Windows installs', () => {
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
  for (const [name, dependency] of Object.entries(lock.packages)) {
    if (name.endsWith('/fsevents')) assert.equal(dependency.optional, true, `${name} must be optional`);
  }
});
