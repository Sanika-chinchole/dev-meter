import assert from 'node:assert/strict';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { BackendError, buildLoginUrl, fetchMe, postEvent } from './backendApi.ts';
import type { CallMetadata } from './events.ts';

let server: Server;
let baseUrl: string;
let lastEvent: { headers: IncomingHttpHeaders; body: string } | undefined;

const EVENT: CallMetadata = {
  model: 'claude-sonnet-4-5', provider: 'anthropic', inputTokens: 1200, outputTokens: 300, latencyMs: 850, projectTag: null,
};

/** Test backend: the token in the Authorization header picks the response for /events. */
before(async () => {
  server = createServer((request, response) => {
    const auth = request.headers.authorization;
    if (request.url === '/auth/me') {
      if (auth === 'Bearer good-token') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ id: 'u1', email: 'ada@example.com', name: null }));
      } else {
        response.writeHead(401).end();
      }
      return;
    }
    if (request.url === '/events' && request.method === 'POST') {
      let body = '';
      request.on('data', (chunk) => { body += chunk; });
      request.on('end', () => {
        lastEvent = { headers: request.headers, body };
        const reply = (status: number, json?: object) => {
          response.writeHead(status, { 'Content-Type': 'application/json' });
          response.end(json ? JSON.stringify(json) : undefined);
        };
        switch (auth) {
          case 'Bearer good-token': return reply(201, { id: 'e1', costUsd: 0.0081, priced: true });
          case 'Bearer expired-token': return reply(401);
          case 'Bearer invalid-body': return reply(400, {
            detail: 'Request validation failed', errors: [{ field: 'model', message: 'size must be between 0 and 200' }] });
          default: return reply(500);
        }
      });
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

test('buildLoginUrl encodes the redirect_uri and tolerates a trailing slash', () => {
  assert.equal(
    buildLoginUrl('http://localhost:8080/', 'http://127.0.0.1:5555/cb/abc'),
    'http://localhost:8080/auth/login?redirect_uri=http%3A%2F%2F127.0.0.1%3A5555%2Fcb%2Fabc',
  );
});

test('fetchMe returns the user for a valid token', async () => {
  assert.deepEqual(await fetchMe(`${baseUrl}/`, 'good-token'), { id: 'u1', email: 'ada@example.com', name: null });
});

test('fetchMe reports a rejected token as 401', async () => {
  await assert.rejects(fetchMe(baseUrl, 'bad-token'), (error: unknown) =>
    error instanceof BackendError && error.status === 401);
});

test('fetchMe reports an unreachable backend', async () => {
  await assert.rejects(fetchMe('http://127.0.0.1:1', 'good-token'), (error: unknown) =>
    error instanceof BackendError && error.status === undefined && /Can't reach/.test(error.message));
});

test('postEvent sends the bearer token and exactly the payload as JSON', async () => {
  assert.deepEqual(await postEvent(baseUrl, 'good-token', EVENT), { kind: 'recorded', id: 'e1', costUsd: 0.0081, priced: true });
  assert.equal(lastEvent?.headers.authorization, 'Bearer good-token');
  assert.equal(lastEvent?.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(lastEvent!.body), EVENT);
});

test('postEvent maps 401, 400, 500 and network errors to results instead of throwing', async () => {
  assert.deepEqual(await postEvent(baseUrl, 'expired-token', EVENT), { kind: 'unauthorized' });
  assert.deepEqual(await postEvent(baseUrl, 'invalid-body', EVENT),
    { kind: 'rejected', detail: 'Request validation failed; model size must be between 0 and 200' });
  assert.deepEqual(await postEvent(baseUrl, 'server-error', EVENT), { kind: 'failed', reason: 'The backend returned HTTP 500' });
  const unreachable = await postEvent('http://127.0.0.1:1', 'good-token', EVENT);
  assert.equal(unreachable.kind, 'failed');
});
