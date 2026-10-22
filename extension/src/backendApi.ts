import type { CallMetadata } from './events.ts';

const REQUEST_TIMEOUT_MS = 10_000;

export interface Me {
  id: string;
  email: string;
  name: string | null;
}

export class BackendError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export function normalizeBaseUrl(backendUrl: string): string {
  return backendUrl.trim().replace(/\/+$/, '');
}

export function buildLoginUrl(backendUrl: string, redirectUri: string): string {
  return `${normalizeBaseUrl(backendUrl)}/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/** GET /auth/me: who the token belongs to. Throws BackendError (status 401 = token rejected). */
export async function fetchMe(backendUrl: string, token: string): Promise<Me> {
  const baseUrl = normalizeBaseUrl(backendUrl);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new BackendError(`Can't reach the DevMeter backend at ${baseUrl}`);
  }
  if (response.status === 401) {
    throw new BackendError('The backend rejected the token', 401);
  }
  if (!response.ok) {
    throw new BackendError(`The backend returned HTTP ${response.status}`, response.status);
  }
  return (await response.json()) as Me;
}

export type PostEventResult =
  | { kind: 'recorded'; id: string; costUsd: number; priced: boolean }
  | { kind: 'unauthorized' }
  | { kind: 'rejected'; detail: string }
  | { kind: 'failed'; reason: string };

/** POST /events. Never throws: every outcome is a result, so capture can't break the AI command. */
export async function postEvent(backendUrl: string, token: string, payload: CallMetadata): Promise<PostEventResult> {
  const baseUrl = normalizeBaseUrl(backendUrl);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { kind: 'failed', reason: `Can't reach the DevMeter backend at ${baseUrl}` };
  }
  try {
    if (response.status === 201) {
      const body = (await response.json()) as { id: string; costUsd: number; priced: boolean };
      return { kind: 'recorded', id: body.id, costUsd: body.costUsd, priced: body.priced };
    }
    if (response.status === 401) {
      return { kind: 'unauthorized' };
    }
    if (response.status === 400) {
      return { kind: 'rejected', detail: problemDetail(await response.json()) };
    }
  } catch {
    // Unexpected body shape; fall through to a generic failure.
  }
  return { kind: 'failed', reason: `The backend returned HTTP ${response.status}` };
}

/** "detail" plus any field errors from the backend's problem JSON (which never echoes the request body). */
function problemDetail(body: unknown): string {
  const problem = body as { detail?: string; errors?: { field?: string; message?: string }[] };
  const fields = (problem.errors ?? []).map((error) => `${error.field} ${error.message}`);
  return [problem.detail ?? 'Rejected by the backend', ...fields].join('; ');
}
