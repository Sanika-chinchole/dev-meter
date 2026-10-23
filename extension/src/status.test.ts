import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type StatusInfo, statusLines, statusSummary } from './status.ts';

const base: StatusInfo = {
  session: { state: 'signed-in', email: 'ada@example.com', expires: new Date('2026-11-21T10:00:00Z') },
  backendUrl: 'http://localhost:8080',
  mockMode: false,
  provider: 'gemini',
  model: 'gemini-3.8-flash',
  modelIsDefault: true,
  apiKeySet: true,
  projectTag: 'devmeter',
  logSentEvents: false,
};

test('summary shows account, provider/model and mode', () => {
  assert.equal(statusSummary(base), 'DevMeter: Signed in as ada@example.com · gemini / gemini-3.8-flash · real mode');
  assert.equal(statusSummary({ ...base, session: { state: 'signed-out' }, mockMode: true }),
    'DevMeter: Not signed in · gemini / gemini-3.8-flash · mock mode');
  assert.match(statusSummary({ ...base, session: { state: 'expired' } }), /^DevMeter: Session expired/);
});

test('details cover every setting the user can check', () => {
  const text = statusLines(base).join('\n');
  assert.match(text, /signed in as ada@example\.com \(token valid until/);
  assert.match(text, /Backend: +http:\/\/localhost:8080/);
  assert.match(text, /Mode: +real/);
  assert.match(text, /Model: +gemini-3\.8-flash \(provider default\)/);
  assert.match(text, /API key: +set for gemini$/m);
  assert.match(text, /Project tag: +devmeter/);
});

test('mock mode, missing key, no project tag', () => {
  const text = statusLines({ ...base, mockMode: true, apiKeySet: false, projectTag: null, modelIsDefault: false }).join('\n');
  assert.match(text, /Mode: +mock/);
  assert.match(text, /API key: +not set for gemini \(not needed in mock mode\)/);
  assert.match(text, /Project tag: +\(none\)/);
  assert.doesNotMatch(text, /provider default/);
});
