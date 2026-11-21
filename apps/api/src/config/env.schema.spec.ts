import { validateEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://corte:corte@localhost:5434/corte_dev',
  APP_ENV: 'development',
  JWT_SECRET: 'test-secret-with-at-least-32-characters!!',
};

/** Value shipped in apps/api/.env.example (development only). */
const EXAMPLE_JWT_SECRET = 'dev-only-change-me-0123456789abcdef';

describe('validateEnv', () => {
  it('accepts a minimal valid configuration and applies defaults', () => {
    expect(validateEnv({ ...base })).toEqual({
      DATABASE_URL: base.DATABASE_URL,
      APP_ENV: 'development',
      PORT: 3000,
      GIT_SHA: 'unknown',
      SWAGGER_ENABLED: false,
      JWT_SECRET: base.JWT_SECRET,
      TRUST_PROXY: 0,
    });
  });

  describe('DATABASE_URL', () => {
    it('is required', () => {
      expect(() => validateEnv({ APP_ENV: 'development', JWT_SECRET: base.JWT_SECRET })).toThrow(
        /DATABASE_URL/,
      );
    });

    it('rejects an empty value', () => {
      expect(() => validateEnv({ ...base, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
    });

    it.each(['postgresql://u:p@h:5432/db', 'postgres://u:p@h:5432/db'])('accepts %s', (url) => {
      expect(validateEnv({ ...base, DATABASE_URL: url }).DATABASE_URL).toBe(url);
    });

    it.each(['mysql://u:p@h/db', 'not-a-url'])('rejects %s', (url) => {
      expect(() => validateEnv({ ...base, DATABASE_URL: url })).toThrow(/DATABASE_URL/);
    });
  });

  describe('APP_ENV', () => {
    it('is required', () => {
      expect(() =>
        validateEnv({ DATABASE_URL: base.DATABASE_URL, JWT_SECRET: base.JWT_SECRET }),
      ).toThrow(/APP_ENV/);
    });

    it.each(['development', 'test', 'staging', 'production'])('accepts %s', (appEnv) => {
      expect(validateEnv({ ...base, APP_ENV: appEnv }).APP_ENV).toBe(appEnv);
    });

    it('rejects values outside the enum', () => {
      expect(() => validateEnv({ ...base, APP_ENV: 'prod' })).toThrow(/APP_ENV/);
    });
  });

  describe('PORT', () => {
    it('defaults to 3000 when absent or empty', () => {
      expect(validateEnv({ ...base }).PORT).toBe(3000);
      expect(validateEnv({ ...base, PORT: '' }).PORT).toBe(3000);
    });

    it('parses a numeric string', () => {
      expect(validateEnv({ ...base, PORT: '8080' }).PORT).toBe(8080);
    });

    it.each(['0', '65536', 'abc', '3000.5'])('rejects %s', (port) => {
      expect(() => validateEnv({ ...base, PORT: port })).toThrow(/PORT/);
    });
  });

  describe('GIT_SHA', () => {
    it('is "unknown" when absent, empty or blank', () => {
      expect(validateEnv({ ...base }).GIT_SHA).toBe('unknown');
      expect(validateEnv({ ...base, GIT_SHA: '' }).GIT_SHA).toBe('unknown');
      expect(validateEnv({ ...base, GIT_SHA: '   ' }).GIT_SHA).toBe('unknown');
    });

    it('keeps the provided value', () => {
      expect(validateEnv({ ...base, GIT_SHA: 'abc123' }).GIT_SHA).toBe('abc123');
    });
  });

  describe('SWAGGER_ENABLED', () => {
    it('defaults to false', () => {
      expect(validateEnv({ ...base }).SWAGGER_ENABLED).toBe(false);
      expect(validateEnv({ ...base, SWAGGER_ENABLED: '' }).SWAGGER_ENABLED).toBe(false);
    });

    it('parses true and false', () => {
      expect(validateEnv({ ...base, SWAGGER_ENABLED: 'true' }).SWAGGER_ENABLED).toBe(true);
      expect(validateEnv({ ...base, SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED).toBe(false);
    });

    it('rejects other values', () => {
      expect(() => validateEnv({ ...base, SWAGGER_ENABLED: 'yes' })).toThrow(/SWAGGER_ENABLED/);
    });

    it('is forbidden in production (constitution, principle V)', () => {
      expect(() =>
        validateEnv({ ...base, APP_ENV: 'production', SWAGGER_ENABLED: 'true' }),
      ).toThrow(/SWAGGER_ENABLED/);
    });

    it('may be false in production', () => {
      expect(
        validateEnv({ ...base, APP_ENV: 'production', SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED,
      ).toBe(false);
    });
  });

  describe('JWT_SECRET', () => {
    it('is required', () => {
      const withoutSecret: Partial<typeof base> = { ...base };
      delete withoutSecret.JWT_SECRET;
      expect(() => validateEnv(withoutSecret)).toThrow(/JWT_SECRET/);
    });

    it('must have at least 32 characters', () => {
      expect(() => validateEnv({ ...base, JWT_SECRET: 'a'.repeat(31) })).toThrow(/JWT_SECRET/);
      expect(validateEnv({ ...base, JWT_SECRET: 'a'.repeat(32) }).JWT_SECRET).toHaveLength(32);
    });

    it('accepts the .env.example value outside production', () => {
      expect(validateEnv({ ...base, JWT_SECRET: EXAMPLE_JWT_SECRET }).JWT_SECRET).toBe(
        EXAMPLE_JWT_SECRET,
      );
    });

    it('rejects the .env.example value in production', () => {
      expect(() =>
        validateEnv({ ...base, APP_ENV: 'production', JWT_SECRET: EXAMPLE_JWT_SECRET }),
      ).toThrow(/JWT_SECRET/);
    });

    it('never prints the secret in the error message', () => {
      let message = '';
      try {
        validateEnv({ ...base, JWT_SECRET: 'short-secret-value' });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/JWT_SECRET/);
      expect(message).not.toContain('short-secret-value');
    });
  });

  describe('TRUST_PROXY', () => {
    it('defaults to 0', () => {
      expect(validateEnv({ ...base }).TRUST_PROXY).toBe(0);
      expect(validateEnv({ ...base, TRUST_PROXY: '' }).TRUST_PROXY).toBe(0);
    });

    it('accepts integers ≥ 0', () => {
      expect(validateEnv({ ...base, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
      expect(validateEnv({ ...base, TRUST_PROXY: '2' }).TRUST_PROXY).toBe(2);
    });

    it.each(['-1', '1.5', 'true', 'abc'])('rejects %s', (value) => {
      expect(() => validateEnv({ ...base, TRUST_PROXY: value })).toThrow(/TRUST_PROXY/);
    });
  });

  it('lists every invalid variable without printing secret values', () => {
    const secretUrl = 'mysql://admin:super-secret-password@db/prod';
    let message = '';
    try {
      validateEnv({ ...base, DATABASE_URL: secretUrl, APP_ENV: 'nope', PORT: '-1' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).toMatch(/APP_ENV/);
    expect(message).toMatch(/PORT/);
    expect(message).not.toContain('super-secret-password');
    expect(message).not.toContain('nope');
  });
});
