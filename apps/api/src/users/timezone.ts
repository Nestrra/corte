/**
 * IANA time zone validation (FR-019; data-model.md User.timezone).
 *
 * The time zone database decides through `Intl.DateTimeFormat`, so links such as
 * `America/Argentina/Buenos_Aires` or `US/Eastern` are accepted too (`Intl.supportedValuesOf`
 * lists only the CLDR canonical ids and rejected them). ICU also accepts any casing and UTC
 * offsets such as `+05:00`, which are not zone names, so the value must first look like an IANA
 * name: segments separated by `/`, each starting with an uppercase letter.
 */
const IANA_NAME = /^[A-Z][A-Za-z0-9_+-]*(?:\/[A-Z][A-Za-z0-9_+-]*)*$/;

export function isValidTimeZone(value: string): boolean {
  if (!IANA_NAME.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
