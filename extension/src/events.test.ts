import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEventPayload, type CallMetadata } from './events.ts';

const call: CallMetadata = {
  model: 'claude-sonnet-4-5',
  provider: 'anthropic',
  inputTokens: 1200,
  outputTokens: 300,
  latencyMs: 850,
  projectTag: 'devmeter',
};

test('payload has exactly the six documented fields', () => {
  assert.deepEqual(Object.keys(buildEventPayload(call)).sort(),
    ['inputTokens', 'latencyMs', 'model', 'outputTokens', 'projectTag', 'provider']);
  assert.deepEqual(buildEventPayload(call), call);
});

test('extra fields on the input never reach the payload', () => {
  const withText = { ...call, prompt: 'my secret prompt', response: 'the answer', text: 'x' } as CallMetadata;
  const json = JSON.stringify(buildEventPayload(withText));
  assert.doesNotMatch(json, /secret|answer|"prompt"|"response"|"text"/);
});

test('missing project tag is sent as null', () => {
  assert.equal(JSON.stringify(buildEventPayload({ ...call, projectTag: null })).includes('"projectTag":null'), true);
});
