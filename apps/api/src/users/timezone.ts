/**
 * IANA time zone validation (FR-019; data-model.md User.timezone). Node 24 ships full ICU, so
 * Intl.supportedValuesOf lists every canonical zone; UTC is added explicitly.
 */
let zones: Set<string> | undefined;

export function isValidTimeZone(value: string): boolean {
  zones ??= new Set([...Intl.supportedValuesOf('timeZone'), 'UTC']);
  return zones.has(value);
}
