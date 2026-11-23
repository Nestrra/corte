/** Spec 002 — /api/v1/cards (US2–US6; contracts/cards.openapi.yaml, contracts/errors.md). */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createCard,
  createTestApp,
  createUser,
  FIXED_NOW,
  login,
  resetDatabase,
  VALID_CARD,
  type CardBody,
} from './helpers';

const RANDOM_UUID = '0b6f1c9e-5d2a-4c3b-9e8f-7a6b5c4d3e2f';

describe('Cards (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeEach(async () => {
    app = await createTestApp({}, { now: FIXED_NOW });
    prisma = app.get(PrismaService);
    await resetDatabase(app);
    await createUser(app, { name: 'Ana', email: 'ana@ejemplo.com', password: 'clave-segura-1' });
    token = (await login(app, 'ana@ejemplo.com', 'clave-segura-1')).accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const post = (body: unknown) =>
    http()
      .post('/api/v1/cards')
      .set(bearer(token))
      .send(body as object);

  it('resetDatabase also removes cards (cascade from users)', async () => {
    await createCard(app, token);
    await resetDatabase(app);
    expect(await prisma.card.count()).toBe(0);
  });

  describe('POST /cards (US2)', () => {
    it('creates a card with trimmed name, default reminders and no owner in the body', async () => {
      const response = await post({ ...VALID_CARD, name: '  Visa principal  ' }).expect(201);
      expect(response.body).toMatchObject({
        name: 'Visa principal',
        color: 'verde',
        last4: '4821',
        cutoffDay: 8,
        dueDay: 25,
        creditLimit: 5_000_000,
        cycleBudget: 2_000_000,
        availableCredit: 5_000_000,
        remindCutoffDays: 2,
        remindDueDays: 3,
        archivedAt: null,
      });
      expect(response.body).not.toHaveProperty('userId');
      expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('accepts custom reminders, the maximum amount and a budget equal to the limit', async () => {
      const response = await post({
        ...VALID_CARD,
        creditLimit: 9_999_999_999,
        cycleBudget: 9_999_999_999,
        remindCutoffDays: 0,
        remindDueDays: 15,
      }).expect(201);
      expect(response.body.creditLimit).toBe(9_999_999_999);
      expect(response.body.remindCutoffDays).toBe(0);
      expect(response.body.remindDueDays).toBe(15);
    });

    it.each([
      ['omitted', undefined],
      ['null', null],
    ])('stores no last 4 digits when %s', async (_label, last4) => {
      const body: Record<string, unknown> = { ...VALID_CARD, last4 };
      if (last4 === undefined) delete body.last4;
      const response = await post(body).expect(201);
      expect(response.body.last4).toBeNull();
    });

    it.each(['negro', 'morado', 'amarillo', 'naranja', 'verde', 'marron'])(
      'accepts the card color %s',
      async (color) => {
        const response = await post({ ...VALID_CARD, color }).expect(201);
        expect(response.body.color).toBe(color);
      },
    );

    it.each([
      ['name', { name: '   ' }, 'REQUIRED'],
      ['name', { name: 'a'.repeat(41) }, 'TOO_LONG'],
      ['color', { color: 'rojo' }, 'INVALID'],
      // Keys removed by the gradient colors migration are no longer accepted.
      ['color', { color: 'petroleo' }, 'INVALID'],
      ['color', { color: 'indigo' }, 'INVALID'],
      ['last4', { last4: '48a1' }, 'INVALID_FORMAT'],
      ['last4', { last4: '482' }, 'INVALID_FORMAT'],
      ['cutoffDay', { cutoffDay: 0 }, 'OUT_OF_RANGE'],
      ['cutoffDay', { cutoffDay: 32 }, 'OUT_OF_RANGE'],
      ['dueDay', { dueDay: 8.5 }, 'OUT_OF_RANGE'],
      ['dueDay', { dueDay: '25' }, 'OUT_OF_RANGE'],
      ['creditLimit', { creditLimit: 0 }, 'OUT_OF_RANGE'],
      ['creditLimit', { creditLimit: 10_000_000_000 }, 'OUT_OF_RANGE'],
      ['cycleBudget', { cycleBudget: -1 }, 'OUT_OF_RANGE'],
      ['cycleBudget', { cycleBudget: 5_000_001 }, 'EXCEEDS_CREDIT_LIMIT'],
      ['remindCutoffDays', { remindCutoffDays: 16 }, 'OUT_OF_RANGE'],
      ['remindDueDays', { remindDueDays: -1 }, 'OUT_OF_RANGE'],
    ])('rejects an invalid %s (%j)', async (field, overrides, code) => {
      const response = await post({ ...VALID_CARD, ...overrides }).expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.errors).toContainEqual({ field, code });
      expect(await prisma.card.count()).toBe(0);
    });

    it('reports only the invalid limit, not a budget comparison against it', async () => {
      const response = await post({ ...VALID_CARD, creditLimit: 0 }).expect(400);
      expect(response.body.errors).toEqual([{ field: 'creditLimit', code: 'OUT_OF_RANGE' }]);
    });

    it('reports missing required fields', async () => {
      const response = await post({}).expect(400);
      const fields = (response.body.errors as { field: string }[]).map((e) => e.field).sort();
      expect(fields).toEqual(
        ['color', 'creditLimit', 'cutoffDay', 'cycleBudget', 'dueDay', 'name'].sort(),
      );
    });

    it('rejects unknown fields', async () => {
      const response = await post({ ...VALID_CARD, extra: 1 }).expect(400);
      expect(response.body.errors).toContainEqual({ field: '(body)', code: 'UNKNOWN_FIELD' });
    });

    it('requires a session', async () => {
      await http().post('/api/v1/cards').send(VALID_CARD).expect(401);
    });

    it('is blocked while a temporary password is pending', async () => {
      await createUser(app, {
        email: 'temporal@ejemplo.com',
        password: 'temporal-123',
        mustChangePassword: true,
      });
      const pending = (await login(app, 'temporal@ejemplo.com', 'temporal-123')).accessToken;
      const response = await http()
        .post('/api/v1/cards')
        .set(bearer(pending))
        .send(VALID_CARD)
        .expect(403);
      expect(response.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });
  });

  describe('GET /cards (US3)', () => {
    it('is empty for a new user', async () => {
      const response = await http().get('/api/v1/cards').set(bearer(token)).expect(200);
      expect(response.body).toEqual([]);
    });

    it('lists active cards in creation order and leaves archived ones out', async () => {
      const first = await createCard(app, token, { name: 'Primera' });
      const second = await createCard(app, token, { name: 'Segunda' });
      const third = await createCard(app, token, { name: 'Tercera' });
      await prisma.card.update({ where: { id: second.id }, data: { archivedAt: new Date() } });

      const response = await http().get('/api/v1/cards').set(bearer(token)).expect(200);
      expect((response.body as CardBody[]).map((c) => c.id)).toEqual([first.id, third.id]);

      const explicit = await http()
        .get('/api/v1/cards?archived=false')
        .set(bearer(token))
        .expect(200);
      expect(explicit.body).toEqual(response.body);
    });

    it('rejects an invalid archived filter', async () => {
      const response = await http()
        .get('/api/v1/cards?archived=maybe')
        .set(bearer(token))
        .expect(400);
      expect(response.body.errors).toContainEqual({ field: 'archived', code: 'INVALID' });
    });
  });

  describe('GET /cards/:id (US4)', () => {
    it('returns the card with its cycle in Bogotá (fixed instant 2026-11-22T02:30Z)', async () => {
      const card = await createCard(app, token);
      const response = await http().get(`/api/v1/cards/${card.id}`).set(bearer(token)).expect(200);
      expect(response.body).toMatchObject({ ...card, updatedAt: card.updatedAt });
      expect(response.body.cycle).toEqual({
        today: '2026-11-21',
        nextCutoff: '2026-12-08',
        nextCutoffDue: '2026-12-25',
        nextDue: '2026-11-25',
      });
    });

    it('takes today as the cutoff when it is cutoff day (cutoff 21, due 5)', async () => {
      const card = await createCard(app, token, { cutoffDay: 21, dueDay: 5 });
      const response = await http().get(`/api/v1/cards/${card.id}`).set(bearer(token)).expect(200);
      expect(response.body.cycle).toEqual({
        today: '2026-11-21',
        nextCutoff: '2026-11-21',
        nextCutoffDue: '2026-12-05',
        nextDue: '2026-12-05',
      });
    });

    it("uses the user's time zone: in Madrid it is already November 22 (spec US4 scenario 3)", async () => {
      await prisma.user.update({
        where: { email: 'ana@ejemplo.com' },
        data: { timezone: 'Europe/Madrid' },
      });
      const card = await createCard(app, token, { cutoffDay: 21, dueDay: 5 });
      const response = await http().get(`/api/v1/cards/${card.id}`).set(bearer(token)).expect(200);
      expect(response.body.cycle).toEqual({
        today: '2026-11-22',
        nextCutoff: '2026-12-21',
        nextCutoffDue: '2027-01-05',
        nextDue: '2026-12-05',
      });
    });

    it('reads archived cards too', async () => {
      const card = await createCard(app, token);
      await prisma.card.update({ where: { id: card.id }, data: { archivedAt: new Date() } });
      const response = await http().get(`/api/v1/cards/${card.id}`).set(bearer(token)).expect(200);
      expect(response.body.archivedAt).not.toBeNull();
      expect(response.body.cycle.nextCutoff).toBe('2026-12-08');
    });

    it('answers 404 with the same body for a missing id and a malformed one', async () => {
      const missing = await http()
        .get(`/api/v1/cards/${RANDOM_UUID}`)
        .set(bearer(token))
        .expect(404);
      const malformed = await http().get('/api/v1/cards/no-es-uuid').set(bearer(token)).expect(404);
      expect(missing.body).toEqual({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Card not found',
      });
      expect(malformed.body).toEqual(missing.body);
    });
  });

  describe('PATCH /cards/:id (US5)', () => {
    const patch = (id: string, body: unknown) =>
      http()
        .patch(`/api/v1/cards/${id}`)
        .set(bearer(token))
        .send(body as object);

    it('updates only the fields sent and the cycle follows the new cutoff day', async () => {
      const card = await createCard(app, token);
      const response = await patch(card.id, { cutoffDay: 15 }).expect(200);
      expect(response.body).toMatchObject({ ...VALID_CARD, cutoffDay: 15 });

      const detail = await http().get(`/api/v1/cards/${card.id}`).set(bearer(token)).expect(200);
      expect(detail.body.cycle.nextCutoff).toBe('2026-12-15');
    });

    it('updates every editable field and trims the name', async () => {
      const card = await createCard(app, token);
      const response = await patch(card.id, {
        name: ' Mastercard ',
        color: 'amarillo',
        last4: '9012',
        cutoffDay: 30,
        dueDay: 15,
        creditLimit: 8_000_000,
        cycleBudget: 3_000_000,
        remindCutoffDays: 1,
        remindDueDays: 5,
      }).expect(200);
      expect(response.body).toMatchObject({
        name: 'Mastercard',
        color: 'amarillo',
        last4: '9012',
        cutoffDay: 30,
        dueDay: 15,
        creditLimit: 8_000_000,
        cycleBudget: 3_000_000,
        availableCredit: 8_000_000,
        remindCutoffDays: 1,
        remindDueDays: 5,
      });
    });

    it('clears the last 4 digits with null', async () => {
      const card = await createCard(app, token);
      const response = await patch(card.id, { last4: null }).expect(200);
      expect(response.body.last4).toBeNull();
    });

    it('checks the budget against the stored credit limit', async () => {
      const card = await createCard(app, token);
      const response = await patch(card.id, { cycleBudget: 9_000_000 }).expect(400);
      expect(response.body.errors).toEqual([
        { field: 'cycleBudget', code: 'EXCEEDS_CREDIT_LIMIT' },
      ]);
    });

    it('checks the stored budget against a lower credit limit', async () => {
      const card = await createCard(app, token);
      const response = await patch(card.id, { creditLimit: 1_000_000 }).expect(400);
      expect(response.body.errors).toEqual([
        { field: 'cycleBudget', code: 'EXCEEDS_CREDIT_LIMIT' },
      ]);
    });

    it('accepts a lower limit together with a lower budget', async () => {
      const card = await createCard(app, token);
      const response = await patch(card.id, {
        creditLimit: 1_000_000,
        cycleBudget: 500_000,
      }).expect(200);
      expect(response.body.creditLimit).toBe(1_000_000);
    });

    it('applies the same validations as POST and changes nothing on error', async () => {
      const card = await createCard(app, token);
      const response = await patch(card.id, { dueDay: 32, name: '' }).expect(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          { field: 'dueDay', code: 'OUT_OF_RANGE' },
          { field: 'name', code: 'REQUIRED' },
        ]),
      );
      const stored = await prisma.card.findUniqueOrThrow({ where: { id: card.id } });
      expect(stored.dueDay).toBe(25);
    });

    it('rejects an empty body and unknown fields', async () => {
      const card = await createCard(app, token);
      const empty = await patch(card.id, {}).expect(400);
      expect(empty.body.errors).toEqual([{ field: '(body)', code: 'REQUIRED' }]);
      const unknown = await patch(card.id, { archivedAt: null }).expect(400);
      expect(unknown.body.errors).toContainEqual({ field: '(body)', code: 'UNKNOWN_FIELD' });
    });

    it('refuses to edit an archived card', async () => {
      const card = await createCard(app, token);
      await http().post(`/api/v1/cards/${card.id}/archive`).set(bearer(token)).expect(200);
      const response = await patch(card.id, { cutoffDay: 15 }).expect(409);
      expect(response.body.code).toBe('CARD_ARCHIVED');
      const stored = await prisma.card.findUniqueOrThrow({ where: { id: card.id } });
      expect(stored.cutoffDay).toBe(8);
    });

    it('answers 404 for missing ids', async () => {
      await patch(RANDOM_UUID, { cutoffDay: 15 }).expect(404);
      await patch('no-es-uuid', { cutoffDay: 15 }).expect(404);
    });
  });

  describe('archive and restore (US6)', () => {
    const action = (id: string, name: 'archive' | 'restore') =>
      http().post(`/api/v1/cards/${id}/${name}`).set(bearer(token));

    it('archives a card: it leaves the active list and joins the archived one', async () => {
      const card = await createCard(app, token);
      const response = await action(card.id, 'archive').expect(200);
      expect(response.body.archivedAt).toBe(FIXED_NOW.toISOString());

      const active = await http().get('/api/v1/cards').set(bearer(token)).expect(200);
      expect(active.body).toEqual([]);
      const archived = await http()
        .get('/api/v1/cards?archived=true')
        .set(bearer(token))
        .expect(200);
      expect((archived.body as CardBody[]).map((c) => c.id)).toEqual([card.id]);
    });

    it('is idempotent', async () => {
      const card = await createCard(app, token);
      const first = await action(card.id, 'archive').expect(200);
      const second = await action(card.id, 'archive').expect(200);
      expect(second.body).toEqual(first.body);

      const restored = await action(card.id, 'restore').expect(200);
      const again = await action(card.id, 'restore').expect(200);
      expect(again.body).toEqual(restored.body);
    });

    it('restores a card with all its data and its place in the creation order', async () => {
      const first = await createCard(app, token, { name: 'Primera', last4: null });
      const second = await createCard(app, token, { name: 'Segunda' });
      await action(first.id, 'archive').expect(200);
      const restored = await action(first.id, 'restore').expect(200);
      expect(restored.body).toEqual({ ...first, updatedAt: expect.any(String) });

      const active = await http().get('/api/v1/cards').set(bearer(token)).expect(200);
      expect((active.body as CardBody[]).map((c) => c.id)).toEqual([first.id, second.id]);
    });

    it('answers 404 for missing ids', async () => {
      await action(RANDOM_UUID, 'archive').expect(404);
      await action('no-es-uuid', 'restore').expect(404);
    });
  });
});
