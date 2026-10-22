import type { AiClient, AiResponse } from './ai/client.ts';
import type { ScanResult } from './scan.ts';

/** Larger prompts are refused, so selecting a whole file by accident can't run up a real bill. */
export const MAX_PROMPT_CHARS = 20_000;

export type AskOutcome =
  | { kind: 'blocked'; reason: string }
  | { kind: 'answered'; response: AiResponse; latencyMs: number };

export interface AskDeps {
  scan: (text: string) => Promise<ScanResult>;
  client: AiClient;
  model: string;
  signal?: AbortSignal;
}

/** Scan, then call the AI. latencyMs covers the AI call only. A blocked prompt never reaches the client. */
export async function ask(prompt: string, deps: AskDeps): Promise<AskOutcome> {
  const verdict = await deps.scan(prompt);
  if (!verdict.ok) {
    return { kind: 'blocked', reason: verdict.reason };
  }
  const started = performance.now();
  const response = await deps.client.complete({ prompt, model: deps.model }, deps.signal);
  return { kind: 'answered', response, latencyMs: Math.round(performance.now() - started) };
}

/** One-line preview for the local output channel; never sent anywhere. */
export function previewOf(text: string, maxChars = 80): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > maxChars ? `${line.slice(0, maxChars - 1)}…` : line;
}
