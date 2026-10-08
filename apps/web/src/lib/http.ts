const tokenKey = 'liveq.accessToken';

let onUnauthorized: (() => void) | null = null;

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function readToken(): string | null {
  return localStorage.getItem(tokenKey);
}

export function writeToken(token: string): void {
  localStorage.setItem(tokenKey, token);
}

export function clearToken(): void {
  localStorage.removeItem(tokenKey);
}

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export function request<T>(path: string, init?: RequestInit): Promise<T> {
  return send(path, init, true);
}

export function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return send(path, init, false);
}

async function send<T>(
  path: string,
  init: RequestInit | undefined,
  useSpeakerToken: boolean,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (useSpeakerToken) {
    const token = readToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (response.status === 204) {
    return undefined as T;
  }

  const body = await readBody(response);
  if (!response.ok) {
    const publicAuthAttempt =
      path === '/api/auth/login' || path === '/api/auth/register';
    if (useSpeakerToken && response.status === 401 && !publicAuthAttempt) {
      clearToken();
      onUnauthorized?.();
    }
    throw new ApiError(readErrorMessage(body), response.status);
  }

  return body as T;
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readErrorMessage(body: unknown): string {
  if (!body || typeof body !== 'object' || !('message' in body)) {
    return 'The request could not be completed.';
  }
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message)) {
    return message.map(String).join(' ');
  }
  return 'The request could not be completed.';
}
