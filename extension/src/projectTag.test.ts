import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_PROJECT_TAG_LENGTH, resolveProjectTag } from './projectTag.ts';

test('uses the configured tag, trimmed', () => {
  assert.equal(resolveProjectTag('  devmeter  ', 'folder'), 'devmeter');
});

test('falls back to the workspace folder name when the setting is empty', () => {
  assert.equal(resolveProjectTag('', 'my-repo'), 'my-repo');
  assert.equal(resolveProjectTag('   ', 'my-repo'), 'my-repo');
  assert.equal(resolveProjectTag(undefined, 'my-repo'), 'my-repo');
});

test('is undefined when there is neither a setting nor a folder', () => {
  assert.equal(resolveProjectTag('', undefined), undefined);
  assert.equal(resolveProjectTag(undefined, '  '), undefined);
});

test('is capped at the backend limit', () => {
  assert.equal(resolveProjectTag('x'.repeat(150), undefined)?.length, MAX_PROJECT_TAG_LENGTH);
});
