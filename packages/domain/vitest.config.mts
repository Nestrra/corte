import { defineConfig } from 'vitest/config';

// Coverage gate of spec 002 (FR-009): `test:cov` fails below 95%, and the CI job domain-test runs it.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
