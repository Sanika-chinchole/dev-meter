/** Expected key prefixes, used only to warn about a likely typo or wrong-provider key. */
const KEY_PREFIXES: Record<string, string[]> = {
  anthropic: ['sk-ant-'],
  gemini: ['AIza', 'AQ.'], // classic API keys, and the newer AI Studio "auth keys"
  openai: ['sk-'],
};

export function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase();
}

/**
 * SecretStorage key for one provider's API key. Keys are stored per provider so that switching
 * devmeter.provider can never send one provider's key to another.
 */
export function secretKeyFor(provider: string): string {
  return `devmeter.providerKey.${normalizeProvider(provider)}`;
}

/** A warning if the key doesn't look like this provider's keys; undefined if it looks fine or we can't tell. */
export function keyFormatWarning(provider: string, key: string): string | undefined {
  if (/\s/.test(key)) {
    return 'The key contains spaces or line breaks.';
  }
  const prefixes = KEY_PREFIXES[normalizeProvider(provider)];
  if (prefixes && !prefixes.some((prefix) => key.startsWith(prefix))) {
    return `${normalizeProvider(provider)} keys usually start with ${prefixes.map((p) => `"${p}"`).join(' or ')}.`;
  }
  return undefined;
}
