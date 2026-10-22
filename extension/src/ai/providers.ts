import { AnthropicClient, describeAnthropicFailure } from './anthropicClient.ts';
import type { AiClient, CallFailure } from './client.ts';
import { describeGeminiFailure, GeminiClient } from './geminiClient.ts';

interface RealProvider {
  /** Used when devmeter.model is empty. */
  defaultModel: string;
  createClient(apiKey: string): AiClient;
  describeFailure(error: unknown, model: string): CallFailure;
}

/** Providers real mode can call. The key is the devmeter.provider value. */
const REAL_PROVIDERS: Record<string, RealProvider> = {
  anthropic: {
    defaultModel: 'claude-sonnet-5-5',
    createClient: (apiKey) => new AnthropicClient(apiKey),
    describeFailure: describeAnthropicFailure,
  },
  gemini: {
    // Google limits the 2.5 models to past users and recommends 3.8 Flash for new projects (free tier available).
    defaultModel: 'gemini-3.8-flash',
    createClient: (apiKey) => new GeminiClient(apiKey),
    describeFailure: describeGeminiFailure,
  },
};

export const SUPPORTED_PROVIDERS = Object.keys(REAL_PROVIDERS);

export function realProvider(provider: string): RealProvider | undefined {
  return REAL_PROVIDERS[provider];
}

/** devmeter.model if set, else the provider's default (Anthropic's for unknown providers, e.g. in mock mode). */
export function resolveModel(configuredModel: string | undefined, provider: string): string {
  return configuredModel?.trim() || (REAL_PROVIDERS[provider] ?? REAL_PROVIDERS.anthropic!).defaultModel;
}
