import * as vscode from 'vscode';
import { BackendError, buildLoginUrl, fetchMe } from '../backendApi.ts';
import { backendUrl } from '../settings.ts';
import { type LoopbackSession, startLoopback } from './loopback.ts';
import type { SessionState } from '../status.ts';
import { isExpired, tokenEmail, tokenExpiry } from './token.ts';

const TOKEN_KEY = 'devmeter.jwt';
const SIGN_IN_TIMEOUT_MS = 2 * 60_000;

const SIGN_IN_ERRORS: Record<string, string> = {
  access_denied: 'Sign-in was cancelled.',
  email_not_verified: "Your Google account's email isn't verified.",
};

/** Browser sign-in and the stored app JWT (VS Code SecretStorage, never settings or plain files). */
export class Auth {
  private readonly secrets: vscode.SecretStorage;
  private readonly signedIn = new vscode.EventEmitter<string>();
  private pending: LoopbackSession | undefined;

  /** Fires with the new token after every successful sign-in. */
  readonly onDidSignIn = this.signedIn.event;

  constructor(secrets: vscode.SecretStorage) {
    this.secrets = secrets;
  }

  dispose(): void {
    this.pending?.cancel();
    this.signedIn.dispose();
  }

  async signIn(): Promise<void> {
    this.pending?.cancel(); // a second Sign In restarts the flow
    const baseUrl = backendUrl();
    const session = await startLoopback({ timeoutMs: SIGN_IN_TIMEOUT_MS });
    this.pending = session;
    try {
      const opened = await vscode.env.openExternal(vscode.Uri.parse(buildLoginUrl(baseUrl, session.redirectUri)));
      if (!opened) {
        session.cancel();
        void vscode.window.showErrorMessage('DevMeter: Could not open the browser for sign-in.');
        return;
      }
      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'DevMeter: Waiting for sign-in in your browser…', cancellable: true },
        (_progress, cancellation) => {
          cancellation.onCancellationRequested(() => session.cancel());
          return session.result;
        },
      );
      switch (result.kind) {
        case 'token':
          await this.completeSignIn(baseUrl, result.token);
          break;
        case 'error':
          void vscode.window.showErrorMessage(`DevMeter: ${SIGN_IN_ERRORS[result.code] ?? 'Sign-in failed. Please try again.'}`);
          break;
        case 'timeout':
          void vscode.window.showWarningMessage('DevMeter: Sign-in timed out after 2 minutes. Run "DevMeter: Sign In" to try again.');
          break;
        case 'cancelled':
          if (this.pending === session) { // not superseded by a newer Sign In
            void vscode.window.showInformationMessage('DevMeter: Sign-in cancelled.');
          }
          break;
      }
    } finally {
      if (this.pending === session) {
        this.pending = undefined;
      }
    }
  }

  /** Forgets the token on this machine. The backend can't revoke tokens yet, so it stays valid until it expires. */
  async signOut(): Promise<void> {
    if (!(await this.secrets.get(TOKEN_KEY))) {
      void vscode.window.showInformationMessage("DevMeter: You're not signed in.");
      return;
    }
    await this.secrets.delete(TOKEN_KEY);
    void vscode.window.showInformationMessage('DevMeter: Signed out on this machine.');
  }

  /** Sign-in state from the stored token, read locally: no network, no prompts. */
  async session(): Promise<SessionState> {
    const token = await this.secrets.get(TOKEN_KEY);
    if (!token) {
      return { state: 'signed-out' };
    }
    if (isExpired(token)) {
      return { state: 'expired' };
    }
    return { state: 'signed-in', email: tokenEmail(token), expires: tokenExpiry(token)! };
  }

  /** The stored token, or undefined (after offering Sign In) if it is missing or expired. */
  async getToken(): Promise<string | undefined> {
    const token = await this.secrets.get(TOKEN_KEY);
    if (token && !isExpired(token)) {
      return token;
    }
    if (token) {
      await this.secrets.delete(TOKEN_KEY);
    }
    this.offerSignIn(token ? 'DevMeter: Your session expired. Please sign in again.' : 'DevMeter: Not signed in.');
    return undefined;
  }

  /** The backend rejected the token (401): forget it and offer Sign In. */
  async handleUnauthorized(): Promise<void> {
    await this.secrets.delete(TOKEN_KEY);
    this.offerSignIn('DevMeter: Your session expired. Sign in again to keep recording usage.');
  }

  private offerSignIn(message: string): void {
    void vscode.window.showWarningMessage(message, 'Sign In').then((choice) => {
      if (choice === 'Sign In') {
        void vscode.commands.executeCommand('devmeter.signIn');
      }
    });
  }

  /** Stores the token only after the backend confirms who it belongs to. */
  private async completeSignIn(baseUrl: string, token: string): Promise<void> {
    try {
      const me = await fetchMe(baseUrl, token);
      await this.secrets.store(TOKEN_KEY, token);
      void vscode.window.showInformationMessage(`DevMeter: Signed in ✓ as ${me.email}`);
      this.signedIn.fire(token);
    } catch (error) {
      const reason = error instanceof BackendError ? error.message : String(error);
      void vscode.window.showErrorMessage(`DevMeter: Sign-in failed. ${reason}.`);
    }
  }
}
