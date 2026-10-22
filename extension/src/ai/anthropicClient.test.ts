import assert from 'node:assert/strict';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { AnthropicClient, describeAnthropicFailure } from './anthropicClient.ts';

let server: Server;
let baseURL: string;
let last: { url: string; headers: IncomingHttpHeaders; body: Record<string, unknown> } | undefined;

const message = (overrides: object) => ({
  id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', stop_sequence: null,
  content: [], stop_reason: 'end_turn', usage: { input_tokens: 12, output_tokens: 34 }, ...overrides,
});
const apiError = (type: string) => ({ type: 'error', error: { type, message: `${type} from fake server` } });

/** The API key as sent by the SDK (v1.x sends it as a Bearer token). */
const apiKeyOf = (headers: IncomingHttpHeaders) =>
  headers['x-api-key'] ?? headers.authorization?.replace(/^Bearer /, '');

/** Fake Anthropic API: the API key picks the scenario. */
before(async () => {
  server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      last = { url: request.url ?? '', headers: request.headers, body: JSON.parse(raw || '{}') };
      const reply = (status: number, json: object) => {
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(json));
      };
      switch (apiKeyOf(request.headers)) {
        case 'key-ok': return reply(200, message({
          content: [{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'text', text: 'Hello' }, { type: 'text', text: 'World' }],
        }));
        case 'key-fallback': return reply(200, message({ model: 'claude-sonnet-5', content: [{ type: 'text', text: 'From fallback' }] }));
        case 'key-refusal': return reply(200, message({ content: [], stop_reason: 'refusal', usage: { input_tokens: 9, output_tokens: 3 } }));
        case 'key-401': return reply(401, apiError('authentication_error'));
        case 'key-403': return reply(403, apiError('permission_error'));
        case 'key-404': return reply(404, apiError('not_found_error'));
        case 'key-429': return reply(429, apiError('rate_limit_error'));
        case 'key-529': return reply(529, apiError('overloaded_error'));
        case 'key-slow': return void setTimeout(() => reply(200, message({})), 5_000);
        default: return reply(500, apiError('api_error'));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

const client = (key: string) => new AnthropicClient(key, { baseURL, maxRetries: 0 });
const failureFor = async (key: string, signal?: AbortSignal) => {
  try {
    await client(key).complete({ prompt: 'hi', model: 'claude-sonnet-5-5' }, signal);
  } catch (error) {
    return describeAnthropicFailure(error, 'claude-sonnet-5-5');
  }
  assert.fail('expected the call to fail');
};

test('sends the agreed request: model, 16k max_tokens, low effort, default fallback, key header', async () => {
  await client('key-ok').complete({ prompt: 'explain this', model: 'claude-sonnet-5-5' });

  assert.match(last!.url, /^\/v1\/messages/);
  assert.equal(apiKeyOf(last!.headers), 'key-ok');
  assert.ok(last!.headers['anthropic-version']);
  assert.match(String(last!.headers['anthropic-beta']), /server-side-fallback-2026-07-01/);
  assert.deepEqual(last!.body, {
    model: 'claude-sonnet-5-5',
    max_tokens: 16000,
    output_config: { effort: 'low' },
    fallbacks: 'default',
    messages: [{ role: 'user', content: 'explain this' }],
  });
});

test('collects all text blocks (skipping thinking) and reports usage and the served model', async () => {
  const response = await client('key-ok').complete({ prompt: 'hi', model: 'claude-sonnet-5-5' });
  assert.deepEqual(response, { text: 'Hello\n\nWorld', model: 'claude-sonnet-5-5', inputTokens: 12, outputTokens: 34, stopReason: 'end_turn' });
});

test('records the model that actually answered when the fallback ran', async () => {
  const response = await client('key-fallback').complete({ prompt: 'hi', model: 'claude-sonnet-5-5' });
  assert.equal(response.model, 'claude-sonnet-5');
});

test('a refusal still returns usage, so it can be recorded', async () => {
  const response = await client('key-refusal').complete({ prompt: 'hi', model: 'claude-sonnet-5-5' });
  assert.equal(response.stopReason, 'refusal');
  assert.equal(response.text, '');
  assert.equal(response.inputTokens, 9);
});

test('maps API errors to user messages', async () => {
  assert.deepEqual(await failureFor('key-401'), { kind: 'error', message: 'Your Anthropic API key was rejected.', offerSetApiKey: true });
  assert.deepEqual(await failureFor('key-403'),
    { kind: 'error', message: "Your Anthropic API key doesn't have access to claude-sonnet-5-5.", offerSetApiKey: true });
  assert.match(JSON.stringify(await failureFor('key-404')), /not found\. Check the devmeter\.model setting/);
  assert.match(JSON.stringify(await failureFor('key-429')), /rate limit/);
  assert.match(JSON.stringify(await failureFor('key-529')), /overloaded/);
});

test('cancelling aborts the request', async () => {
  const abort = new AbortController();
  setTimeout(() => abort.abort(), 50);
  assert.deepEqual(await failureFor('key-slow', abort.signal), { kind: 'cancelled' });
});

test('an unreachable API is reported as a connection problem', async () => {
  try {
    await new AnthropicClient('key-ok', { baseURL: 'http://127.0.0.1:1', maxRetries: 0 })
      .complete({ prompt: 'hi', model: 'm' });
    assert.fail('expected failure');
  } catch (error) {
    assert.match(JSON.stringify(describeAnthropicFailure(error, 'm')), /Can't reach api\.anthropic\.com/);
  }
});
