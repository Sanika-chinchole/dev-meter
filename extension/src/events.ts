/** Everything DevMeter records about one AI call. Metadata only: no prompt or response text. */
export interface CallMetadata {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  projectTag: string | null;
}

/**
 * Body for POST /events. Copies exactly these six fields and nothing else, so even if a caller
 * passes a richer object (say, one that also holds the prompt), no other field can ride along.
 */
export function buildEventPayload(call: CallMetadata): CallMetadata {
  return {
    model: call.model,
    provider: call.provider,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
    latencyMs: call.latencyMs,
    projectTag: call.projectTag,
  };
}
