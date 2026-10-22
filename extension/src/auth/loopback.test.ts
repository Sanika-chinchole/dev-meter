import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type LoopbackSession, startLoopback } from './loopback.ts';

const LONG = 60_000;

/** What the backend does: append ?token= or ?error= to the redirect_uri. */
function callbackUrl(session: LoopbackSession, params: Record<string, string>, path?: string): string {
  const url = new URL(session.redirectUri);
  if (path !== undefined) {
    url.pathname = path;
  }
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function stateOf(session: LoopbackSession): string {
  return new URL(session.redirectUri).pathname.split('/')[2]!;
}

test('redirectUri is a loopback /cb/<state> URL with no query, so re-encoding cannot break it', async () => {
  const a = await startLoopback({ timeoutMs: LONG });
  const b = await startLoopback({ timeoutMs: LONG });
  assert.match(a.redirectUri, /^http:\/\/127\.0\.0\.1:\d+\/cb\/[\w-]{43}$/);
  assert.equal(encodeURIComponent(stateOf(a)), stateOf(a));
  assert.notEqual(stateOf(a), stateOf(b));
  a.cancel();
  b.cancel();
});

test('valid callback delivers the token, shows a page without it, and closes the server', async () => {
  const session = await startLoopback({ timeoutMs: LONG });
  const response = await fetch(callbackUrl(session, { token: 'jwt-123' }));

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /You can close this tab/);
  assert.doesNotMatch(html, /jwt-123/);
  assert.deepEqual(await session.result, { kind: 'token', token: 'jwt-123' });
  await assert.rejects(fetch(session.redirectUri)); // server is gone
});

test('wrong or missing state is rejected and the real callback still works', async () => {
  const session = await startLoopback({ timeoutMs: LONG });
  assert.equal((await fetch(callbackUrl(session, { token: 'attacker-token' }, '/cb/attacker'))).status, 400);
  assert.equal((await fetch(callbackUrl(session, { token: 'attacker-token' }, '/cb'))).status, 400);
  assert.equal((await fetch(callbackUrl(session, { token: 'attacker-token' }, '/cb/'))).status, 400);

  await fetch(callbackUrl(session, { token: 'real-token' }));
  assert.deepEqual(await session.result, { kind: 'token', token: 'real-token' });
});

test('error callback reports the error code', async () => {
  const session = await startLoopback({ timeoutMs: LONG });
  const response = await fetch(callbackUrl(session, { error: 'access_denied' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await session.result, { kind: 'error', code: 'access_denied' });
});

test('callback with neither token nor error fails', async () => {
  const session = await startLoopback({ timeoutMs: LONG });
  assert.equal((await fetch(session.redirectUri)).status, 400);
  assert.deepEqual(await session.result, { kind: 'error', code: 'login_failed' });
});

test('other paths and methods get 404 and do not end the session', async () => {
  const session = await startLoopback({ timeoutMs: LONG });
  assert.equal((await fetch(callbackUrl(session, {}, '/favicon.ico'))).status, 404);
  assert.equal((await fetch(callbackUrl(session, { token: 'x' }, `/cb/${stateOf(session)}/extra`))).status, 404);
  assert.equal((await fetch(callbackUrl(session, { token: 'x' }), { method: 'POST' })).status, 404);

  session.cancel();
  assert.deepEqual(await session.result, { kind: 'cancelled' });
});

test('times out and closes the server', async () => {
  const session = await startLoopback({ timeoutMs: 50 });
  assert.deepEqual(await session.result, { kind: 'timeout' });
  await assert.rejects(fetch(session.redirectUri));
});

test('only the first outcome counts', async () => {
  const session = await startLoopback({ timeoutMs: LONG });
  session.cancel();
  session.cancel();
  assert.deepEqual(await session.result, { kind: 'cancelled' });
});
