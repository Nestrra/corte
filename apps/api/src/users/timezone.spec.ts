import { isValidTimeZone } from './timezone';

describe('isValidTimeZone', () => {
  it.each(['America/Bogota', 'America/Mexico_City', 'Europe/Madrid', 'Atlantic/Canary', 'UTC'])(
    'accepts %s',
    (zone) => {
      expect(isValidTimeZone(zone)).toBe(true);
    },
  );

  it.each(['', 'Marte/Base', 'america/bogota', 'Bogota', 'GMT+5', '../etc/passwd'])(
    'rejects %j',
    (zone) => {
      expect(isValidTimeZone(zone)).toBe(false);
    },
  );
});
