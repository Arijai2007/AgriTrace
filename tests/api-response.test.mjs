import assert from 'node:assert/strict';
import test from 'node:test';
import { readApiResponse, retryStartupRead } from '../client/src/apiResponse.mjs';

test('startup recovers from a hosting rate-limit page after Retry-After', async () => {
  const limited = new Response('<!DOCTYPE html>', { status: 429, headers: { 'Retry-After': '4' } });
  const responses = [limited, Response.json({ status: 'ok' })];
  const delays = [];
  let waiting = false;
  const result = await retryStartupRead(
    () => readApiResponse(responses.shift()),
    () => { waiting = true; },
    async delay => delays.push(delay)
  );
  assert.equal(waiting, true);
  assert.deepEqual(delays, [4_000]);
  assert.deepEqual(result, { status: 'ok' });
});

test('startup retries only once and keeps the next rate limit visible', async () => {
  let calls = 0;
  const delays = [];
  await assert.rejects(
    retryStartupRead(
      () => { calls++; return readApiResponse(new Response(null, { status: 429 })); },
      undefined,
      async delay => delays.push(delay)
    ),
    /60 seconds/
  );
  assert.equal(calls, 2);
  assert.deepEqual(delays, [60_000]);
});

test('startup reports longer rate limits without scheduling a retry', async () => {
  await assert.rejects(
    retryStartupRead(
      () => readApiResponse(new Response(null, { status: 429, headers: { 'Retry-After': '90' } })),
      () => assert.fail('Unexpected retry')
    ),
    /90 seconds/
  );
});
