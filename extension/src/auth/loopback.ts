import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type CallbackResult =
  | { kind: 'token'; token: string }
  | { kind: 'error'; code: string }
  | { kind: 'timeout' }
  | { kind: 'cancelled' };

export interface LoopbackSession {
  /** Pass to the backend as redirect_uri: http://127.0.0.1:<port>/cb/<random state>. */
  readonly redirectUri: string;
  /** Settles once: token, error, timeout or cancel. The server is closed by then. */
  readonly result: Promise<CallbackResult>;
  cancel(): void;
}

/**
 * Temporary callback server for browser sign-in, bound to 127.0.0.1 on a free port.
 * Only GET /cb/<state> with the matching state is accepted; without the state check, any web page or
 * local program could plant its own token while sign-in is pending.
 */
export async function startLoopback(options: { timeoutMs: number }): Promise<LoopbackSession> {
  const state = randomBytes(32).toString('base64url');
  let settle!: (result: CallbackResult) => void;
  const result = new Promise<CallbackResult>((resolve) => {
    settle = resolve;
  });
  let settled = false;

  const server = createServer((request, response) => {
    const outcome = handleRequest(request, state);
    respond(response, outcome.status, outcome.page);
    if (outcome.result) {
      finish(outcome.result);
    }
  });

  const finish = (outcome: CallbackResult): void => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timer);
    server.close();
    server.closeAllConnections();
    settle(outcome);
  };

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const timer = setTimeout(() => finish({ kind: 'timeout' }), options.timeoutMs);
  const { port } = server.address() as AddressInfo;

  return {
    // State goes in the path, not a nested "?state=": VS Code's openExternal re-encodes the login URL
    // and turned that "?" into "%3F". base64url characters survive any re-encoding unchanged.
    redirectUri: `http://127.0.0.1:${port}/cb/${state}`,
    result,
    cancel: () => finish({ kind: 'cancelled' }),
  };
}

interface Outcome {
  status: number;
  page: string;
  result?: CallbackResult;
}

function handleRequest(request: IncomingMessage, state: string): Outcome {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const callback = /^\/cb(?:\/([^/]*))?$/.exec(url.pathname);
  if (request.method !== 'GET' || !callback) {
    return { status: 404, page: page('Not found', '') };
  }
  if (!sameSecret(callback[1] ?? null, state)) {
    // Not from our sign-in; keep waiting for the real callback.
    return { status: 400, page: page('Invalid sign-in link', 'Start again from VS Code: run "DevMeter: Sign In".') };
  }
  const error = url.searchParams.get('error');
  if (error) {
    return { status: 200, page: page('Sign-in did not complete', 'You can close this tab and return to VS Code.'),
      result: { kind: 'error', code: error } };
  }
  const token = url.searchParams.get('token');
  if (!token) {
    return { status: 400, page: page('Sign-in failed', 'No token was received. Try again from VS Code.'),
      result: { kind: 'error', code: 'login_failed' } };
  }
  return { status: 200, page: page('Signed in to DevMeter', 'You can close this tab and return to VS Code.'),
    result: { kind: 'token', token } };
}

function sameSecret(received: string | null, expected: string): boolean {
  if (received === null || received.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function respond(response: ServerResponse, status: number, html: string): void {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'close',
  });
  response.end(html);
}

/** Fixed text only: never echo request parameters (the token) into the page. */
function page(title: string, message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>`
    + '<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem}</style>'
    + `</head><body><h1>${title}</h1><p>${message}</p></body></html>`;
}
