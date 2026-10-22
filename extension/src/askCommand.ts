import * as vscode from 'vscode';
import type { AiClient, AiResponse, CallFailure } from './ai/client.ts';
import { MockClient } from './ai/mockClient.ts';
import { realProvider, SUPPORTED_PROVIDERS } from './ai/providers.ts';
import type { ApiKeys } from './apiKeys.ts';
import { ask, MAX_PROMPT_CHARS, previewOf } from './ask.ts';
import type { Auth } from './auth/auth.ts';
import type { Capture } from './capture.ts';
import { resolveProjectTag } from './projectTag.ts';
import { normalizeProvider } from './providerKeys.ts';
import { scan } from './scan.ts';
import * as settings from './settings.ts';

export interface AskCommandDeps {
  auth: Auth;
  apiKeys: ApiKeys;
  capture: Capture;
  output: vscode.OutputChannel;
}

/** Command "DevMeter: Ask AI": prompt from the selection or an input box, answer in the DevMeter output channel. */
export async function askCommand({ auth, apiKeys, capture, output }: AskCommandDeps): Promise<void> {
  // Signed in first, so no call can happen without being recorded.
  const token = await auth.getToken();
  if (!token) {
    return;
  }
  const prompt = await readPrompt();
  if (!prompt) {
    return;
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    void vscode.window.showWarningMessage(
      `DevMeter: The prompt is ${prompt.length.toLocaleString()} characters; the limit is ${MAX_PROMPT_CHARS.toLocaleString()}. Select less text.`);
    return;
  }

  const provider = normalizeProvider(settings.provider());
  const model = settings.model(provider);
  const mock = settings.mockMode();
  const real = realProvider(provider);
  let client: AiClient;
  if (mock) {
    client = new MockClient();
  } else {
    if (!real) {
      void vscode.window.showErrorMessage(`DevMeter: Real mode supports the providers ${SUPPORTED_PROVIDERS.join(', ')} `
        + `(devmeter.provider is "${provider}").`);
      return;
    }
    const apiKey = await apiKeys.getOrPrompt(provider);
    if (!apiKey) {
      return;
    }
    client = real.createClient(apiKey);
  }

  const abort = new AbortController();
  try {
    const outcome = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `DevMeter: Asking ${model}…`, cancellable: true },
      (_progress, cancellation) => {
        cancellation.onCancellationRequested(() => abort.abort());
        return ask(prompt, { scan, client, model, signal: abort.signal });
      },
    );
    if (outcome.kind === 'blocked') {
      void vscode.window.showWarningMessage(`DevMeter: Not sent. ${outcome.reason}`);
      return;
    }
    const { response, latencyMs } = outcome;
    output.appendLine('─'.repeat(60));
    output.appendLine(`[${new Date().toLocaleString()}] ${response.model}${mock ? ' (mock)' : ''} · `
      + `${response.inputTokens} in / ${response.outputTokens} out tokens · ${latencyMs} ms`);
    output.appendLine(`> ${previewOf(prompt)}`);
    output.appendLine('');
    output.appendLine(answerText(response));
    output.show(true);

    // Metadata only. The prompt and response text are deliberately not passed.
    // Refused and cut-off answers are recorded too: their tokens were billed.
    capture.record({
      model: response.model,
      provider,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      latencyMs,
      projectTag: currentProjectTag(),
    }, token);
  } catch (error) {
    const failure: CallFailure = real && !mock
      ? real.describeFailure(error, model)
      : { kind: 'error', message: error instanceof Error ? error.message : String(error), offerSetApiKey: false };
    if (failure.kind === 'cancelled') {
      void vscode.window.showInformationMessage('DevMeter: Request cancelled.');
      return;
    }
    const actions = failure.offerSetApiKey ? ['Set API Key'] : [];
    void vscode.window.showErrorMessage(`DevMeter: ${failure.message}`, ...actions).then((choice) => {
      if (choice === 'Set API Key') {
        void apiKeys.set(provider);
      }
    });
  }
}

function answerText(response: AiResponse): string {
  if (response.stopReason === 'refusal') {
    return `[The model declined this request.]${response.text ? `\n\n${response.text}` : ''}`;
  }
  const text = response.text || '[No text in the response.]';
  return response.stopReason === 'max_tokens' ? `${text}\n\n[Answer cut off: reached the token limit.]` : text;
}

/** The primary selection if it has text, otherwise ask. Undefined when empty or cancelled. */
async function readPrompt(): Promise<string | undefined> {
  const editor = vscode.window.activeTextEditor;
  const selected = editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection).trim() : '';
  if (selected) {
    return selected;
  }
  const typed = await vscode.window.showInputBox({
    title: 'DevMeter: Ask AI',
    prompt: 'What do you want to ask? (Tip: select code in the editor to ask about it.)',
    ignoreFocusOut: true,
  });
  return typed?.trim() || undefined;
}

/** devmeter.projectTag, else the folder of the active file (or the first folder), else null. Never prompt text. */
function currentProjectTag(): string | null {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  const folder = (activeUri && vscode.workspace.getWorkspaceFolder(activeUri)) ?? vscode.workspace.workspaceFolders?.[0];
  return resolveProjectTag(settings.projectTag(folder), folder?.name) ?? null;
}
