/**
 * Shared helpers for the e2e suites (specs 001 and 002). Each suite boots its own app, so the in-memory
 * rate-limit storage starts empty (research.md R4).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PasswordService } from '../src/auth/password.service';
import { CLOCK, type Clock } from '../src/common/clock';
import { PrismaService } from '../src/prisma/prisma.service';

export const TEST_DATABASE_URL = process.env.DATABASE_URL;
export const TEST_JWT_SECRET = 'e2e-test-secret-with-at-least-32-chars!!';

export type TestEnv = Partial<
  Record<
    'DATABASE_URL' | 'APP_ENV' | 'GIT_SHA' | 'SWAGGER_ENABLED' | 'JWT_SECRET' | 'TRUST_PROXY',
    string | undefined
  >
>;

/** Fixed instant of the spec 002 e2e (research.md R3): 21 Nov in Bogotá, 22 Nov in Madrid. */
export const FIXED_NOW = new Date('2026-11-22T02:30:00Z');

export interface TestAppOptions {
  /** Replaces the Clock provider with a fixed instant. */
  now?: Date;
}

export async function createTestApp(
  overrides: TestEnv = {},
  options: TestAppOptions = {},
): Promise<INestApplication> {
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

  let builder = Test.createTestingModule({ imports: [AppModule.register()] });
  if (options.now) {
    const fixed = options.now;
    const clock: Clock = { now: () => new Date(fixed) };
    builder = builder.overrideProvider(CLOCK).useValue(clock);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

/** Deletes every user (and, by cascade, everything they own, including cards). */
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

/** Valid card body (quickstart.md B2); tests override what they need. */
export const VALID_CARD = {
  name: 'Visa principal',
  color: 'verde',
  last4: '4821',
  cutoffDay: 8,
  dueDay: 25,
  creditLimit: 5_000_000,
  cycleBudget: 2_000_000,
} as const;

export interface CardBody {
  id: string;
  name: string;
  color: string;
  last4: string | null;
  cutoffDay: number;
  dueDay: number;
  creditLimit: number;
  cycleBudget: number;
  availableCredit: number;
  remindCutoffDays: number;
  remindDueDays: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Creates a card through the API (fails the test on non-201). */
export async function createCard(
  app: INestApplication,
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<CardBody> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/cards')
    .set(bearer(token))
    .send({ ...VALID_CARD, ...overrides })
    .expect(201);
  return response.body as CardBody;
}
