import { todayInTimeZone } from './today';

describe('todayInTimeZone (research.md R3)', () => {
  const instant = new Date('2026-11-22T02:30:00Z');

  it('gives the calendar date in each zone for the same instant', () => {
    expect(todayInTimeZone('America/Bogota', instant)).toBe('2026-11-21');
    expect(todayInTimeZone('Europe/Madrid', instant)).toBe('2026-11-22');
    expect(todayInTimeZone('UTC', instant)).toBe('2026-11-22');
  });

  it('handles the year change and zero padding', () => {
    const newYear = new Date('2027-01-01T03:00:00Z');
    expect(todayInTimeZone('America/Bogota', newYear)).toBe('2026-12-31');
    expect(todayInTimeZone('Asia/Tokyo', newYear)).toBe('2027-01-01');
    expect(todayInTimeZone('America/Bogota', new Date('2026-03-05T12:00:00Z'))).toBe('2026-03-05');
  });

  it('rejects an invalid time zone', () => {
    expect(() => todayInTimeZone('Marte/Base', instant)).toThrow(RangeError);
  });
});
