import { describe, expect, it } from 'vitest';
import { DOMAIN_PACKAGE_NAME } from './index';

// Smoke test: proves the test runner and coverage work before any business rule exists.
describe('@corte/domain', () => {
  it('exports its package name', () => {
    expect(DOMAIN_PACKAGE_NAME).toBe('intentionally-broken');
  });
});
