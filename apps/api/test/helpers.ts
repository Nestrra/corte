/**
 * Shared helpers for the e2e suites (specs 001–005). Each suite boots its own app, so the in-memory
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

/** Fixed instant of the spec 004 e2e: 23 Nov 2026 in Bogotá (10:00 there). */
export const HOME_NOW = new Date('2026-11-23T15:00:00Z');

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

/**
 * Deletes every user (and, by cascade, cards, purchases, installments, statements, recurring
 * payments and their occurrences).
 */
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
  totalDebt: number;
  annualRate: number | null;
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

/** Valid purchase body (spec 003 quickstart.md B3); tests override what they need. */
export const VALID_PURCHASE = {
  amount: 300_000,
  concept: 'Mercado',
  purchaseDate: '2026-11-09',
  installmentCount: 1,
} as const;

export interface PlanInstallmentBody {
  number: number;
  cutoffDate: string;
  dueDate: string;
  principal: number;
  interest: number;
  statementId: string;
  statementStatus: 'open' | 'due' | 'overdue' | 'paid';
}

export interface PurchaseBody {
  id: string;
  cardId: string;
  amount: number;
  concept: string;
  purchaseDate: string;
  installmentCount: number;
  noInterest: boolean;
  annualRate: number | null;
  createdAt: string;
  updatedAt: string;
  installments: PlanInstallmentBody[];
}

export interface StatementBody {
  id: string;
  cardId: string;
  cutoffDate: string;
  dueDate: string;
  status: 'open' | 'due' | 'overdue' | 'paid';
  total: number;
  hasInterest: boolean;
  installmentsInStatement: number;
  paidAt: string | null;
  paidAmount: number | null;
}

/** Registers a purchase through the API (fails the test on non-201). */
export async function createPurchase(
  app: INestApplication,
  token: string,
  cardId: string,
  overrides: Record<string, unknown> = {},
): Promise<PurchaseBody> {
  const response = await request(app.getHttpServer())
    .post(`/api/v1/cards/${cardId}/purchases`)
    .set(bearer(token))
    .send({ ...VALID_PURCHASE, ...overrides })
    .expect(201);
  return response.body as PurchaseBody;
}

/** GET /cards/:id/statements (fails the test on non-200). */
export async function listStatements(
  app: INestApplication,
  token: string,
  cardId: string,
): Promise<StatementBody[]> {
  const response = await request(app.getHttpServer())
    .get(`/api/v1/cards/${cardId}/statements`)
    .set(bearer(token))
    .expect(200);
  return response.body as StatementBody[];
}

/** The statement of a card with this cutoff date, or undefined. */
export async function statementByCutoff(
  app: INestApplication,
  token: string,
  cardId: string,
  cutoffDate: string,
): Promise<StatementBody | undefined> {
  const statements = await listStatements(app, token, cardId);
  return statements.find((statement) => statement.cutoffDate === cutoffDate);
}

/** Creates a user and logs in; returns the session (helper for the spec 003 suites). */
export async function signUp(
  app: INestApplication,
  email: string,
  password = 'clave-segura-1',
): Promise<AuthResult> {
  await createUser(app, { name: email.split('@')[0], email, password });
  return login(app, email, password);
}

export interface LedgerRowCounts {
  purchases: number;
  installments: number;
  statements: number;
  availableCredit: number;
}

/** What a card has stored, to prove that an operation wrote nothing (spec 004 SC-002). */
export async function countLedgerRows(
  app: INestApplication,
  token: string,
  cardId: string,
): Promise<LedgerRowCounts> {
  const prisma = app.get(PrismaService);
  const [purchases, installments, statements, card] = await Promise.all([
    prisma.purchase.count({ where: { cardId } }),
    prisma.installment.count({ where: { purchase: { cardId } } }),
    prisma.statement.count({ where: { cardId } }),
    request(app.getHttpServer()).get(`/api/v1/cards/${cardId}`).set(bearer(token)).expect(200),
  ]);
  return {
    purchases,
    installments,
    statements,
    availableCredit: (card.body as CardBody).availableCredit,
  };
}

/** Valid recurring payment body (spec 005 quickstart.md B3); tests override what they need. */
export const VALID_RECURRING = {
  name: 'Arriendo',
  amount: 1_200_000,
  frequency: 'monthly',
  firstDueDate: '2026-11-01',
} as const;

export interface RecurringBody {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'annual';
  anchorDate: string;
  status: 'active' | 'paused';
  nextDueDate: string | null;
}

export interface OccurrenceBody {
  id: string;
  recurringPaymentId: string;
  name: string;
  frequency: 'monthly' | 'annual';
  dueDate: string;
  expectedAmount: number;
  paidAmount: number | null;
  paidAt: string | null;
  status: 'pending' | 'overdue' | 'paid';
  paymentDeleted: boolean;
}

export interface MonthViewBody {
  month: string;
  today: string;
  bounds: { first: string; last: string };
  hasPayments: boolean;
  totals: { total: number; paid: number; remaining: number };
  items: OccurrenceBody[];
}

/** Creates a recurring payment through the API (fails the test on non-201). */
export async function createRecurring(
  app: INestApplication,
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<RecurringBody> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/recurring')
    .set(bearer(token))
    .send({ ...VALID_RECURRING, ...overrides })
    .expect(201);
  return response.body as RecurringBody;
}

/** GET /recurring/occurrences?month= (fails the test on non-200). */
export async function monthView(
  app: INestApplication,
  token: string,
  month: string,
): Promise<MonthViewBody> {
  const response = await request(app.getHttpServer())
    .get('/api/v1/recurring/occurrences')
    .query({ month })
    .set(bearer(token))
    .expect(200);
  return response.body as MonthViewBody;
}

/** The occurrence of a payment by its name in a month view (fails the test when missing). */
export function occurrenceByName(view: MonthViewBody, name: string): OccurrenceBody {
  const occurrence = view.items.find((item) => item.name === name);
  if (!occurrence) throw new Error(`No occurrence of ${name} in ${view.month}`);
  return occurrence;
}

/** Due dates of a payment in a month view, by name. */
export function dueDatesOf(view: MonthViewBody, name: string): string[] {
  return view.items.filter((item) => item.name === name).map((item) => item.dueDate);
}
