export interface AiRequest {
  prompt: string;
  model: string;
}

export interface AiResponse {
  text: string;
  /** The model that actually answered, as reported by the provider; this is what gets recorded. */
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Provider stop reason, e.g. "end_turn", "max_tokens", "refusal". */
  stopReason?: string;
}

/** One AI provider: MockClient (mock mode), AnthropicClient or GeminiClient (real mode). */
export interface AiClient {
  complete(request: AiRequest, signal?: AbortSignal): Promise<AiResponse>;
}

/** How a failed call is shown to the user. Failed or cancelled calls have no usage, so nothing is recorded. */
export type CallFailure =
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string; offerSetApiKey: boolean };
