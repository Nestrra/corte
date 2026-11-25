import type { PushTarget } from '@corte/domain';
import { router } from 'expo-router';
import { getCard } from '../api/cards';
import { ApiError } from '../api/errors';
import { getOccurrence } from '../api/recurring';
import { getStatement } from '../api/statements';
import { useSessionStore } from '../session/session-store';

const TARGET_TYPES = ['card', 'statement', 'occurrence', 'history'] as const;

/** Reads the `target` of a push's `data`, ignoring anything unexpected (or null, as the test). */
export function parsePushTarget(data: unknown): PushTarget | null {
  const target = (data as { target?: unknown } | null | undefined)?.target;
  if (typeof target !== 'object' || target === null) return null;
  const { type, id } = target as { type?: unknown; id?: unknown };
  if (!TARGET_TYPES.some((known) => known === type)) return null;
  if (type === 'history') return { type };
  if (typeof id !== 'string' || id.length === 0) return null;
  return { type: type as 'card' | 'statement' | 'occurrence', id };
}

type ResourceTarget = Exclude<PushTarget, { type: 'history' }>;

const UNAVAILABLE = { pathname: '/notifications', params: { unavailable: '1' } } as const;

/** Route and fetch of each destination (contracts/screens.md → Navegación). */
const RESOURCES = {
  card: { pathname: '/card/[id]', fetch: getCard },
  statement: { pathname: '/statement/[id]', fetch: getStatement },
  occurrence: { pathname: '/occurrence/[id]', fetch: getOccurrence },
} as const;

/**
 * Opens the screen of a notification (research.md R10). The resource is fetched first: a 404
 * (deleted, archived or someone else's: the API answers the same) opens the history with "Esto
 * ya no está disponible". Without a session nothing happens; the login guard applies.
 */
export async function openTarget(target: PushTarget | null): Promise<void> {
  if (target === null) return;
  if (useSessionStore.getState().status !== 'signedIn') return;
  if (target.type === 'history') {
    router.push('/notifications');
    return;
  }
  await openResource(target);
}

async function openResource({ type, id }: ResourceTarget): Promise<void> {
  const resource = RESOURCES[type];
  try {
    await resource.fetch(id);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') {
      router.push(UNAVAILABLE);
      return;
    }
    // Offline or a server error: the destination screen shows its own error and retry.
  }
  router.push({ pathname: resource.pathname, params: { id } });
}
