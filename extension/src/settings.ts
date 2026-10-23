import * as vscode from 'vscode';
import { resolveModel } from './ai/providers.ts';
import { resolveProjectTag } from './projectTag.ts';

function config(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('devmeter');
}

/** User-level setting only (scope "machine"), so a workspace can't send the token elsewhere. */
export function backendUrl(): string {
  return config().get<string>('backendUrl') || 'http://localhost:8080';
}

export function provider(): string {
  return config().get<string>('provider')?.trim() || 'anthropic';
}

/** devmeter.model, or the provider's default model when the setting is empty. */
export function model(forProvider: string): string {
  return resolveModel(config().get<string>('model'), forProvider);
}

/** True when devmeter.model is empty, so the provider default is in use. */
export function modelIsDefault(): boolean {
  return !config().get<string>('model')?.trim();
}

export function mockMode(): boolean {
  return config().get<boolean>('mockMode', true);
}

/** When on, every POST /events body is printed to the DevMeter output channel. */
export function logSentEvents(): boolean {
  return config().get<boolean>('logSentEvents', false);
}

/** devmeter.projectTag, else the folder of the active file (or the first folder), else null. Never prompt text. */
export function currentProjectTag(): string | null {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  const folder = (activeUri && vscode.workspace.getWorkspaceFolder(activeUri)) ?? vscode.workspace.workspaceFolders?.[0];
  // null (not undefined) = "any resource", which VS Code expects for resource-scoped settings with no folder.
  const configured = vscode.workspace.getConfiguration('devmeter', folder?.uri ?? null).get<string>('projectTag') ?? '';
  return resolveProjectTag(configured, folder?.name) ?? null;
}
