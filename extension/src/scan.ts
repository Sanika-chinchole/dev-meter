export type ScanResult = { ok: true } | { ok: false; reason: string };

/**
 * Leak-scan hook, run on every prompt before it leaves the machine.
 * Phase 4 replaces this body with real secret/PII detection; callers already handle { ok: false }.
 */
export async function scan(_text: string): Promise<ScanResult> {
  return { ok: true };
}
