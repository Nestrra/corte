/**
 * API base URL from the environment (data-model.md → MobileConfig.EXPO_PUBLIC_API_URL).
 * Must be read with dot notation so Expo inlines it at build time.
 */
export function parseApiUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value || !/^https?:\/\/[^/\s]+/i.test(value)) return null;
  // Normalized: trailing slashes removed.
  return value.replace(/\/+$/, '');
}

export const API_URL: string | null = parseApiUrl(process.env.EXPO_PUBLIC_API_URL);
