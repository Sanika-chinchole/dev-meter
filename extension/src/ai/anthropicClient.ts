import Anthropic from '@anthropic-ai/sdk';
import type { AiClient, AiRequest, AiResponse, CallFailure } from './client.ts';

/** Thinking counts toward max_tokens; only tokens actually generated are billed, so the cap can be generous. */
const MAX_TOKENS = 16_000;
const REQUEST_TIMEOUT_MS = 2 * 60_000;
/** Re-runs a safety-declined request on Anthropic's recommended fallback model, inside the same call. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** Real calls to the Anthropic Messages API (devmeter.mockMode = false). */
export class AnthropicClient implements AiClient {
  private readonly client: Anthropic;

  /** baseURL and maxRetries are for tests; the defaults talk to api.anthropic.com with 2 retries. */
  constructor(apiKey: string, options: { baseURL?: string; maxRetries?: number } = {}) {
    this.client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: options.maxRetries ?? 2, baseURL: options.baseURL });
  }

  async complete(request: AiRequest, signal?: AbortSignal): Promise<AiResponse> {
    const message = await this.client.beta.messages.create({
      model: request.model,
      max_tokens: MAX_TOKENS,
      output_config: { effort: 'low' }, // quick editor questions: lowest cost and wait
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      messages: [{ role: 'user', content: request.prompt }],
    }, { signal });

    // Thinking is always on for current models, so content[0] may be a thinking block: collect all text.
    const text = message.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n\n');
    return {
      text,
      model: message.model, // the model that actually answered (differs if the fallback ran)
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      stopReason: message.stop_reason ?? undefined,
    };
  }
}

/** User-facing description of a failed Anthropic call. Most specific SDK error classes first. */
export function describeAnthropicFailure(error: unknown, model: string): CallFailure {
  const fail = (message: string, offerSetApiKey = false): CallFailure => ({ kind: 'error', message, offerSetApiKey });
  if (error instanceof Anthropic.APIUserAbortError) {
    return { kind: 'cancelled' };
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return fail('Your Anthropic API key was rejected.', true);
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return fail(`Your Anthropic API key doesn't have access to ${model}.`, true);
  }
  if (error instanceof Anthropic.NotFoundError) {
    return fail(`Model "${model}" was not found. Check the devmeter.model setting.`);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return fail('Anthropic rate limit reached. Try again shortly.');
  }
  if (error instanceof Anthropic.BadRequestError) {
    return fail(`Anthropic rejected the request: ${error.message}`);
  }
  if (error instanceof Anthropic.InternalServerError) {
    return fail('Anthropic is overloaded or having problems. Try again shortly.');
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return fail('The request to Anthropic timed out after 2 minutes.');
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return fail("Can't reach api.anthropic.com. Check your internet connection.");
  }
  if (error instanceof Anthropic.APIError) {
    return fail(`Anthropic returned an error (HTTP ${error.status}).`);
  }
  return fail(error instanceof Error ? error.message : String(error));
}
