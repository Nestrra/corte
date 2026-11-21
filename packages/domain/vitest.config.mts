import { defineConfig } from 'vitest/config';

// No minimum coverage threshold yet (spec 000, Assumptions): it is set with the first rules.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
