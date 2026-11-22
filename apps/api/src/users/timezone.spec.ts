import { isValidTimeZone } from './timezone';

describe('isValidTimeZone', () => {
  it.each([
    'America/Bogota',
    'America/Mexico_City',
    'Europe/Madrid',
    'Atlantic/Canary',
    'UTC',
    // IANA links that Intl.supportedValuesOf does not list (it returns CLDR canonical ids).
    'America/Argentina/Buenos_Aires',
    'Asia/Kolkata',
    'US/Eastern',
    'Etc/GMT+5',
  ])('accepts %s', (zone) => {
    expect(isValidTimeZone(zone)).toBe(true);
  });

  it.each([
    '',
    'Marte/Base',
    'america/bogota',
    'Bogota',
    'GMT+5',
    '+05:00',
    '../etc/passwd',
    'America/',
  ])('rejects %j', (zone) => {
    expect(isValidTimeZone(zone)).toBe(false);
  });
});
