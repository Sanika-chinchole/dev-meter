import * as vscode from 'vscode';
import type { ApiKeys } from './apiKeys.ts';
import type { Auth } from './auth/auth.ts';
import { normalizeProvider } from './providerKeys.ts';
import * as settings from './settings.ts';
import { type StatusInfo, statusLines, statusSummary } from './status.ts';

/** Command "DevMeter: Show Status": details in the DevMeter output channel, plus a one-line pop-up. Works offline. */
export async function statusCommand(auth: Auth, apiKeys: ApiKeys, output: vscode.OutputChannel): Promise<void> {
  const provider = normalizeProvider(settings.provider());
  const info: StatusInfo = {
    session: await auth.session(),
    backendUrl: settings.backendUrl(),
    mockMode: settings.mockMode(),
    provider,
    model: settings.model(provider),
    modelIsDefault: settings.modelIsDefault(),
    apiKeySet: await apiKeys.has(provider),
    projectTag: settings.currentProjectTag(),
    logSentEvents: settings.logSentEvents(),
  };
  output.appendLine('─'.repeat(60));
  for (const line of statusLines(info)) {
    output.appendLine(line);
  }
  output.show(true);
  void vscode.window.showInformationMessage(statusSummary(info));
}
