import { secureStorage } from '../session/secure-storage';
import { useSessionStore, type SessionNotice } from '../session/session-store';
import { API_URL } from './config';
import { ApiError, NetworkError, toApiError } from './errors';
import type { AuthResult } from './types';

/** The app waits at most this long for each request. */
export const REQUEST_TIMEOUT_MS = 10_000;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send the access token and handle session errors. Default: true. */
  auth?: boolean;
}

/**
 * One HTTP request to `{API_URL}/api/v1{path}`. Throws `NetworkError` without an answer and
 * `ApiError` for any non-2xx answer. Uses AbortController + setTimeout (Hermes support of
 * AbortSignal.timeout varies).
 */
async function request<T>(path: string, method: string, body: unknown, token: string | null) {
  if (API_URL === null) throw new NetworkError('EXPO_PUBLIC_API_URL is not configured');

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token !== null) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let parsed: unknown = undefined;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    // Not JSON (e.g. a proxy error page): handled below as an unknown error.
  }
  if (!response.ok) throw toApiError(response.status, parsed);
  return parsed as T;
}

function noticeFor(error: ApiError): SessionNotice {
  return error.code === 'SESSION_REVOKED' ? 'revoked' : 'expired';
}

let refreshInFlight: Promise<string> | null = null;

/**
 * Rotates the refresh token and returns a new access token. Concurrent callers share the same
 * in-flight promise, so the token is rotated only once (a second rotation would look like reuse
 * and revoke the session). A rejected refresh signs the user out; a network error keeps the
 * session so the user can retry.
 */
function refreshAccessToken(): Promise<string> {
  refreshInFlight ??= (async () => {
    const store = useSessionStore.getState();
    try {
      const refreshToken = await secureStorage.getRefreshToken();
      if (refreshToken === null) throw new ApiError(401, 'SESSION_EXPIRED');
      const result = await request<AuthResult>('/auth/refresh', 'POST', { refreshToken }, null);
      await store.applyRefresh(result);
      return result.accessToken;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await store.signOut({ notice: noticeFor(error) });
      }
      throw error;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Reacts to session errors returned by the global guard on authenticated requests. */
async function handleSessionError(error: unknown): Promise<void> {
  if (!(error instanceof ApiError)) return;
  const store = useSessionStore.getState();
  if (error.status === 401 && error.code !== 'INVALID_PASSWORD') {
    await store.signOut({ notice: noticeFor(error) });
  } else if (error.code === 'PASSWORD_CHANGE_REQUIRED' && store.user !== null) {
    // An admin reset happened while signed in: only change-password stays reachable (FR-026).
    store.setUser({ ...store.user, mustChangePassword: true });
  }
}

/**
 * Calls the API. With `auth` (default) it sends the access token; on 401 `TOKEN_EXPIRED` it
 * renews the session once and retries; revoked or expired sessions send the user to login.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  if (!auth) return request<T>(path, method, body, null);

  try {
    try {
      return await request<T>(path, method, body, useSessionStore.getState().accessToken);
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'TOKEN_EXPIRED')) throw error;
      const accessToken = await refreshAccessToken();
      return await request<T>(path, method, body, accessToken);
    }
  } catch (error) {
    await handleSessionError(error);
    throw error;
  }
}
