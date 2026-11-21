// Prisma 7 CLI configuration (research.md R4).
// Prisma 7 does not load .env by itself, so dotenv is imported here (CLI only).
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `prisma generate` does not connect to the database, but the config must load. The strict
// `env()` helper would throw when DATABASE_URL is unset (CI lint job, Docker build stage), so
// a non-secret placeholder is used instead. The running API never uses this value: its
// DATABASE_URL comes from the zod-validated configuration (src/config/env.schema.ts).
const PLACEHOLDER_DATABASE_URL = 'postgresql://placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || PLACEHOLDER_DATABASE_URL,
  },
});
