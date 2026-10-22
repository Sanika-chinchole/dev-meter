import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keyFormatWarning, secretKeyFor } from './providerKeys.ts';

test('each provider gets its own secret slot', () => {
  assert.equal(secretKeyFor('anthropic'), 'devmeter.providerKey.anthropic');
  assert.equal(secretKeyFor('  Anthropic '), 'devmeter.providerKey.anthropic');
  assert.notEqual(secretKeyFor('anthropic'), secretKeyFor('openai'));
});

test('no warning for keys that look right', () => {
  assert.equal(keyFormatWarning('anthropic', 'sk-ant-api03-abc'), undefined);
  assert.equal(keyFormatWarning('openai', 'sk-proj-abc'), undefined);
  assert.equal(keyFormatWarning('gemini', 'AIzaSyExample'), undefined);
  assert.match(keyFormatWarning('gemini', 'sk-ant-abc')!, /start with "AIza"/);
  assert.equal(keyFormatWarning('some-new-lab', 'anything'), undefined);
});

test('warns about a wrong-provider or malformed key', () => {
  assert.match(keyFormatWarning('anthropic', 'sk-proj-abc')!, /start with "sk-ant-"/);
  assert.match(keyFormatWarning('openai', 'key-abc')!, /start with "sk-"/);
  assert.match(keyFormatWarning('anthropic', 'sk-ant- abc')!, /spaces/);
});

test('warnings never contain the key itself', () => {
  const key = 'secret-value-123';
  assert.doesNotMatch(keyFormatWarning('anthropic', key)!, /secret-value-123/);
});
