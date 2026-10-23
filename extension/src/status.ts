export type SessionState =
  | { state: 'signed-in'; email: string | undefined; expires: Date }
  | { state: 'expired' }
  | { state: 'signed-out' };

export interface StatusInfo {
  session: SessionState;
  backendUrl: string;
  mockMode: boolean;
  provider: string;
  model: string;
  /** True when devmeter.model is empty and the provider default is used. */
  modelIsDefault: boolean;
  /** Whether a key is stored for the current provider. The key itself is never shown. */
  apiKeySet: boolean;
  projectTag: string | null;
  logSentEvents: boolean;
}

function sessionText(session: SessionState): string {
  switch (session.state) {
    case 'signed-in':
      return `signed in as ${session.email ?? 'unknown email'} (token valid until ${session.expires.toLocaleString()})`;
    case 'expired':
      return 'session expired; run "DevMeter: Sign In"';
    case 'signed-out':
      return 'not signed in; run "DevMeter: Sign In"';
  }
}

/** Lines for the DevMeter output channel. Never includes the token or the API key. */
export function statusLines(info: StatusInfo): string[] {
  const keyText = info.apiKeySet ? 'set' : 'not set';
  return [
    'DevMeter status',
    `  Account:      ${sessionText(info.session)}`,
    `  Backend:      ${info.backendUrl}`,
    `  Mode:         ${info.mockMode ? 'mock (simulated answers, no API key needed)' : 'real'}`,
    `  Provider:     ${info.provider}`,
    `  Model:        ${info.model}${info.modelIsDefault ? ' (provider default)' : ''}`,
    `  API key:      ${keyText} for ${info.provider}${info.mockMode ? ' (not needed in mock mode)' : ''}`,
    `  Project tag:  ${info.projectTag ?? '(none)'}`,
    `  Log sent events: ${info.logSentEvents ? 'on' : 'off'}`,
  ];
}

/** One line for the pop-up. */
export function statusSummary(info: StatusInfo): string {
  const account = info.session.state === 'signed-in'
    ? `Signed in as ${info.session.email ?? 'unknown email'}`
    : info.session.state === 'expired' ? 'Session expired' : 'Not signed in';
  return `DevMeter: ${account} · ${info.provider} / ${info.model} · ${info.mockMode ? 'mock' : 'real'} mode`;
}
