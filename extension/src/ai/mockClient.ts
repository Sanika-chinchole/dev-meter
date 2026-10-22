import { setTimeout as sleep } from 'node:timers/promises';
import type { AiClient, AiRequest, AiResponse } from './client.ts';

const MOCK_OUTPUT_TOKENS = 200;

/** Rough token estimate for mock mode: about 1.3 tokens per word, at least 1. */
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words * 1.3));
}

/** Simulated provider for devmeter.mockMode: no network, no API key, canned answer. */
export class MockClient implements AiClient {
  private readonly delayMs: number;

  constructor(delayMs = 300) {
    this.delayMs = delayMs;
  }

  async complete(request: AiRequest): Promise<AiResponse> {
    await sleep(this.delayMs);
    return {
      text: 'This is a simulated answer from DevMeter mock mode. No AI provider was called and no API key was used.\n'
        + 'Turn off the devmeter.mockMode setting to get real answers.',
      model: request.model,
      inputTokens: estimateTokens(request.prompt),
      outputTokens: MOCK_OUTPUT_TOKENS,
      stopReason: 'end_turn',
    };
  }
}
