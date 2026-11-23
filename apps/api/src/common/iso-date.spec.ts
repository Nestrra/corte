import { fromDbDate, toDbDate } from './iso-date';

describe('iso-date (research.md R9)', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('round-trips business dates through UTC midnight', () => {
    for (const date of ['2026-11-08', '2027-02-28', '2028-02-29', '2026-12-31', '2027-01-01']) {
      expect(toDbDate(date).toISOString()).toBe(`${date}T00:00:00.000Z`);
      expect(fromDbDate(toDbDate(date))).toBe(date);
    }
  });

  it.each(['America/Bogota', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
    'does not shift the day with TZ=%s',
    (tz) => {
      process.env.TZ = tz;
      expect(fromDbDate(toDbDate('2026-11-21'))).toBe('2026-11-21');
      expect(fromDbDate(new Date(Date.UTC(2026, 10, 21)))).toBe('2026-11-21');
    },
  );

  it('rejects invalid dates', () => {
    expect(() => toDbDate('2026-02-30')).toThrow(RangeError);
    expect(() => toDbDate('21/11/2026')).toThrow(RangeError);
  });
});
