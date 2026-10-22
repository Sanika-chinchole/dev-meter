import { setTimeout as sleep } from 'node:timers/promises';
import type { AiClient, AiRequest, AiResponse, CallFailure } from './client.ts';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';
const REQUEST_TIMEOUT_MS = 2 * 60_000;

/** Subset of the generateContent REST response that DevMeter reads. */
interface GenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  modelVersion?: string;
}

interface GeminiErrorBody {
  error?: { code?: number; message?: string; status?: string; details?: { reason?: string }[] };
}

/** Finish reasons meaning Gemini declined to answer (treated like Anthropic's "refusal"). */
const BLOCKED_FINISH_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY']);

export class GeminiError extends Error {
  readonly kind: 'cancelled' | 'timeout' | 'unreachable' | 'api';
  readonly status: number | undefined;
  /** e.g. "API_KEY_INVALID" from error.details[].reason */
  readonly reason: string | undefined;

  constructor(kind: GeminiError['kind'], message: string, status?: number, reason?: string) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.reason = reason;
  }
}

/** Real calls to the Gemini API (REST generateContent). Retries rate limits and server errors. */
export class GeminiClient implements AiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  /** baseUrl / maxRetries / retryDelayMs are for tests. */
  constructor(apiKey: string, options: { baseUrl?: string; maxRetries?: number; retryDelayMs?: number } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 1_000;
  }

  async complete(request: AiRequest, signal?: AbortSignal): Promise<AiResponse> {
    for (let attempt = 0; ; attempt++) {
      const response = await this.send(request, signal);
      if (response.ok) {
        return toAiResponse((await response.json()) as GenerateContentResponse, request.model);
      }
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < this.maxRetries) {
        await response.body?.cancel();
        await sleep(this.retryDelayMs * 2 ** attempt, undefined, { signal }).catch(() => {
          throw new GeminiError('cancelled', 'Cancelled');
        });
        continue;
      }
      throw await apiError(response);
    }
  }

  private async send(request: AiRequest, signal: AbortSignal | undefined): Promise<Response> {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    try {
      return await fetch(`${this.baseUrl}/v1beta/models/${encodeURIComponent(request.model)}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: request.prompt }] }] }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch {
      if (signal?.aborted) {
        throw new GeminiError('cancelled', 'Cancelled');
      }
      if (timeout.aborted) {
        throw new GeminiError('timeout', 'Timed out');
      }
      throw new GeminiError('unreachable', 'Network error');
    }
  }
}

function toAiResponse(data: GenerateContentResponse, requestedModel: string): AiResponse {
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => typeof part.text === 'string' && !part.thought)
    .map((part) => part.text)
    .join('');
  const usage = data.usageMetadata ?? {};
  return {
    text,
    model: data.modelVersion || requestedModel, // what actually answered, else what we asked for
    inputTokens: usage.promptTokenCount ?? 0,
    // Thinking tokens are billed as output but reported separately from candidatesTokenCount.
    outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    stopReason: stopReasonOf(data),
  };
}

/** Maps Gemini's outcome onto the shared stop reasons: "refusal", "max_tokens", "end_turn". */
function stopReasonOf(data: GenerateContentResponse): string | undefined {
  const finish = data.candidates?.[0]?.finishReason;
  if (data.promptFeedback?.blockReason || (finish && BLOCKED_FINISH_REASONS.has(finish))) {
    return 'refusal';
  }
  if (finish === 'MAX_TOKENS') {
    return 'max_tokens';
  }
  return finish === 'STOP' ? 'end_turn' : finish?.toLowerCase();
}

async function apiError(response: Response): Promise<GeminiError> {
  let body: GeminiErrorBody = {};
  try {
    body = (await response.json()) as GeminiErrorBody;
  } catch {
    // Non-JSON error body; status alone is enough.
  }
  const reason = body.error?.details?.find((detail) => detail.reason)?.reason;
  return new GeminiError('api', body.error?.message ?? `HTTP ${response.status}`, response.status, reason);
}

/** User-facing description of a failed Gemini call. */
export function describeGeminiFailure(error: unknown, model: string): CallFailure {
  const fail = (message: string, offerSetApiKey = false): CallFailure => ({ kind: 'error', message, offerSetApiKey });
  if (!(error instanceof GeminiError)) {
    return fail(error instanceof Error ? error.message : String(error));
  }
  switch (error.kind) {
    case 'cancelled':
      return { kind: 'cancelled' };
    case 'timeout':
      return fail('The request to Gemini timed out after 2 minutes.');
    case 'unreachable':
      return fail("Can't reach generativelanguage.googleapis.com. Check your internet connection.");
  }
  // Gemini reports a bad key as 400 with reason API_KEY_INVALID (sometimes 401/403).
  if (error.reason === 'API_KEY_INVALID' || error.status === 401) {
    return fail('Your Gemini API key was rejected.', true);
  }
  if (error.status === 403) {
    return fail(`Gemini denied access with this API key: ${error.message}`, true);
  }
  if (error.status === 404) {
    return fail(`Model "${model}" was not found. Check the devmeter.model setting.`);
  }
  if (error.status === 429) {
    return fail('Gemini rate limit or free-tier quota reached. Try again shortly.');
  }
  if (error.status !== undefined && error.status >= 500) {
    return fail('Gemini is overloaded or having problems. Try again shortly.');
  }
  return fail(`Gemini rejected the request: ${error.message}`);
}
