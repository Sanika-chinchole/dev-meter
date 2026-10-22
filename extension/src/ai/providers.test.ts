import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AnthropicClient } from './anthropicClient.ts';
import { GeminiClient } from './geminiClient.ts';
import { realProvider, resolveModel, SUPPORTED_PROVIDERS } from './providers.ts';

test('anthropic and gemini are the real-mode providers', () => {
  assert.deepEqual(SUPPORTED_PROVIDERS, ['anthropic', 'gemini']);
  assert.ok(realProvider('anthropic')!.createClient('k') instanceof AnthropicClient);
  assert.ok(realProvider('gemini')!.createClient('k') instanceof GeminiClient);
  assert.equal(realProvider('openai'), undefined);
});

test('empty model setting means the provider default', () => {
  assert.equal(resolveModel('', 'anthropic'), 'claude-sonnet-5-5');
  assert.equal(resolveModel(undefined, 'gemini'), 'gemini-3.8-flash');
  assert.equal(resolveModel('  ', 'gemini'), 'gemini-3.8-flash');
  assert.equal(resolveModel('', 'something-else'), 'claude-sonnet-5-5');
});

test('an explicit model setting wins', () => {
  assert.equal(resolveModel(' gemini-2.5-pro ', 'gemini'), 'gemini-2.5-pro');
  assert.equal(resolveModel('claude-opus-5-5', 'anthropic'), 'claude-opus-5-5');
});
