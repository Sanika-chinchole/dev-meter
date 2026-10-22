import * as vscode from 'vscode';
import type { Auth } from './auth/auth.ts';
import { postEvent, type PostEventResult } from './backendApi.ts';
import { buildEventPayload, type CallMetadata } from './events.ts';
import { backendUrl } from './settings.ts';

/**
 * Sends call metadata to POST /events in the background. Never blocks or fails the AI command.
 * TODO: events lost to network/server errors are only logged; add a persistent offline queue later.
 */
export class Capture {
  private readonly auth: Auth;
  private readonly output: vscode.OutputChannel;
  /** The latest event rejected with 401, re-sent once after the next sign-in. Memory only. */
  private awaitingSignIn: CallMetadata | undefined;

  constructor(auth: Auth, output: vscode.OutputChannel) {
    this.auth = auth;
    this.output = output;
    auth.onDidSignIn((token) => this.resendAfterSignIn(token));
  }

  /** Fire-and-forget: the caller has already shown the AI answer. */
  record(call: CallMetadata, token: string): void {
    void this.send(buildEventPayload(call), token, '');
  }

  private async resendAfterSignIn(token: string): Promise<void> {
    const pending = this.awaitingSignIn;
    this.awaitingSignIn = undefined;
    if (pending) {
      await this.send(pending, token, ' (after sign-in)');
    }
  }

  private async send(payload: CallMetadata, token: string, note: string): Promise<void> {
    const result = await postEvent(backendUrl(), token, payload);
    this.report(result, note);
    if (result.kind === 'unauthorized') {
      this.awaitingSignIn = payload;
      await this.auth.handleUnauthorized();
    }
  }

  private report(result: PostEventResult, note: string): void {
    switch (result.kind) {
      case 'recorded':
        this.output.appendLine(result.priced
          ? `✓ Recorded${note} · $${result.costUsd.toFixed(6)}`
          : `✓ Recorded${note} · model not priced yet ($0)`);
        return;
      case 'unauthorized':
        this.output.appendLine('✗ Not recorded yet: session expired. It will be sent after you sign in again.');
        return;
      case 'rejected':
        this.notRecorded(result.detail);
        return;
      case 'failed':
        this.notRecorded(result.reason);
        return;
    }
  }

  private notRecorded(reason: string): void {
    this.output.appendLine(`✗ Not recorded: ${reason}`);
    vscode.window.setStatusBarMessage('$(warning) DevMeter: usage not recorded (see the DevMeter output)', 8000);
  }
}
