import {
  LOCK_DURATION_MS,
  LoginAttemptsService,
  MAX_FAILED_ATTEMPTS,
  WINDOW_MS,
} from './login-attempts.service';

describe('LoginAttemptsService', () => {
  let now: number;
  let service: LoginAttemptsService;

  beforeEach(() => {
    now = 1_000_000;
    service = new LoginAttemptsService();
    service.now = () => now;
  });

  const fail = (times: number, email = 'ana@ejemplo.com') => {
    for (let i = 0; i < times; i++) service.recordFailure(email);
  };

  it('uses the limits of FR-013', () => {
    expect(MAX_FAILED_ATTEMPTS).toBe(5);
    expect(WINDOW_MS).toBe(15 * 60_000);
    expect(LOCK_DURATION_MS).toBe(15 * 60_000);
  });

  it('locks after 5 failures within 15 minutes', () => {
    fail(4);
    expect(service.isLocked('ana@ejemplo.com')).toBe(false);
    fail(1);
    expect(service.isLocked('ana@ejemplo.com')).toBe(true);
  });

  it('unlocks 15 minutes after locking', () => {
    fail(5);
    now += LOCK_DURATION_MS - 1;
    expect(service.isLocked('ana@ejemplo.com')).toBe(true);
    now += 1;
    expect(service.isLocked('ana@ejemplo.com')).toBe(false);
  });

  it('ignores failures older than the window', () => {
    fail(4);
    now += WINDOW_MS + 1;
    fail(1);
    expect(service.isLocked('ana@ejemplo.com')).toBe(false);
  });

  it('resets the counter after a successful login', () => {
    fail(4);
    service.recordSuccess('ana@ejemplo.com');
    fail(4);
    expect(service.isLocked('ana@ejemplo.com')).toBe(false);
  });

  it('tracks each email independently', () => {
    fail(5, 'ana@ejemplo.com');
    expect(service.isLocked('luis@ejemplo.com')).toBe(false);
  });
});
