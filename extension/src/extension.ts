import * as vscode from 'vscode';
import { ApiKeys } from './apiKeys.ts';
import { askCommand } from './askCommand.ts';
import { Auth } from './auth/auth.ts';
import { Capture } from './capture.ts';
import { statusCommand } from './statusCommand.ts';

// No activationEvents in package.json: since VS Code 1.74, contributing a command
// activates the extension when that command runs.

export function activate(context: vscode.ExtensionContext): void {
  const auth = new Auth(context.secrets);
  const apiKeys = new ApiKeys(context.secrets);
  const output = vscode.window.createOutputChannel('DevMeter');
  const capture = new Capture(auth, output);
  context.subscriptions.push(
    auth,
    output,
    vscode.commands.registerCommand('devmeter.signIn', () => auth.signIn()),
    vscode.commands.registerCommand('devmeter.signOut', () => auth.signOut()),
    vscode.commands.registerCommand('devmeter.setApiKey', () => apiKeys.set()),
    vscode.commands.registerCommand('devmeter.clearApiKey', () => apiKeys.clear()),
    vscode.commands.registerCommand('devmeter.ask', () => askCommand({ auth, apiKeys, capture, output })),
    vscode.commands.registerCommand('devmeter.status', () => statusCommand(auth, apiKeys, output)),
  );
}

export function deactivate(): void {
  // Nothing to clean up yet; disposables are released via context.subscriptions.
}
