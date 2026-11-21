import { create } from 'zustand';
import type { AuthResult, User } from '../api/types';
import { secureStorage } from './secure-storage';

/**
 * Session state of the app (research.md R10).
 * - `restoring`: splash while the stored session is checked.
 * - `offline`: a stored session exists but the API is unreachable (it is kept).
 */
export type SessionStatus = 'restoring' | 'signedOut' | 'signedIn' | 'offline';

/** Why the user was sent back to the login screen (contracts/errors.md). */
export type SessionNotice = 'expired' | 'revoked';

export interface SignOutOptions {
  notice?: SessionNotice;
  /** Also forget the last email (after deleting the account). */
  forgetEmail?: boolean;
}

interface SessionState {
  status: SessionStatus;
  /** Lives only in memory (research.md R10). */
  accessToken: string | null;
  user: User | null;
  lastEmail: string | null;
  notice: SessionNotice | null;

  /** Stores a new session (register, login, restore). */
  signIn: (result: AuthResult) => Promise<void>;
  /** Stores a rotated token pair without changing the status. */
  applyRefresh: (result: AuthResult) => Promise<void>;
  /** Clears the local session; the email stays for the login screen unless told otherwise. */
  signOut: (options?: SignOutOptions) => Promise<void>;
  setUser: (user: User) => void;
  setOffline: () => void;
  setLastEmail: (email: string | null) => void;
  clearNotice: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  status: 'restoring',
  accessToken: null,
  user: null,
  lastEmail: null,
  notice: null,

  signIn: async ({ accessToken, refreshToken, user }) => {
    // Persist first: if the app dies right after, the next start can still restore the session.
    await secureStorage.setRefreshToken(refreshToken);
    await secureStorage.setLastEmail(user.email);
    set({ status: 'signedIn', accessToken, user, lastEmail: user.email, notice: null });
  },

  applyRefresh: async ({ accessToken, refreshToken, user }) => {
    await secureStorage.setRefreshToken(refreshToken);
    set({ accessToken, user });
  },

  signOut: async ({ notice, forgetEmail = false } = {}) => {
    await secureStorage.deleteRefreshToken();
    if (forgetEmail) await secureStorage.deleteLastEmail();
    set((state) => ({
      status: 'signedOut',
      accessToken: null,
      user: null,
      notice: notice ?? null,
      lastEmail: forgetEmail ? null : (state.user?.email ?? state.lastEmail),
    }));
  },

  setUser: (user) => set({ user }),
  setOffline: () => set({ status: 'offline', accessToken: null }),
  setLastEmail: (lastEmail) => set({ lastEmail }),
  clearNotice: () => set({ notice: null }),
}));
