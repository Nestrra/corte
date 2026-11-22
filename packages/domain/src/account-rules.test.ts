import { describe, expect, it } from 'vitest';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isValidEmail,
  normalizeEmail,
  normalizeName,
  validateName,
  validatePassword,
} from './account-rules';

describe('account rules (data-model.md → User)', () => {
  it('exposes the limits of the spec', () => {
    expect(NAME_MAX_LENGTH).toBe(80);
    expect(EMAIL_MAX_LENGTH).toBe(254);
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });

  describe('normalizeEmail', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmail('  Ana@Ejemplo.COM ')).toBe('ana@ejemplo.com');
    });
  });

  describe('isValidEmail', () => {
    it.each(['ana@ejemplo.com', 'a.b+c@sub.dominio.co'])('accepts %s', (email) => {
      expect(isValidEmail(email)).toBe(true);
    });

    it.each(['', 'ana', 'ana@', '@ejemplo.com', 'ana@ejemplo', 'ana @ejemplo.com', 'a@b@c.com'])(
      'rejects %j',
      (email) => {
        expect(isValidEmail(email)).toBe(false);
      },
    );

    it('accepts exactly 254 characters and rejects 255', () => {
      const domain = '@ejemplo.com';
      const at254 = 'a'.repeat(254 - domain.length) + domain;
      expect(at254).toHaveLength(254);
      expect(isValidEmail(at254)).toBe(true);
      expect(isValidEmail('a' + at254)).toBe(false);
    });
  });

  describe('names', () => {
    it('normalizeName trims', () => {
      expect(normalizeName('  Ana María  ')).toBe('Ana María');
    });

    it('accepts 1 to 80 characters after trimming', () => {
      expect(validateName('A')).toBeNull();
      expect(validateName('a'.repeat(80))).toBeNull();
      expect(validateName('  ' + 'a'.repeat(80) + '  ')).toBeNull();
    });

    it('rejects empty or blank names and names over 80 characters', () => {
      expect(validateName('')).toBe('REQUIRED');
      expect(validateName('   ')).toBe('REQUIRED');
      expect(validateName('a'.repeat(81))).toBe('TOO_LONG');
    });
  });

  describe('passwords', () => {
    it('accepts 8 to 128 characters', () => {
      expect(validatePassword('a'.repeat(8))).toBeNull();
      expect(validatePassword('a'.repeat(128))).toBeNull();
    });

    it('rejects shorter or longer passwords', () => {
      expect(validatePassword('a'.repeat(7))).toBe('TOO_SHORT');
      expect(validatePassword('a'.repeat(129))).toBe('TOO_LONG');
    });

    it('does not trim: spaces count as characters', () => {
      expect(validatePassword('   abcd   ')).toBeNull();
      expect(validatePassword('  abc  ')).toBe('TOO_SHORT');
    });
  });
});
