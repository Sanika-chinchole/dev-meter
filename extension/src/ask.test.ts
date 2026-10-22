import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import type { AiClient, AiRequest } from './ai/client.ts';
import { estimateTokens, MockClient } from './ai/mockClient.ts';
import { ask, previewOf } from './ask.ts';

class RecordingClient implements AiClient {
  calls: AiRequest[] = [];

  async complete(request: AiRequest) {
    this.calls.push(request);
    await sleep(20);
    return { text: 'answer', model: 'claude-sonnet-4-5-20250929', inputTokens: 3, outputTokens: 5 };
  }
}

test('a blocked prompt never reaches the AI client', async () => {
  const client = new RecordingClient();
  const outcome = await ask('my secret', {
    scan: async () => ({ ok: false, reason: 'Contains an API key.' }),
    client,
    model: 'claude-sonnet-4-5',
  });
  assert.deepEqual(outcome, { kind: 'blocked', reason: 'Contains an API key.' });
  assert.equal(client.calls.length, 0);
});

test('an allowed prompt is answered with the model the client reports', async () => {
  const client = new RecordingClient();
  const outcome = await ask('hello', { scan: async () => ({ ok: true }), client, model: 'claude-sonnet-4-5' });

  assert.equal(outcome.kind, 'answered');
  assert.deepEqual(client.calls, [{ prompt: 'hello', model: 'claude-sonnet-4-5' }]);
  assert.equal(outcome.kind === 'answered' && outcome.response.model, 'claude-sonnet-4-5-20250929');
});

test('latency covers the AI call only, not the scan', async () => {
  const outcome = await ask('hello', {
    scan: async () => { await sleep(150); return { ok: true }; },
    client: new RecordingClient(), // ~20 ms
    model: 'm',
  });
  assert.equal(outcome.kind, 'answered');
  if (outcome.kind === 'answered') {
    assert.ok(outcome.latencyMs >= 15 && outcome.latencyMs < 120, `latencyMs was ${outcome.latencyMs}`);
    assert.ok(Number.isInteger(outcome.latencyMs));
  }
});

test('mock token estimate is about 1.3 per word, at least 1', () => {
  assert.equal(estimateTokens('one two three four five six seven eight nine ten'), 13);
  assert.equal(estimateTokens('  spread\n\nout\twords  '), 4);
  assert.equal(estimateTokens(''), 1);
});

test('mock client: requested model, estimated input, 200 output tokens', async () => {
  const response = await new MockClient(0).complete({ prompt: 'explain this code', model: 'claude-haiku' });
  assert.equal(response.model, 'claude-haiku');
  assert.equal(response.inputTokens, 4);
  assert.equal(response.outputTokens, 200);
  assert.match(response.text, /mock mode/);
});

test('preview collapses whitespace and truncates', () => {
  assert.equal(previewOf('  explain\n  this\tcode '), 'explain this code');
  const long = previewOf('x'.repeat(200));
  assert.equal(long.length, 80);
  assert.ok(long.endsWith('…'));
});
