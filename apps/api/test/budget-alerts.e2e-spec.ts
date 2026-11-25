/**
 * Spec 006 — budget alerts (US2; FR-008 – FR-012, SC-001, SC-005, SC-006; research.md R2, R3).
 * Clock at ALERTS_NOW (today 2026-11-25 in Bogotá): the open cycle of "Visa principal" (cutoff 8,
 * due 25, budget $2.000.000) cuts on 2026-12-08.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakePushClient } from './fake-push-client';
import {
  ALERTS_NOW,
  bearer,
  createCard,
  createPurchase,
  createTestApp,
  drainBackground,
  MutableClock,
  pushToken,
  registerDevice,
  resetDatabase,
  signUp,
  type CardBody,
} from './helpers';

const PHONE = pushToken('ana-phone');

describe('Budget alerts (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let card: CardBody;
  const push = new FakePushClient();
  const clock = new MutableClock(ALERTS_NOW);

  beforeEach(async () => {
    push.reset();
    clock.set(ALERTS_NOW);
    app = await createTestApp({}, { clock, push });
    await resetDatabase(app);
    token = (await signUp(app, 'ana@ejemplo.com')).accessToken;
    await registerDevice(app, token, PHONE);
    card = await createCard(app, token);
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);

  /** Registers a purchase today at 1 installment and waits for the alert work. */
  async function buy(amount: number, extra: Record<string, unknown> = {}) {
    const purchase = await createPurchase(app, token, card.id, {
      amount,
      purchaseDate: '2026-11-25',
      ...extra,
    });
    await drainBackground(app);
    return purchase;
  }

  const bodies = () => push.sent.map((message) => message.body);
  const dispatches = () =>
    prisma().notificationDispatch.findMany({
      where: { kind: 'budget_alert' },
      orderBy: [{ referenceDate: 'asc' }, { threshold: 'asc' }],
    });

  it('crossing 70% and 90% with one purchase sends one alert of the 90% (spec criterion)', async () => {
    await buy(1_300_000);
    expect(push.sent).toEqual([]);

    await buy(600_000);
    expect(push.sent).toHaveLength(1);
    const [message] = push.sent;
    expect(message).toMatchObject({
      to: PHONE,
      title: 'Visa principal',
      body: 'Llevas el 95% del tope de este ciclo.',
      sound: 'default',
      channelId: 'default',
    });
    expect(message?.data.target).toEqual({ type: 'card', id: card.id });
    expect(JSON.stringify(message?.data)).not.toContain(
      (await prisma().user.findFirstOrThrow()).id,
    );

    const keys = await dispatches();
    expect(
      keys.map((key) => [key.threshold, key.referenceDate.toISOString().slice(0, 10)]),
    ).toEqual([
      [70, '2026-12-08'],
      [90, '2026-12-08'],
    ]);
    const notifications = await prisma().notification.findMany();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      kind: 'budget_alert',
      title: 'Visa principal',
      body: 'Llevas el 95% del tope de este ciclo.',
      targetType: 'card',
      targetId: card.id,
    });
    expect(message?.data.notificationId).toBe(notifications[0]?.id);
    expect(keys.find((key) => key.threshold === 90)?.notificationId).toBe(notifications[0]?.id);
    expect(keys.find((key) => key.threshold === 70)?.notificationId).toBeNull();
  });

  it('passing 100% sends "Superaste el tope" once; more purchases send nothing', async () => {
    await buy(1_300_000);
    await buy(600_000);
    await buy(140_000);
    expect(bodies()).toEqual([
      'Llevas el 95% del tope de este ciclo.',
      'Superaste el tope de este ciclo (102%).',
    ]);
    await buy(100_000);
    await buy(500_000);
    expect(push.sent).toHaveLength(2);
  });

  it('a threshold is notified once per cycle even if the usage goes down and up again', async () => {
    await buy(1_200_000);
    const extra = await buy(300_000);
    expect(bodies()).toEqual(['Llevas el 75% del tope de este ciclo.']);

    await http().delete(`/api/v1/purchases/${extra.id}`).set(bearer(token)).expect(204);
    await drainBackground(app);
    await buy(240_000);
    expect(push.sent).toHaveLength(1);
  });

  it('editing a purchase that crosses a threshold alerts', async () => {
    const purchase = await buy(1_300_000);
    await http()
      .patch(`/api/v1/purchases/${purchase.id}`)
      .set(bearer(token))
      .send({ amount: 1_600_000 })
      .expect(200);
    await drainBackground(app);
    expect(bodies()).toEqual(['Llevas el 80% del tope de este ciclo.']);

    await http()
      .patch(`/api/v1/purchases/${purchase.id}`)
      .set(bearer(token))
      .send({ concept: 'Otro concepto' })
      .expect(200);
    await drainBackground(app);
    expect(push.sent).toHaveLength(1);
  });

  it('the next cycle starts again', async () => {
    await buy(1_500_000);
    clock.set('2026-12-10T15:00:00Z');
    await createPurchase(app, token, card.id, { amount: 1_500_000, purchaseDate: '2026-12-10' });
    await drainBackground(app);

    expect(bodies()).toEqual([
      'Llevas el 75% del tope de este ciclo.',
      'Llevas el 75% del tope de este ciclo.',
    ]);
    const keys = await dispatches();
    expect(keys.map((key) => key.referenceDate.toISOString().slice(0, 10))).toEqual([
      '2026-12-08',
      '2027-01-08',
    ]);
  });

  it('a purchase whose installments fall in closed statements sends nothing', async () => {
    await buy(1_900_000, { purchaseDate: '2026-10-01' });
    expect(push.sent).toEqual([]);
    expect(await dispatches()).toEqual([]);
  });

  it('only the installment of the open statement counts', async () => {
    await buy(1_300_000);
    await buy(1_200_000, { installmentCount: 6 });
    expect(bodies()).toEqual(['Llevas el 75% del tope de este ciclo.']);
  });

  it('with Expo down the purchase still answers 201 and the alert is in the history', async () => {
    push.failSend();
    const purchase = await createPurchase(app, token, card.id, {
      amount: 1_500_000,
      purchaseDate: '2026-11-25',
    });
    expect(purchase.amount).toBe(1_500_000);
    await drainBackground(app);
    expect(push.sent).toEqual([]);
    expect(await prisma().notification.count()).toBe(1);
  });

  it('without devices nothing is sent and the alert is in the history', async () => {
    await http().delete('/api/v1/devices/current').set(bearer(token)).expect(204);
    await buy(1_500_000);
    expect(push.sent).toEqual([]);
    expect(await prisma().notification.count()).toBe(1);
  });

  it('an archived card cannot receive purchases, so it never alerts', async () => {
    await http().post(`/api/v1/cards/${card.id}/archive`).set(bearer(token)).expect(200);
    await http()
      .post(`/api/v1/cards/${card.id}/purchases`)
      .set(bearer(token))
      .send({ amount: 1_500_000, concept: 'Mercado', purchaseDate: '2026-11-25' })
      .expect(409);
    await drainBackground(app);
    expect(push.sent).toEqual([]);
  });

  it('changing the budget alone sends nothing (FR-011)', async () => {
    await buy(1_300_000);
    await http()
      .patch(`/api/v1/cards/${card.id}`)
      .set(bearer(token))
      .send({ cycleBudget: 1_000_000 })
      .expect(200);
    await drainBackground(app);
    expect(push.sent).toEqual([]);
    expect(await dispatches()).toEqual([]);
  });

  it('archiving and restoring a card at 85% sends nothing new (FR-011)', async () => {
    await buy(1_700_000);
    expect(bodies()).toEqual(['Llevas el 85% del tope de este ciclo.']);
    await http().post(`/api/v1/cards/${card.id}/archive`).set(bearer(token)).expect(200);
    await http().post(`/api/v1/cards/${card.id}/restore`).set(bearer(token)).expect(200);
    await drainBackground(app);
    expect(push.sent).toHaveLength(1);
    expect((await dispatches()).map((key) => key.threshold)).toEqual([70]);
  });
});
