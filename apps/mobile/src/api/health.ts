import { useQuery } from '@tanstack/react-query';

/** data-model.md → HealthReport (contracts/health.openapi.yaml). */
export interface HealthReport {
  status: 'ok' | 'degraded';
  version: string;
  database: 'up' | 'down';
}

/** data-model.md → ConnectionStatus (derived, not stored). */
export type ConnectionStatus =
  | { kind: 'checking' }
  | { kind: 'connected'; report: HealthReport }
  | { kind: 'disconnected'; reason: 'missing-config' | 'unreachable' };

/** The app waits at most this long for the API (FR-017). */
export const HEALTH_TIMEOUT_MS = 5000;

function isHealthReport(value: unknown): value is HealthReport {
  if (typeof value !== 'object' || value === null) return false;
  const { status, version, database } = value as Record<string, unknown>;
  return (
    (status === 'ok' || status === 'degraded') &&
    typeof version === 'string' &&
    version.length > 0 &&
    (database === 'up' || database === 'down')
  );
}

/**
 * Calls GET {baseUrl}/api/v1/health. Resolves only with a valid report on HTTP 200 or 503
 * (a degraded API is still reachable); anything else rejects.
 * Uses AbortController + setTimeout instead of AbortSignal.timeout (Hermes support varies).
 */
export async function fetchHealth(baseUrl: string): Promise<HealthReport> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (response.status !== 200 && response.status !== 503) {
      throw new Error(`Unexpected HTTP status ${response.status}`);
    }
    const body: unknown = await response.json();
    if (!isHealthReport(body)) throw new Error('Invalid health report');
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** Health query + derived connection status for the temporary screen. */
export function useHealthQuery(baseUrl: string | null) {
  const query = useQuery({
    queryKey: ['health', baseUrl],
    queryFn: () => fetchHealth(baseUrl as string),
    enabled: baseUrl !== null,
    retry: false,
  });

  let status: ConnectionStatus;
  if (baseUrl === null) status = { kind: 'disconnected', reason: 'missing-config' };
  else if (query.isFetching) status = { kind: 'checking' };
  else if (query.isSuccess) status = { kind: 'connected', report: query.data };
  else status = { kind: 'disconnected', reason: 'unreachable' };

  return { status, refetch: query.refetch, isFetching: query.isFetching };
}
