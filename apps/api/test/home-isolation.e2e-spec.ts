/**
 * Spec 004 US6 — principle III: nobody simulates on another user's card nor sees it in their home
 * summary (FR-023, FR-024, SC-007). Another user's card answers exactly like a missing one.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  bearer,
  createCard,
  createPurchase,
  createTestApp,
  HOME_NOW,
  resetDatabase,
  signUp,
  type AuthResult,
  type CardBody,
} from './helpers';

const RANDOM_UUID = '0b6f1c9e-5d2a-4c3b-9e8f-7a6b5c4d3e2f';

describe('Simulation and home isolation (e2e)', () => {
  let app: INestApplication;
  let ana: AuthResult;
  let beto: AuthResult;
  let anaCard: CardBody;
  let anaArchived: CardBody;
  let betoCard: CardBody;

  beforeEach(async () => {
    app = await createTestApp({}, { now: HOME_NOW });
    await resetDatabase(app);
    ana = await signUp(app, 'ana@ejemplo.com');
    beto = await signUp(app, 'beto@ejemplo.com');
    anaCard = await createCard(app, ana.accessToken, { name: 'Visa de Ana', annualRate: 24 });
    anaArchived = await createCard(app, ana.accessToken, { name: 'Vieja de Ana' });
    await http()
      .post(`/api/v1/cards/${anaArchived.id}/archive`)
      .set(bearer(ana.accessToken))
      .expect(200);
    betoCard = await createCard(app, beto.accessToken, { name: 'Visa de Beto' });
    await createPurchase(app, ana.accessToken, anaCard.id, {
      amount: 850_000,
      purchaseDate: '2026-11-05',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const simulate = (token: string, cardId: string) =>
    http().post(`/api/v1/cards/${cardId}/simulate`).set(bearer(token)).send({ amount: 100_000 });

  describe('POST /cards/:id/simulate', () => {
    it("answers another user's card exactly like a missing one", async () => {
      const missing = await simulate(beto.accessToken, RANDOM_UUID).expect(404);
      const foreign = await simulate(beto.accessToken, anaCard.id).expect(404);
      const foreignArchived = await simulate(beto.accessToken, anaArchived.id).expect(404);

      expect(missing.body.code).toBe('NOT_FOUND');
      expect(foreign.body).toEqual(missing.body);
      expect(foreignArchived.body).toEqual(missing.body);
    });

    it('works for the owner', async () => {
      await simulate(ana.accessToken, anaCard.id).expect(200);
      await simulate(beto.accessToken, betoCard.id).expect(200);
    });
  });

  describe('GET /summary', () => {
    it('only shows the cards and figures of the user of the token', async () => {
      const anaSummary = await http()
        .get('/api/v1/summary')
        .set(bearer(ana.accessToken))
        .expect(200);
      const betoSummary = await http()
        .get('/api/v1/summary')
        .set(bearer(beto.accessToken))
        .expect(200);

      const ids = (body: { cards: Array<{ card: { id: string } }> }) =>
        body.cards.map((item) => item.card.id);
      expect(ids(anaSummary.body)).toEqual([anaCard.id]);
      expect(ids(betoSummary.body)).toEqual([betoCard.id]);
      expect(anaSummary.body.cards[0].nextPayment).toMatchObject({ amount: 850_000 });
      expect(betoSummary.body.cards[0].nextPayment).toBeNull();
      expect(JSON.stringify(betoSummary.body)).not.toContain(anaCard.id);
    });
  });
});
