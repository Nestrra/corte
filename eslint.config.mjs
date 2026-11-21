// Single flat config for the whole monorepo (research.md R1). `pnpm lint` runs `eslint .` here.
import js from '@eslint/js';
import expoConfig from 'eslint-config-expo/flat.js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      'apps/api/src/generated/**',
      '.specify/**',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Principle I: the domain package is pure TypeScript without I/O.
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                'fs',
                'fs/*',
                'http',
                'https',
                'net',
                'child_process',
                'os',
                'path',
              ],
              message: 'packages/domain must not perform I/O (constitution, principle I).',
            },
            {
              group: ['pg', 'pg/*', '@prisma/*', 'react', 'react-*', 'react/*', 'expo', 'expo-*'],
              message: 'packages/domain must not depend on database, React or Expo packages.',
            },
          ],
        },
      ],
    },
  },
  // Expo / React Native rules only for the mobile app (ESLint `basePath` scopes each entry).
  ...expoConfig.map((config) => ({ ...config, basePath: 'apps/mobile' })),
  {
    basePath: 'apps/mobile',
    // eslint-plugin-react's version auto-detection calls an API removed in ESLint 10, so the
    // React version is declared explicitly (keep in sync with apps/mobile/package.json).
    settings: { react: { version: '19.3' } },
  },
  prettier,
);
