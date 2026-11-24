/**
 * Spec 005 US8 — principle III: nobody reads or changes another user's recurring payments or
 * occurrences (FR-021, SC-006). Another user's resource answers exactly like a missing one.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  bearer,
  createRecurring,
  createTestApp,
  HOME_NOW,
  login,
  monthView,
  occurrenceByName,
  resetDatabase,
  signUp,
  type AuthResult,
  type MonthViewBody,
  type RecurringBody,
} from './helpers';

const RANDOM_UUID = '0b6f1c9e-5d2a-4c3b-9e8f-7a6b5c4d3e2f';

describe('Recurring payments isolation (e2e)', () => {
  let app: INestApplication;
  let ana: AuthResult;
  let beto: AuthResult;
  let anaActive: RecurringBody;
  let anaPaused: RecurringBody;
  let anaDeletedPaidId: string;
  let anaNovember: MonthViewBody;

  beforeEach(async () => {
    // Ana's deleted payment was created and paid in October, so it has paid history.
    const october = await createTestApp({}, { now: new Date('2026-10-20T15:00:00Z') });
    try {
      await resetDatabase(october);
      await signUp(october, 'ana@ejemplo.com');
      const token = (await login(october, 'ana@ejemplo.com', 'clave-segura-1')).accessToken;
      const old = await createRecurring(october, token, {
        name: 'Viejo',
        amount: 50_000,
        firstDueDate: '2026-10-10',
      });
      const view = await monthView(october, token, '2026-10');
      anaDeletedPaidId = occurrenceByName(view, 'Viejo').id;
      await request(october.getHttpServer())
        .post(`/api/v1/occurrences/${anaDeletedPaidId}/payment`)
        .set(bearer(token))
        .expect(200);
      await request(october.getHttpServer())
        .delete(`/api/v1/recurring/${old.id}`)
        .set(bearer(token))
        .expect(204);
    } finally {
      await october.close();
    }

    app = await createTestApp({}, { now: HOME_NOW });
    ana = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    beto = await signUp(app, 'beto@ejemplo.com');
    anaActive = await createRecurring(app, ana.accessToken, { name: 'Arriendo de Ana' });
    anaPaused = await createRecurring(app, ana.accessToken, {
      name: 'Gimnasio de Ana',
      amount: 120_000,
      firstDueDate: '2026-11-10',
    });
    await http()
      .post(`/api/v1/recurring/${anaPaused.id}/pause`)
      .set(bearer(ana.accessToken))
      .expect(200);
    await createRecurring(app, beto.accessToken, { name: 'Arriendo de Beto', amount: 900_000 });
    anaNovember = await monthView(app, ana.accessToken, '2026-11');
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  /** Every endpoint that takes an id, as Beto. */
  const attempts = (id: string, kind: 'payment' | 'occurrence') =>
    kind === 'payment'
      ? [
          () => http().get(`/api/v1/recurring/${id}`),
          () => http().patch(`/api/v1/recurring/${id}`).send({ amount: 1 }),
          () => http().delete(`/api/v1/recurring/${id}`),
          () => http().post(`/api/v1/recurring/${id}/pause`),
          () => http().post(`/api/v1/recurring/${id}/resume`),
        ]
      : [
          () => http().get(`/api/v1/occurrences/${id}`),
          () => http().post(`/api/v1/occurrences/${id}/payment`).send({}),
          () => http().delete(`/api/v1/occurrences/${id}/payment`),
        ];

  async function expectSameAsMissing(id: string, kind: 'payment' | 'occurrence') {
    const missing = attempts(RANDOM_UUID, kind);
    const foreign = attempts(id, kind);
    for (const [index, call] of foreign.entries()) {
      const expected = await missing[index]!().set(bearer(beto.accessToken)).expect(404);
      const response = await call().set(bearer(beto.accessToken)).expect(404);
      expect(response.body).toEqual(expected.body);
    }
  }

  it("answers another user's payments exactly like missing ones", async () => {
    await expectSameAsMissing(anaActive.id, 'payment');
    await expectSameAsMissing(anaPaused.id, 'payment');
  });

  it("answers another user's occurrences exactly like missing ones", async () => {
    await expectSameAsMissing(occurrenceByName(anaNovember, 'Arriendo de Ana').id, 'occurrence');
    await expectSameAsMissing(occurrenceByName(anaNovember, 'Gimnasio de Ana').id, 'occurrence');
    await expectSameAsMissing(anaDeletedPaidId, 'occurrence');
  });

  it("shows nothing of another user's payments in lists, months and summary", async () => {
    const list = await http().get('/api/v1/recurring').set(bearer(beto.accessToken)).expect(200);
    expect(list.body.map((item: RecurringBody) => item.name)).toEqual(['Arriendo de Beto']);

    for (const month of ['2026-11', '2026-12']) {
      const view = await monthView(app, beto.accessToken, month);
      expect(view.items.map((item) => item.name)).toEqual(['Arriendo de Beto']);
    }
    // Ana's October history does not widen Beto's bounds.
    await http()
      .get('/api/v1/recurring/occurrences')
      .query({ month: '2026-10' })
      .set(bearer(beto.accessToken))
      .expect(400);

    const summary = await http().get('/api/v1/summary').set(bearer(beto.accessToken)).expect(200);
    expect(summary.body.recurring.items.map((item: { name: string }) => item.name)).toEqual([
      'Arriendo de Beto',
    ]);
  });

  it("leaves Ana's data unchanged after Beto's attempts", async () => {
    await expectSameAsMissing(anaActive.id, 'payment');
    await expectSameAsMissing(occurrenceByName(anaNovember, 'Arriendo de Ana').id, 'occurrence');

    const detail = await http()
      .get(`/api/v1/recurring/${anaActive.id}`)
      .set(bearer(ana.accessToken))
      .expect(200);
    expect(detail.body).toEqual(anaActive);
    expect(await monthView(app, ana.accessToken, '2026-11')).toEqual(anaNovember);
  });
});
