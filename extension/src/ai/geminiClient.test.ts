import assert from 'node:assert/strict';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { describeGeminiFailure, GeminiClient } from './geminiClient.ts';

let server: Server;
let baseUrl: string;
let last: { url: string; headers: IncomingHttpHeaders; body: unknown } | undefined;
const attempts = new Map<string, number>();

const ok = (overrides: object = {}) => ({
  candidates: [{ content: { role: 'model', parts: [{ text: 'Hello ' }, { text: 'World' }] }, finishReason: 'STOP' }],
  usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 20, thoughtsTokenCount: 30, totalTokenCount: 61 },
  modelVersion: 'gemini-3.8-flash-001',
  ...overrides,
});
const apiError = (code: number, status: string, reason?: string) => ({
  error: { code, message: `${status} from fake server`, status, details: reason ? [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason }] : [] },
});

/** Fake Gemini API: the x-goog-api-key picks the scenario. */
before(async () => {
  server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      last = { url: request.url ?? '', headers: request.headers, body: JSON.parse(raw || '{}') };
      const key = String(request.headers['x-goog-api-key']);
      attempts.set(key, (attempts.get(key) ?? 0) + 1);
      const reply = (status: number, json: object) => {
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(json));
      };
      switch (key) {
        case 'key-ok': return reply(200, ok());
        case 'key-no-version': return reply(200, ok({ modelVersion: undefined }));
        case 'key-thoughts': return reply(200, ok({ candidates: [{ content: { parts: [{ text: 'secret thoughts', thought: true }, { text: 'Answer' }] }, finishReason: 'STOP' }] }));
        case 'key-blocked': return reply(200, { promptFeedback: { blockReason: 'SAFETY' }, usageMetadata: { promptTokenCount: 7 } });
        case 'key-max': return reply(200, ok({ candidates: [{ content: { parts: [{ text: 'Cut' }] }, finishReason: 'MAX_TOKENS' }] }));
        case 'key-invalid': return reply(400, apiError(400, 'INVALID_ARGUMENT', 'API_KEY_INVALID'));
        case 'key-401': return reply(401, apiError(401, 'UNAUTHENTICATED'));
        case 'key-404': return reply(404, apiError(404, 'NOT_FOUND'));
        case 'key-flaky': return attempts.get(key)! < 3 ? reply(503, apiError(503, 'UNAVAILABLE')) : reply(200, ok());
        case 'key-429': return reply(429, apiError(429, 'RESOURCE_EXHAUSTED'));
        case 'key-slow': return void setTimeout(() => reply(200, ok()), 5_000);
        default: return reply(500, apiError(500, 'INTERNAL'));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

const client = (key: string) => new GeminiClient(key, { baseUrl, maxRetries: 2, retryDelayMs: 5 });
const failureFor = async (key: string, signal?: AbortSignal) => {
  try {
    await client(key).complete({ prompt: 'hi', model: 'gemini-3.8-flash' }, signal);
  } catch (error) {
    return describeGeminiFailure(error, 'gemini-3.8-flash');
  }
  assert.fail('expected the call to fail');
};

test('sends only the prompt to the model endpoint, with the key in a header (not the URL)', async () => {
  await client('key-ok').complete({ prompt: 'explain this', model: 'gemini-3.8-flash' });
  assert.equal(last!.url, '/v1beta/models/gemini-3.8-flash:generateContent');
  assert.equal(last!.headers['x-goog-api-key'], 'key-ok');
  assert.deepEqual(last!.body, { contents: [{ role: 'user', parts: [{ text: 'explain this' }] }] });
});

test('reads text, reported model, and real token counts (thinking counted as output)', async () => {
  assert.deepEqual(await client('key-ok').complete({ prompt: 'hi', model: 'gemini-3.8-flash' }), {
    text: 'Hello World', model: 'gemini-3.8-flash-001', inputTokens: 11, outputTokens: 50, stopReason: 'end_turn',
  });
});

test('falls back to the requested model when the response has no modelVersion', async () => {
  assert.equal((await client('key-no-version').complete({ prompt: 'hi', model: 'gemini-3.8-flash' })).model, 'gemini-3.8-flash');
});

test('skips thought parts in the answer text', async () => {
  assert.equal((await client('key-thoughts').complete({ prompt: 'hi', model: 'm' })).text, 'Answer');
});

test('blocked prompts and cut-off answers map to refusal / max_tokens, keeping usage', async () => {
  const blocked = await client('key-blocked').complete({ prompt: 'hi', model: 'm' });
  assert.deepEqual([blocked.stopReason, blocked.text, blocked.inputTokens, blocked.outputTokens], ['refusal', '', 7, 0]);
  assert.equal((await client('key-max').complete({ prompt: 'hi', model: 'm' })).stopReason, 'max_tokens');
});

test('retries server errors, then succeeds', async () => {
  const response = await client('key-flaky').complete({ prompt: 'hi', model: 'm' });
  assert.equal(response.text, 'Hello World');
  assert.equal(attempts.get('key-flaky'), 3);
});

test('maps API errors to user messages', async () => {
  assert.deepEqual(await failureFor('key-invalid'), { kind: 'error', message: 'Your Gemini API key was rejected.', offerSetApiKey: true });
  assert.deepEqual(await failureFor('key-401'), { kind: 'error', message: 'Your Gemini API key was rejected.', offerSetApiKey: true });
  assert.match(JSON.stringify(await failureFor('key-404')), /not found\. Check the devmeter\.model setting/);
  assert.match(JSON.stringify(await failureFor('key-429')), /rate limit or free-tier quota.*HTTP 429 RESOURCE_EXHAUSTED: RESOURCE_EXHAUSTED from fake server/);
  assert.match(JSON.stringify(await failureFor('key-500')), /overloaded or having problems.*HTTP 500 INTERNAL: INTERNAL from fake server/);
  assert.equal(attempts.get('key-429'), 3); // retried twice before giving up
});

test('cancelling aborts the request', async () => {
  const abort = new AbortController();
  setTimeout(() => abort.abort(), 50);
  assert.deepEqual(await failureFor('key-slow', abort.signal), { kind: 'cancelled' });
});

test('an unreachable API is reported as a connection problem', async () => {
  try {
    await new GeminiClient('k', { baseUrl: 'http://127.0.0.1:1', maxRetries: 0 }).complete({ prompt: 'hi', model: 'm' });
    assert.fail('expected failure');
  } catch (error) {
    assert.match(JSON.stringify(describeGeminiFailure(error, 'm')), /Can't reach generativelanguage/);
  }
});
