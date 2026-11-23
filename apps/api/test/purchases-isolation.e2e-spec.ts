/**
 * Spec 003 US9 — principle III: a user never reads, lists, creates, edits, deletes, pays or undoes
 * the payment of another user's purchases and statements (FR-025, FR-026). Another user's resource
 * answers exactly like a missing one.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createCard,
  createPurchase,
  createTestApp,
  FIXED_NOW,
  listStatements,
  resetDatabase,
  signUp,
  VALID_PURCHASE,
  type AuthResult,
  type CardBody,
  type PurchaseBody,
  type StatementBody,
} from './helpers';

const RANDOM_UUID = '0b6f1c9e-5d2a-4c3b-9e8f-7a6b5c4d3e2f';

describe('Purchase and statement isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ana: AuthResult;
  let beto: AuthResult;
  let anaCard: CardBody;
  let betoCard: CardBody;
  let anaPurchase: PurchaseBody;
  let anaDue: StatementBody;
  let anaPaid: StatementBody;

  beforeEach(async () => {
    app = await createTestApp({}, { now: FIXED_NOW });
    prisma = app.get(PrismaService);
    await resetDatabase(app);
    ana = await signUp(app, 'ana@ejemplo.com');
    beto = await signUp(app, 'beto@ejemplo.com');
    anaCard = await createCard(app, ana.accessToken, { name: 'Visa de Ana', annualRate: 24 });
    betoCard = await createCard(app, beto.accessToken, { name: 'Visa de Beto' });

    // Sep 20 × 3: Oct 8 created as paid, Nov 8 due, Dec 8 open.
    anaPurchase = await createPurchase(app, ana.accessToken, anaCard.id, {
      purchaseDate: '2026-09-20',
      installmentCount: 3,
    });
    await createPurchase(app, beto.accessToken, betoCard.id);
    const statements = await listStatements(app, ana.accessToken, anaCard.id);
    anaDue = statements.find((statement) => statement.status === 'due')!;
    anaPaid = statements.find((statement) => statement.status === 'paid')!;
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  /** Every row of Ana's that a foreign request could touch. */
  const anaRows = async () => ({
    card: await prisma.card.findUniqueOrThrow({ where: { id: anaCard.id } }),
    purchases: await prisma.purchase.findMany({ where: { cardId: anaCard.id } }),
    installments: await prisma.installment.findMany({
      where: { purchase: { cardId: anaCard.id } },
      orderBy: { id: 'asc' },
    }),
    statements: await prisma.statement.findMany({
      where: { cardId: anaCard.id },
      orderBy: { id: 'asc' },
    }),
  });

  it("another user's purchases and statements answer like missing ones, for every operation", async () => {
    const before = await anaRows();
    const missingPurchase = await http()
      .get(`/api/v1/purchases/${RANDOM_UUID}`)
      .set(bearer(beto.accessToken))
      .expect(404);
    const malformed = await http()
      .get('/api/v1/statements/no-es-uuid')
      .set(bearer(beto.accessToken))
      .expect(404);
    expect(malformed.body.code).toBe('NOT_FOUND');

    const attempts: Array<[string, () => request.Test]> = [
      ['GET card purchases', () => http().get(`/api/v1/cards/${anaCard.id}/purchases`)],
      [
        'POST card purchases',
        () => http().post(`/api/v1/cards/${anaCard.id}/purchases`).send(VALID_PURCHASE),
      ],
      ['GET purchase', () => http().get(`/api/v1/purchases/${anaPurchase.id}`)],
      [
        'PATCH purchase',
        () => http().patch(`/api/v1/purchases/${anaPurchase.id}`).send({ amount: 1, concept: 'X' }),
      ],
      ['DELETE purchase', () => http().delete(`/api/v1/purchases/${anaPurchase.id}`)],
      ['GET card statements', () => http().get(`/api/v1/cards/${anaCard.id}/statements`)],
      ['GET statement', () => http().get(`/api/v1/statements/${anaDue.id}`)],
      ['POST payment', () => http().post(`/api/v1/statements/${anaDue.id}/payment`)],
      ['DELETE payment', () => http().delete(`/api/v1/statements/${anaPaid.id}/payment`)],
    ];
    for (const [label, attempt] of attempts) {
      const response = await attempt().set(bearer(beto.accessToken));
      expect({ label, status: response.status }).toEqual({ label, status: 404 });
      expect({ label, code: response.body.code }).toEqual({ label, code: 'NOT_FOUND' });
      // The same body for every missing resource kind, except the message naming it.
      expect(Object.keys(response.body).sort()).toEqual(Object.keys(missingPurchase.body).sort());
    }
    expect(await anaRows()).toEqual(before);
  });

  it('missing, malformed and foreign ids give the same body per resource', async () => {
    const pairs: Array<[string, string]> = [
      [`/api/v1/purchases/${RANDOM_UUID}`, `/api/v1/purchases/${anaPurchase.id}`],
      [`/api/v1/statements/${RANDOM_UUID}`, `/api/v1/statements/${anaDue.id}`],
      [`/api/v1/cards/${RANDOM_UUID}/purchases`, `/api/v1/cards/${anaCard.id}/purchases`],
      [`/api/v1/cards/${RANDOM_UUID}/statements`, `/api/v1/cards/${anaCard.id}/statements`],
    ];
    for (const [missing, foreign] of pairs) {
      const a = await http().get(missing).set(bearer(beto.accessToken)).expect(404);
      const b = await http().get(foreign).set(bearer(beto.accessToken)).expect(404);
      const c = await http()
        .get(missing.replace(RANDOM_UUID, 'no-es-uuid'))
        .set(bearer(beto.accessToken))
        .expect(404);
      expect(b.body).toEqual(a.body);
      expect(c.body).toEqual(a.body);
    }
  });

  it('each user lists only their own purchases and statements', async () => {
    const anaList = await http()
      .get(`/api/v1/cards/${anaCard.id}/purchases`)
      .set(bearer(ana.accessToken))
      .expect(200);
    const betoList = await http()
      .get(`/api/v1/cards/${betoCard.id}/purchases`)
      .set(bearer(beto.accessToken))
      .expect(200);
    expect((anaList.body as PurchaseBody[]).every((p) => p.cardId === anaCard.id)).toBe(true);
    expect((betoList.body as PurchaseBody[]).every((p) => p.cardId === betoCard.id)).toBe(true);
    const betoStatements = await listStatements(app, beto.accessToken, betoCard.id);
    expect(betoStatements.every((s) => s.cardId === betoCard.id)).toBe(true);
    expect(betoStatements.map((s) => s.id)).not.toContain(anaDue.id);
  });

  it("deleting Ana's account removes her purchases, installments and statements only", async () => {
    const betoCounts = async () => ({
      purchases: await prisma.purchase.count({ where: { cardId: betoCard.id } }),
      installments: await prisma.installment.count({
        where: { purchase: { cardId: betoCard.id } },
      }),
      statements: await prisma.statement.count({ where: { cardId: betoCard.id } }),
    });
    const before = await betoCounts();
    await http()
      .delete('/api/v1/me')
      .set(bearer(ana.accessToken))
      .send({ password: 'clave-segura-1' })
      .expect(204);
    expect(await prisma.purchase.count({ where: { cardId: anaCard.id } })).toBe(0);
    expect(await prisma.installment.count({ where: { purchaseId: anaPurchase.id } })).toBe(0);
    expect(await prisma.statement.count({ where: { cardId: anaCard.id } })).toBe(0);
    expect(await betoCounts()).toEqual(before);
  });
});
