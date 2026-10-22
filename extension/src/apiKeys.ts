import * as vscode from 'vscode';
import { keyFormatWarning, normalizeProvider, secretKeyFor } from './providerKeys.ts';
import { provider as configuredProvider } from './settings.ts';

/**
 * Provider API keys, stored in VS Code SecretStorage per provider. Never written to settings,
 * never logged, never shown. Only real mode (devmeter.mockMode = false) needs one.
 */
export class ApiKeys {
  private readonly secrets: vscode.SecretStorage;

  constructor(secrets: vscode.SecretStorage) {
    this.secrets = secrets;
  }

  /** Command "DevMeter: Set API Key", for the provider in devmeter.provider. Returns the saved key. */
  async set(provider: string = configuredProvider()): Promise<string | undefined> {
    const name = normalizeProvider(provider);
    const entered = await vscode.window.showInputBox({
      title: `DevMeter: ${name} API key`,
      prompt: "Stored in VS Code's secret storage. Never written to settings or logs.",
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => (value.trim() ? undefined : 'Enter an API key'),
    });
    const key = entered?.trim();
    if (!key) {
      return undefined;
    }
    const warning = keyFormatWarning(name, key);
    if (warning) {
      const choice = await vscode.window.showWarningMessage(
        `DevMeter: ${warning} Save it for ${name} anyway?`, { modal: true }, 'Save anyway');
      if (choice !== 'Save anyway') {
        return undefined;
      }
    }
    await this.secrets.store(secretKeyFor(name), key);
    void vscode.window.showInformationMessage(`DevMeter: API key saved for ${name}.`);
    return key;
  }

  /** Command "DevMeter: Remove API Key", for the provider in devmeter.provider. */
  async clear(provider: string = configuredProvider()): Promise<void> {
    const name = normalizeProvider(provider);
    if (!(await this.secrets.get(secretKeyFor(name)))) {
      void vscode.window.showInformationMessage(`DevMeter: No API key is stored for ${name}.`);
      return;
    }
    await this.secrets.delete(secretKeyFor(name));
    void vscode.window.showInformationMessage(`DevMeter: API key removed for ${name}.`);
  }

  async has(provider: string): Promise<boolean> {
    return (await this.secrets.get(secretKeyFor(provider))) !== undefined;
  }

  /** For real calls (2.6): the stored key, or prompt for one the first time. */
  async getOrPrompt(provider: string): Promise<string | undefined> {
    return (await this.secrets.get(secretKeyFor(provider))) ?? this.set(provider);
  }
}
