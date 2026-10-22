import * as vscode from 'vscode';
import { resolveModel } from './ai/providers.ts';

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

export function mockMode(): boolean {
  return config().get<boolean>('mockMode', true);
}

/** devmeter.projectTag for a folder (resource-scoped, so each folder can set its own). */
export function projectTag(folder: vscode.WorkspaceFolder | undefined): string {
  return vscode.workspace.getConfiguration('devmeter', folder?.uri).get<string>('projectTag') ?? '';
}
