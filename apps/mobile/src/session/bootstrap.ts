import { refresh } from '../api/auth';
import { ApiError } from '../api/errors';
import { secureStorage } from './secure-storage';
import { useSessionStore } from './session-store';

/**
 * Restores the session when the app opens (research.md R10, SC-002):
 * - no stored refresh token → `signedOut` (with the last email prefilled);
 * - the API renews it → `signedIn` (the refresh answer already carries the profile, the same
 *   body as `GET /me`, so a second request is not needed);
 * - the API rejects it (401) → token deleted, `signedOut` with the matching notice;
 * - no answer → `offline`: the session is kept so "Reintentar" can restore it later.
 */
export async function bootstrapSession(): Promise<void> {
  const store = useSessionStore.getState();
  const [refreshToken, lastEmail] = await Promise.all([
    secureStorage.getRefreshToken(),
    secureStorage.getLastEmail(),
  ]);
  store.setLastEmail(lastEmail);

  if (refreshToken === null) {
    await store.signOut();
    return;
  }

  try {
    await store.signIn(await refresh(refreshToken));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await store.signOut({ notice: error.code === 'SESSION_REVOKED' ? 'revoked' : 'expired' });
    } else {
      // No answer or an unexpected server error: keep the session and offer a retry.
      store.setOffline();
    }
  }
}
