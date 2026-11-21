import * as SecureStore from 'expo-secure-store';

/**
 * Values that must survive closing the app (research.md R10): the refresh token and the last
 * email used, so the login screen can prefill it (FR-011). The access token never lands here.
 */
const KEYS = {
  refreshToken: 'corte.refreshToken',
  lastEmail: 'corte.lastEmail',
} as const;

// iOS: readable only while the device is unlocked and never migrated to another device.
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureStorage = {
  getRefreshToken: () => SecureStore.getItemAsync(KEYS.refreshToken, OPTIONS),
  setRefreshToken: (token: string) => SecureStore.setItemAsync(KEYS.refreshToken, token, OPTIONS),
  deleteRefreshToken: () => SecureStore.deleteItemAsync(KEYS.refreshToken, OPTIONS),

  getLastEmail: () => SecureStore.getItemAsync(KEYS.lastEmail, OPTIONS),
  setLastEmail: (email: string) => SecureStore.setItemAsync(KEYS.lastEmail, email, OPTIONS),
  deleteLastEmail: () => SecureStore.deleteItemAsync(KEYS.lastEmail, OPTIONS),
};
