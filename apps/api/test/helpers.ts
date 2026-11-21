/**
 * Shared helpers for the e2e suites (spec 001). Each suite boots its own app, so the in-memory
 * rate-limit storage starts empty (research.md R4).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PasswordService } from '../src/auth/password.service';
import { PrismaService } from '../src/prisma/prisma.service';

export const TEST_DATABASE_URL = process.env.DATABASE_URL;
export const TEST_JWT_SECRET = 'e2e-test-secret-with-at-least-32-chars!!';

export type TestEnv = Partial<
  Record<
    'DATABASE_URL' | 'APP_ENV' | 'GIT_SHA' | 'SWAGGER_ENABLED' | 'JWT_SECRET' | 'TRUST_PROXY',
    string | undefined
  >
>;

export async function createTestApp(overrides: TestEnv = {}): Promise<INestApplication> {
  if (!TEST_DATABASE_URL) throw new Error('DATABASE_URL must point to the test database');
  const env: TestEnv = {
    DATABASE_URL: TEST_DATABASE_URL,
    APP_ENV: 'test',
    GIT_SHA: '',
    SWAGGER_ENABLED: 'false',
    JWT_SECRET: TEST_JWT_SECRET,
    TRUST_PROXY: '0',
    ...overrides,
  };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  const moduleRef = await Test.createTestingModule({ imports: [AppModule.register()] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

/** Deletes every user (and, by cascade, everything they own). */
export async function resetDatabase(app: INestApplication): Promise<void> {
  await app.get(PrismaService).$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
}

export interface TestUserInput {
  name?: string;
  email: string;
  password: string;
  mustChangePassword?: boolean;
}

/** Creates a user directly in the database (bypasses the API and its rate limits). */
export async function createUser(app: INestApplication, input: TestUserInput) {
  const passwordHash = await app.get(PasswordService).hash(input.password);
  return app.get(PrismaService).user.create({
    data: {
      name: input.name ?? 'Usuario de prueba',
      email: input.email,
      passwordHash,
      mustChangePassword: input.mustChangePassword ?? false,
    },
  });
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    timezone: string;
    mustChangePassword: boolean;
  };
}

/** Logs in through the API and returns the AuthResult (fails the test on non-200). */
export async function login(
  app: INestApplication,
  email: string,
  password: string,
): Promise<AuthResult> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return response.body as AuthResult;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
