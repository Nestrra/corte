---

description: "Task list for spec 006 — Alertas y recordatorios"
---

# Tasks: Alertas y recordatorios

**Input**: Design documents from `/specs/006-alerts-reminders/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. Las piden:
- la constitución: pruebas primero en dominio y API (principio II), e2e de cada endpoint contra
  PostgreSQL real y aislamiento entre usuarios (principio III);
- la spec: pruebas del dominio con N = 0, días que no existen en el mes, cambio de año y el ajuste
  al día siguiente al corte (FR-026); pruebas con dos usuarios para cada operación (FR-027);
  cobertura del dominio ≥ 95% (SC-011);
- el usuario: e2e con un cliente de Expo falso de umbrales, horas, no repetición y aislamiento.

En cada fase las pruebas se escriben antes de implementar y deben fallar primero. La app se
valida a mano (quickstart.md B9) en un development build.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo (plan.md → Project Structure): `packages/domain/`, `apps/api/`, `apps/mobile/`.

Las e2e nuevas arrancan con:
- `JOBS_ENABLED=false`;
- `FakePushClient` en lugar de `PUSH_CLIENT`;
- un reloj mutable (`clock.set(instant)`).

Instantes de referencia:
- `ALERTS_NOW` = `2026-11-25T15:00:00Z`, es decir **hoy = 2026-11-25** en America/Bogota;
- los recordatorios mueven el reloj a `2026-12-06T12:00Z` (7:00 en Bogotá) y similares
  (quickstart.md B4).

Después de cada cambio del dominio se corre `pnpm --filter @corte/domain build` antes del
typecheck del API. Después de una alerta, las e2e esperan con `await
app.get(BackgroundTasks).drain()`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencias, variables de entorno, códigos de error y ayudas de prueba.

- [ ] T001 Add `expo-server-sdk@^8` and `@nestjs/schedule@^12` to `apps/api/package.json` with `pnpm --filter api add expo-server-sdk@^8 @nestjs/schedule@^12` (research.md R16); confirm `pnpm --filter api typecheck` and `pnpm --filter api test` still pass and that the lockfile only adds these two packages and their dependencies
- [ ] T002 [P] Add `JOBS_ENABLED` (`"true"`/`"false"` → boolean, default `true`) and optional `EXPO_ACCESS_TOKEN` to `apps/api/src/config/env.schema.ts` with unit cases in `apps/api/src/config/env.schema.spec.ts` (invalid `JOBS_ENABLED` names the variable without its value); add both, commented, to `apps/api/.env.example` (research.md R17)
- [ ] T003 [P] Add `DEVICE_NOT_REGISTERED` (409), `TEST_RATE_LIMITED` (429, with `retryAfterSeconds` in the body), `PUSH_FAILED` (502) and the field code `INVALID_PUSH_TOKEN` to `apps/api/src/common/errors.ts`, following the existing `AppErrors` pattern; add their Spanish texts to `apps/mobile/src/api/errors.ts` (contracts/screens.md → Prueba)
- [ ] T004 [P] Create `apps/api/test/fake-push-client.ts`: `FakePushClient` implements `PushClient` (research.md R5) and records `sent: PushMessage[]`. It returns one `ok` ticket per message with a generated id, and lets a test program per-token ticket errors (`DeviceNotRegistered`, other), receipt errors and a thrown error for the whole call. Add `reset()`
- [ ] T005 Extend `apps/api/test/helpers.ts` (depends on T004):
  - `createTestApp` options `clock` (a `MutableClock` with `set(date)` and `now()`) and `push` (a `FakePushClient`, overriding `PUSH_CLIENT`);
  - always `JOBS_ENABLED: 'false'` in the e2e env;
  - `ALERTS_NOW`;
  - helpers `registerDevice(app, token, pushToken, platform = 'ios')` (POST `/devices`) and `drainBackground(app)`;
  - confirm that `resetDatabase` empties the new tables through the `users` cascade and also truncates `push_tickets`, which has no user FK.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: reglas puras, tablas, envío y registro de dispositivos en el API, y piezas comunes de
la app.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests (write first, must FAIL) ⚠️

- [ ] T006 [P] Add `addDays` and `maxIsoDate` tests to `packages/domain/src/calendar.test.ts`: 2026-12-08 − 2 → 2026-12-06; 2027-01-01 − 2 → 2026-12-30; 2028-03-01 − 1 → 2028-02-29; + 0 is the same date; invalid date throws
- [ ] T007 [P] Write `packages/domain/src/notifications.test.ts`, `describe('budgetAlert')` (research.md R1, R2):
  - 65 → 95 with none notified → `{ alert: 90, mark: [70, 90] }` (spec criterion);
  - 95 → 102 with [70, 90] → `{ alert: 100, mark: [100] }`;
  - 50 → 110 → `{ alert: 100, mark: [70, 90, 100] }`;
  - 69 → 70 → alert 70; 60 → 69 → none;
  - 72 with 70 already notified → none;
  - before ≥ threshold not notified (75 → 80) → none (not crossed);
  - after < before → none.
- [ ] T008 [P] Add `describe('reminder dates')` to `packages/domain/src/notifications.test.ts`:
  - `cutoffReminderDate('2026-12-08', 2)` → 2026-12-06, with N = 0 → the same day;
  - a card with cutoff day 31 in February 2027 → cutoff 2027-02-28, reminder 2027-02-26;
  - cutoff day 31 in a 30-day month (November 2026) → cutoff 2026-11-30, reminder with N 2 on 2026-11-28;
  - cutoff day 30 in February 2028 (leap) → cutoff 2028-02-29, reminder with N 2 on 2028-02-27; cutoff day 29 in February 2027 → 2027-02-28;
  - `paymentReminderDate('2026-12-08', '2026-12-25', 3)` → 2026-12-22;
  - cutoff 2026-12-20, due 2026-12-22 and N = 3 → 2026-12-21 (day after the cutoff);
  - `recurringReminderDate('2027-03-10', 15)` → 2027-02-23;
  - 2027-01-01 − 2 → 2026-12-30.
- [ ] T009 [P] Add `describe('remindersFor')` and `describe('texts')` to `packages/domain/src/notifications.test.ts`:
  - **`remindersFor`**:
    - on 2026-12-06 a card with cutoff 8, N 2 and `openAmount` 1.900.000 → one `cutoff_reminder` with `referenceDate` 2026-12-08, title "Visa principal" and body "El corte es en 2 días (8 dic). Llevas $1.900.000 en este ciclo."; on 2026-12-07 → none; `openAmount` 0 → none;
    - a statement with due 2026-12-25, N 3, total 1.950.000 on 2026-12-22 → "Paga $1.950.000 hasta el 25 dic (faltan 3 días)."; total 0 → none; today after `dueDate` → none;
    - an occurrence "Celular" 65.000 due 2026-12-28 with N 2 on 2026-12-26 → "$65.000 vence el 28 dic (en 2 días).";
    - N = 1 and N = 0 phrasings ("mañana", "hoy");
  - **`dailyDigest`**: 0 → null; 1 → that reminder with its target; 2 → "Tienes 2 recordatorios hoy" with both lines and target `history`; 5 → 3 lines plus "y 2 más"; order payments, cutoffs, recurring;
  - **`budgetAlertContent`**: "Llevas el 95% del tope de este ciclo." and "Superaste el tope de este ciclo (102%).";
  - **`formatCopText`**: 0 → "$0", 1950000 → "$1.950.000", 9999999999 → "$9.999.999.999";
  - **`shortDateEs`**: "8 dic", "1 ene";
  - **`isDailyDispatchDue`**: '06:59' → false, '07:00' → true, '23:59' → true.

  All texts are exactly those of contracts/push-messages.md.
- [ ] T010 [P] Add unit tests for `localDateTimeIn(timezone, now)` to `apps/api/src/common/today.spec.ts`: `2026-12-06T12:00:00Z` in America/Bogota → `{ date: '2026-12-06', time: '07:00' }`; 11:59Z → '06:59'; Europe/Madrid → '13:00'; a time zone with a half hour (Asia/Kolkata) → '17:30'

### Implementation

- [ ] T011 Add `addDays` and `maxIsoDate` to `packages/domain/src/calendar.ts` (reusing `parseIsoDate`, `daysInMonth` and `toIsoDate`) and make T006 pass
- [ ] T012 Implement `packages/domain/src/notifications.ts` per research.md R1, R2 and contracts/push-messages.md:
  - `BUDGET_THRESHOLDS`, `budgetAlert`;
  - `cutoffReminderDate`, `paymentReminderDate`, `recurringReminderDate`;
  - `remindersFor` (types `Reminder` and `PushContent` of data-model.md → Estructuras del dominio), `dailyDigest`, `budgetAlertContent`, `TEST_PUSH_CONTENT`;
  - `formatCopText`, `shortDateEs`, `daysPhrase`, `isDailyDispatchDue`;
  - `DAILY_REMINDER_TIME = '07:00'`, `HISTORY_DAYS = 30`, `DISPATCH_RETENTION_DAYS = 90`, `DEFAULT_RECURRING_REMIND_DAYS = 2`;
  - texts no longer than data-model.md → `Notification.title` and `Notification.body`.

  Export from `packages/domain/src/index.ts`; make T007–T009 pass; run `pnpm --filter @corte/domain test:cov` (≥ 95%) and `pnpm --filter @corte/domain build`.
- [ ] T013 Add `localDateTimeIn(timezone, now)` next to `todayInTimeZone` in `apps/api/src/common/today.ts` (Intl `hourCycle: 'h23'`); make T010 pass
- [ ] T014 Extend `apps/api/prisma/schema.prisma` and generate the migration:
  - enums `DevicePlatform` (`ios`, `android` → `device_platform`) and `NotificationKind` (`budget_alert`, `cutoff_reminder`, `payment_reminder`, `recurring_reminder`, `daily_digest` → `notification_kind`);
  - models with the columns, types, cascades, unique keys and indexes of data-model.md:
    - `Device`: data-model.md → `Device.userId`, `Device.sessionId`, `Device.token`, `Device.platform`, `Device.lastSeenAt`, `Device.lastTestAt`;
    - `Notification`: data-model.md → `Notification.userId`, `Notification.kind`, `Notification.title`, `Notification.body`, `Notification.targetType`, `Notification.targetId`, `Notification.createdAt`;
    - `NotificationDispatch`: data-model.md → `NotificationDispatch.userId`, `NotificationDispatch.kind`, `NotificationDispatch.referenceId`, `NotificationDispatch.referenceDate`, `NotificationDispatch.threshold`, `NotificationDispatch.notificationId`;
    - `PushTicket`: data-model.md → `PushTicket.id`, `PushTicket.token`, `PushTicket.createdAt`;
  - `RecurringPayment.remindDays` (data-model.md → `RecurringPayment.remindDays`);
  - relations on `User`.

  Run `pnpm --filter api db:migrate --name notifications` and add by hand to the SQL:
  - the `UNIQUE NULLS NOT DISTINCT (user_id, kind, reference_id, reference_date, threshold)` of data-model.md → NotificationDispatch;
  - CHECK `threshold IN (70, 90, 100)` only when `kind = 'budget_alert'` and null otherwise;
  - CHECK `notifications.kind <> 'daily_digest'`;
  - CHECK `target_type IN ('card','statement','occurrence')`;
  - CHECK `remind_days BETWEEN 0 AND 15` with default 2.

  Run `pnpm --filter api prisma:generate`.
- [ ] T015 [P] Create `apps/api/src/common/background-tasks.ts`:
  - `BackgroundTasks` (global provider) with `track(promise, label)`, which catches and logs the error with `Logger.error`, never with tokens or amounts, and `drain()`;
  - register it in `ClockModule` or a new global `CommonModule`;
  - call `app.enableShutdownHooks()` in `apps/api/src/main.ts` and drain on `onApplicationShutdown` (research.md R3).
- [ ] T016 Create the push layer in `apps/api/src/notifications/` (research.md R5, R8; depends on T014):
  - **`push-client.ts`**: interface `PushClient` with `send` and `receipts`, types `PushMessage`, `PushTicket` and `PushReceipt`, token `PUSH_CLIENT`.
  - **`expo-push-client.ts`**: built with `new Expo({ accessToken: EXPO_ACCESS_TOKEN })`; uses `chunkPushNotifications` / `sendPushNotificationsAsync` and `chunkPushNotificationReceiptIds` / `getPushNotificationReceiptsAsync`; maps errors to `DeviceNotRegistered` or `other`.
  - **`push-sender.ts`**:
    - `activeTokens(userId)` and `sessionTokens(sessionId)`: devices whose session is active, with the condition of data-model.md → Device (`Device.sessionId` joined to `refresh_tokens.family_id`);
    - `sendToUser(userId, content)` and `sendToTokens(tokens, content)`: build the message with `channelId 'default'`, `sound 'default'` and `data { notificationId?, target }`, never the `userId`; save the `ok` tickets in `push_tickets` (data-model.md → `PushTicket.id`, `PushTicket.token`); delete the device on a `DeviceNotRegistered` ticket.
  - **`notifications.module.ts`**: provides `PUSH_CLIENT` → `ExpoPushClient` and exports `PushSender`; register it in `apps/api/src/app.module.ts`.
- [ ] T017 Write `apps/api/test/devices.e2e-spec.ts` (register part) with `ALERTS_NOW` (test first, must FAIL):
  - POST `/devices` with a valid token → 204 and one row with `user_id` and `session_id` of the token;
  - the same token again → still one row with `last_seen_at` updated;
  - `{ token: 'abc' }` → 400 `fields.token: INVALID_PUSH_TOKEN`; `platform: 'web'` → 400; unknown field → 400;
  - without auth → 401;
  - the same token posted by user B → the row now belongs to B and B's session (data-model.md → `Device.token` unique, research.md R4);
  - DELETE `/devices/current` → 204 and the session's devices gone, a second call → 204.
- [ ] T018 Implement `apps/api/src/notifications/devices.service.ts`, `devices.controller.ts` (POST `/devices` with `@HttpCode(204)` and upsert by token; DELETE `/devices/current`) and `notifications.schemas.ts` (zod: `token` with `Expo.isExpoPushToken` → `INVALID_PUSH_TOKEN`, max 255 per data-model.md → `Device.token`; `platform` per data-model.md → `Device.platform`); make T017 pass
- [ ] T019 [P] Add `apps/mobile/src/api/notifications.ts`:
  - the types of contracts/notifications.openapi.yaml (`Notification`, `NotificationKind`, `NotificationTarget`);
  - `registerDevice`, `unregisterCurrentDevice`, `getNotifications`, `sendTestNotification`;
  - `notificationKeys` (`all: ['notifications']`, `history()`).
- [ ] T020 [P] Create `apps/mobile/src/notifications/permission.ts` (research.md R13):
  - `getNotificationStatus()` → `granted | denied | undetermined`;
  - `requestNotificationPermission()`, which first creates the Android channel `default` (`AndroidImportance.HIGH`);
  - `openNotificationSettings()` with `Linking.openSettings()`.

  Add `apps/mobile/src/notifications/intro-flag.ts` (`notificationsIntroSeen` in `expo-secure-store`, independent of the user).

**Checkpoint**: domain green with coverage ≥ 95%; migration applied in `corte_dev` and `corte_test`; devices e2e green; API and app typecheck green.

---

## Phase 3: User Story 1 - Activar las notificaciones (Priority: P1) 🎯 MVP

**Goal**: explicación previa, permiso, registro del dispositivo y estado en Perfil.

**Independent Test**: quickstart.md B2; en la app, B9.1 y B9.2.

- [ ] T021 [US1] Create `apps/mobile/src/notifications/registration.ts` (research.md R13):
  - `syncDevice()`: with permission granted and a session, get the token with `getExpoPushTokenAsync({ projectId: Constants.expoConfig?.extra?.eas?.projectId })` and call `registerDevice`, with `platform` from `Platform.OS`;
  - if getting the token fails, tell the two cases apart: a network or server error keeps the status "Activando…" (pending) and retries on the next open or foreground; only an error saying the device cannot receive push (no push support, as on a simulator) sets `unavailable`;
  - when the permission is `denied` and a device was registered, call `unregisterCurrentDevice`;
  - `useDeviceRegistration()`: runs `syncDevice` after sign-in, on app open and when the app returns to the foreground (reuse `use-refetch-on-app-active`), and on `addPushTokenListener`;
  - expose the status (`granted`, registered or pending, `denied`, `undetermined`, `unavailable`) through a small Zustand store `notification-status`.
- [ ] T022 [P] [US1] Implement `apps/mobile/src/components/PermissionIntro.tsx` and the route `apps/mobile/src/app/(app)/notifications-intro.tsx` per contracts/screens.md:
  - title "Activa las notificaciones" and its text;
  - "Activar notificaciones" → `requestNotificationPermission`, then `syncDevice`, then mark the flag, then `router.replace('/(tabs)/home')`;
  - "Ahora no" → mark the flag and go home.
- [ ] T023 [US1] In `apps/mobile/src/app/(app)/_layout.tsx`:
  - register `notifications-intro` (`presentation: 'modal'`, no header, gesture disabled);
  - after sign-in, registration or session restore, redirect once to it while `notificationsIntroSeen` is false (spec US1-1, US1-4, US1-8);
  - mount `useDeviceRegistration()`.
- [ ] T024 [US1] Add `apps/mobile/src/components/NotificationStatusRow.tsx` and render it in `apps/mobile/src/app/(app)/(tabs)/profile.tsx` with the states and actions of contracts/screens.md → Estado en Perfil:
  - "Activadas", "Desactivadas" + "Abrir ajustes", "Sin activar" + "Activar", "No disponibles en este dispositivo", "Activando…";
  - re-read the status when the app returns to the foreground (spec US1-5 to US1-7).
- [ ] T025 [US1] Configure the `expo-notifications` plugin in `apps/mobile/app.config.ts` (`icon: './assets/android-icon-monochrome.png'`, `color: '#4F46E5'` written in the file with a comment naming the `primary` token of `docs/design-system.md`; `app.config.ts` runs in Node and must not import `src/theme`, and this is native config, not a component, so principle IX does not apply) and bump `version` to `0.1.0` (research.md R14, README → "Versión de runtime"); confirm with `npx expo config --type prebuild` that the plugin options are there

**Checkpoint**: US1 complete: the device registers after the explanation and Profile shows the state (validated on a development build).

---

## Phase 4: User Story 2 - Alertas de tope (Priority: P1)

**Goal**: una alerta inmediata por compra con el umbral más alto cruzado, una vez por umbral y
ciclo.

**Independent Test**: quickstart.md B3; en la app, B9.4.

### Tests for User Story 2 (write first, must FAIL) ⚠️

- [ ] T026 [P] [US2] Write `apps/api/test/budget-alerts.e2e-spec.ts` with `ALERTS_NOW`, a `FakePushClient`, "Visa principal" (cutoff 8, due 25, budget 2.000.000) and a registered device:
  - **criterion**: purchases reaching 1.300.000 in the open statement (cutoff 2026-12-08), then 600.000 at 1 installment → after `drainBackground`, exactly one message "Visa principal" / "Llevas el 95% del tope de este ciclo." with `data.target` `{ type: 'card', id }` and no `userId`; dispatches for thresholds 70 and 90 with `reference_date` 2026-12-08 (data-model.md → `NotificationDispatch.threshold`, `NotificationDispatch.referenceDate`); one `notifications` row;
  - **more purchases**: another one to 102% → "Superaste el tope de este ciclo (102%)."; more purchases → nothing;
  - **once per cycle**: delete purchases to 60% and add back to 72% → nothing;
  - **edit**: a PATCH that takes 65% → 80% → the 70% alert;
  - **next cycle**: a purchase dated in the next cycle with the clock moved to 2026-12-10 → the 70% alert of cutoff 2027-01-08;
  - **outside the open statement**: a past purchase whose installments fall in closed statements → nothing;
  - **6 installments**: only the open statement's installment counts;
  - **Expo down**: `FakePushClient` throwing → POST responds 201 with the purchase and the notification row exists;
  - **no devices**: no messages and the notification row exists;
  - **archived card**: cannot receive purchases, so no alert (spec 003);
  - **card edit**: changing the budget alone → nothing;
  - **archive and restore** (FR-011): with the cycle at 85% and 90% not yet notified, archiving and then restoring the card → nothing sent and no new dispatch.

### Implementation for User Story 2

- [ ] T027 [US2] Create `apps/api/src/notifications/budget-alerts.service.ts` with `onBudgetChange(change)` (research.md R3):
  1. compute the percents with `budgetUsagePercent`;
  2. read the notified thresholds of `(card, cutoff)`;
  3. call `budgetAlert`;
  4. if there is an alert, in one transaction: `createMany({ skipDuplicates: true })` of the `mark` dispatches, then the notification for the inserted top threshold only, then link `notification_id` (data-model.md → `NotificationDispatch.notificationId`);
  5. after the commit, `PushSender.sendToUser`.

  Export it from `notifications.module.ts`.
- [ ] T028 [US2] In `apps/api/src/purchases/purchases.service.ts` `create` and `update`:
  - inside the existing transaction, after `lockOwnedCard`, read `before = totalForCutoff(card.id, nextCutoff(today, card).cutoffDate, tx)`, and after the plan writes, `after`;
  - return `{ userId, cardId, cardName, cutoffDate, cycleBudget, before, after }` with the result;
  - after the transaction resolves, call `backgroundTasks.track(budgetAlerts.onBudgetChange(change), 'budget-alert')` without awaiting it; `remove` does nothing;
  - import `NotificationsModule` in `purchases.module.ts`.

  Make T026 pass with `pnpm --filter api test:e2e -- budget-alerts`, and confirm `purchases.e2e-spec.ts` and `simulate.e2e-spec.ts` are unchanged and green.

**Checkpoint**: US2 complete: alerts on register and edit, never twice per cycle, never breaking the purchase.

---

## Phase 5: User Story 3 - Recordatorios de corte y de pago de tarjetas (Priority: P1)

**Goal**: el job envía a las 7:00 locales los recordatorios de corte y de pago de las tarjetas
activas.

**Independent Test**: quickstart.md B4.

### Tests for User Story 3 (write first, must FAIL) ⚠️

- [ ] T029 [P] [US3] Write `apps/api/test/reminders.e2e-spec.ts` (cards part) with a mutable clock and `FakePushClient`. Setup: an America/Bogota user with a device and "Visa principal" (cutoff 8, due 25, reminders 2 and 3) with 1.900.000 in the cycle that cuts on 2026-12-08. Cases, each run with `app.get(NotificationsJobs).runOnce()` at the given instant:
  - `2026-12-06T11:59Z` → nothing; `12:00Z` → "El corte es en 2 días (8 dic). Llevas $1.900.000 en este ciclo." with target `card`;
  - `2026-12-07T12:00Z` → nothing;
  - N 0 on 2026-12-08 → "El corte es hoy (8 dic)…";
  - with the clock at 2026-12-22T12:00Z and the statement total 1.950.000 → "Paga $1.950.000 hasta el 25 dic (faltan 3 días)." with target `statement`; the same statement paid on 2026-12-20 → nothing;
  - cutoff 20, due 22 and N 3 → payment reminder on 2026-12-21;
  - cutoff 31 → 2027-02-26;
  - $0 in the cycle → no cutoff reminder;
  - archived card → nothing;
  - user switched to Europe/Madrid → reminder at `2026-12-06T06:00Z` (7:00 Madrid) and not at 05:59Z.

### Implementation for User Story 3

- [ ] T030 [US3] Create `apps/api/src/notifications/reminders.service.ts` with `runForUser(user, now)` (research.md R7):
  1. compute `localDateTimeIn`; return if `!isDailyDispatchDue`;
  2. in a transaction, insert the `daily_digest` dispatch (data-model.md → `NotificationDispatch.kind`, `NotificationDispatch.referenceId` = user id, `NotificationDispatch.referenceDate` = local date) and return if it already existed;
  3. gather the active (non-archived) cards with `nextCutoff` and `openAmount` (`LedgerService.totalsForCutoffs`), and the unpaid statements with cutoff < today **of those same active cards**, with their totals (`totalsByStatement`) and the card's `remindDueDays` (FR-020);
  4. call `remindersFor` (cards only until US4);
  5. insert the dispatches with `skipDuplicates` and the notifications for the ones actually inserted;
  6. after the commit, `PushSender.sendToUser(dailyDigest(inserted))` when it is not null.
- [ ] T031 [US3] Create `apps/api/src/notifications/notifications.jobs.ts`:
  - `NotificationsJobs.runOnce()` with an in-memory `running` guard: lists the users with their time zone and calls `runForUser` for each, catching and logging per user;
  - `@Cron('0 */15 * * * *') handle()` calls `runOnce()`;
  - always provide `NotificationsJobs` in `notifications.module.ts`, so `app.get(NotificationsJobs).runOnce()` works in the e2e;
  - register `ScheduleModule.forRoot()` in `apps/api/src/app.module.ts` only when `JOBS_ENABLED` is true: without it the `@Cron` decorator is inert, so the e2e (`JOBS_ENABLED=false`) never fire the cron.

  Make T029 pass with `pnpm --filter api test:e2e -- reminders`.

**Checkpoint**: US3 complete: card reminders at 7:00 local, never for paid, empty or archived.

---

## Phase 6: User Story 5 - Recordatorios agrupados, a las 7:00 y sin repetirse (Priority: P1)

**Goal**: un push por día con todos los recordatorios, sin repeticiones ni envíos atrasados.

**Independent Test**: quickstart.md B4 (tabla y agrupado).

### Tests for User Story 5 (write first, must FAIL) ⚠️

- [ ] T032 [P] [US5] Add to `apps/api/test/reminders.e2e-spec.ts`:
  - two reminders on the same day (two cards with the cutoff two days later) → one message "Tienes 2 recordatorios hoy" with target `history` and two `notifications` rows;
  - `runOnce()` twice at 7:00 and again at 9:30 → still one message and one `daily_digest` dispatch (SC-004);
  - the server "down" at 7:00: first run at 11:00 the same day → sends; a first run the next day at 7:00 → only that day's reminders, nothing from the day before;
  - changing `remindCutoffDays` from 2 to 1 after the 2026-12-06 reminder → nothing on 2026-12-07 for the same cutoff (spec US5-5);
  - two devices of the user → the same message to both tokens and one history row each (spec US5-6);
  - two simultaneous `runOnce()` (`Promise.all`) → one message.

### Implementation for User Story 5

- [ ] T033 [US5] Adjust `reminders.service.ts` and `notifications.jobs.ts` until T032 passes, without moving rules out of the domain: the `daily_digest` dispatch is inserted before gathering, the reminder dispatches are keyed by the event date, and the `running` guard covers the concurrent runs

**Checkpoint**: US5 complete: one push a day, no repeats.

---

## Phase 7: User Story 9 - Varios dispositivos, cierre de sesión y eliminación de la cuenta (Priority: P1)

**Goal**: los avisos llegan a todos los dispositivos con sesión activa y a ninguno más.

**Independent Test**: quickstart.md B2 y B7; en la app, B9.7.

### Tests for User Story 9 (write first, must FAIL) ⚠️

- [ ] T034 [P] [US9] Add to `apps/api/test/devices.e2e-spec.ts`:
  - two sessions of the same user with one device each → a budget alert reaches both tokens;
  - POST `/auth/logout` in one → its device row is gone and the next alert reaches only the other;
  - change password → the other sessions' devices are gone and the current one stays;
  - `admin:reset-password` (`UsersService.resetPassword`) → all gone;
  - DELETE `/me` → rows gone by cascade;
  - refresh-token reuse that revokes the family → device gone;
  - an expired session (move `expires_at` back with Prisma) → not in `activeTokens` (data-model.md → Device, active device).
- [ ] T035 [P] [US9] Write `apps/api/test/push-receipts.e2e-spec.ts` with the mutable clock:
  - a ticket error `DeviceNotRegistered` → the device is deleted immediately;
  - an `ok` ticket whose receipt is `DeviceNotRegistered`: at +10 min `runOnce()` does not check it; at +16 min it deletes the device and the ticket (data-model.md → `PushTicket.createdAt`);
  - a ticket older than 24 h without a receipt → deleted;
  - devices whose session is no longer active → deleted by the cleanup.

### Implementation for User Story 9

- [ ] T036 [US9] In `apps/api/src/auth/tokens.service.ts`, make `revokeFamily(sessionId)` and `revokeAllForUser(userId, except?)` also `prisma.device.deleteMany` for the revoked sessions, in the same transaction as the token update (research.md R4); no import of `NotificationsModule`. Make T034 pass and keep `logout.e2e-spec.ts`, `change-password.e2e-spec.ts` and `admin-reset.e2e-spec.ts` green
- [ ] T037 [US9] Add to `notifications.jobs.ts` the receipts step (tickets older than 15 min → `PushClient.receipts`, delete devices with `DeviceNotRegistered`, delete checked tickets and tickets older than 24 h) and the devices cleanup (sessions no longer active); make T035 pass

**Checkpoint**: US9 complete.

---

## Phase 8: User Story 4 - Recordatorios de pagos recurrentes (Priority: P2)

**Goal**: recordatorios de las ocurrencias pendientes con días de anticipación configurables.

**Independent Test**: quickstart.md B5; en la app, B9.8.

### Tests for User Story 4 (write first, must FAIL) ⚠️

- [ ] T038 [P] [US4] Add `remindDays` cases to `apps/api/test/recurring.e2e-spec.ts`:
  - POST without it → `remindDays` 2; with 0 and 15 → stored; 16, −1 and 1.5 → 400 `fields.remindDays: OUT_OF_RANGE` (data-model.md → `RecurringPayment.remindDays`);
  - PATCH `{ remindDays: 5 }` → 200 with 5, occurrences unchanged;
  - GET list and detail include it.
- [ ] T039 [P] [US4] Add the recurring part to `apps/api/test/reminders.e2e-spec.ts`:
  - "Celular" 65.000 due 2026-12-28 with N 2, December never read → at `2026-12-26T12:00Z` "$65.000 vence el 28 dic (en 2 días)." with target `occurrence`; paid on 2026-12-24 → nothing;
  - paused in December with the December occurrence kept → reminder; January → nothing;
  - deleted → nothing;
  - annual "SOAT" 2027-03-10 with N 15 → on 2027-02-23;
  - a card reminder and a recurring reminder on the same day → grouped.

### Implementation for User Story 4

- [ ] T040 [US4] Add `remindDays` to `apps/api/src/recurring/recurring.schemas.ts` (optional, `validateReminderDays`), `recurring.service.ts` (create and update) and `recurring.mapper.ts` (`RecurringPayment.remindDays`, data-model.md → `RecurringPayment.remindDays`); make T038 pass
- [ ] T041 [US4] Expose `materializeThrough` for the job, or add `RecurringService.materializeForReminders(tx, userId, until)` that locks the user's payments and inserts the occurrences up to `until` with `duePeriods`. In `reminders.service.ts`, materialize up to today + `REMINDER_DAYS_MAX`, read the unpaid occurrences of non-deleted payments with their payment's `remind_days`, and pass them to `remindersFor`. Import `RecurringModule` in `notifications.module.ts`; make T039 pass
- [ ] T042 [P] [US4] Add `remindDays` to `apps/mobile/src/api/recurring.ts` and `apps/mobile/src/features/recurring-schema.ts` (`validateReminderDays`, default 2), the field "Recordar con anticipación" in `apps/mobile/src/components/RecurringForm.tsx` (as "Recordar corte" in `CardForm.tsx`, help "0 = el mismo día"), and "Recordatorio: N días antes" / "el mismo día" in `apps/mobile/src/app/(app)/recurring/[id]/index.tsx`; edit sends it only when changed

**Checkpoint**: US4 complete.

---

## Phase 9: User Story 7 - Historial de notificaciones (Priority: P2)

**Goal**: la campana abre las notificaciones de los últimos 30 días.

**Independent Test**: quickstart.md B6 (historial); en la app, B9.5.

### Tests for User Story 7 (write first, must FAIL) ⚠️

- [ ] T043 [P] [US7] Write `apps/api/test/notifications.e2e-spec.ts` (history part):
  - GET `/notifications` with notifications created on several days (Prisma `createdAt`) → only the last 30 days, newest first, fields of contracts/notifications.openapi.yaml `Notification`;
  - 205 rows → 200 returned;
  - a user without any → `items: []`;
  - `runOnce()` deletes notifications older than 30 days and dispatches older than 90 days (data-model.md → `Notification.createdAt`, NotificationDispatch retention), and a budget threshold stays notified after its history row is deleted.

### Implementation for User Story 7

- [ ] T044 [US7] Create `apps/api/src/notifications/notifications.service.ts` (`history(userId)`) and `notifications.controller.ts` (GET `/notifications`); add the cleanup step to `notifications.jobs.ts`; make T043 pass
- [ ] T045 [P] [US7] Implement `apps/mobile/src/components/NotificationRow.tsx` per contracts/screens.md (icon by kind, title, text up to 3 lines, date "Hoy, 7:00" / "Ayer, 15:42" / "23 nov, 7:00" with a new helper in `apps/mobile/src/features/dates.ts`, ≥ 44, accessible label as one sentence) and `apps/mobile/src/components/BellButton.tsx` (44 × 44, `notifications-outline` in `primaryStrong`, label "Notificaciones")
- [ ] T046 [US7] Create `apps/mobile/src/app/(app)/notifications.tsx`:
  - list of NotificationRow with pull to refresh and the empty text "Sin notificaciones en los últimos 30 días";
  - the `warningSoft` banner "Esto ya no está disponible" when opened with `?unavailable=1`;
  - `useRefetchOnFocus`.

  Register it as "Notificaciones" in `apps/mobile/src/app/(app)/_layout.tsx` and put `BellButton` next to the greeting in `apps/mobile/src/app/(app)/(tabs)/home.tsx`.

**Checkpoint**: US7 complete.

---

## Phase 10: User Story 6 - Abrir la pantalla desde la notificación (Priority: P2)

**Goal**: tocar un push o una fila lleva al destino, o al historial si ya no existe.

**Independent Test**: en la app, B9.4, B9.5 y B9.6.

- [ ] T047 [US6] Create `apps/mobile/src/notifications/navigation.ts` (research.md R10):
  - `openTarget(target)` maps `card`, `statement`, `occurrence` and `history` to their routes;
  - before navigating, fetch the resource with the existing API functions; on `NOT_FOUND` go to `/notifications?unavailable=1`;
  - without a session do nothing (the login guard applies).

  Use it from `NotificationRow` taps in `notifications.tsx`.
- [ ] T048 [US6] Create `apps/mobile/src/notifications/use-notifications.ts` and mount it in `apps/mobile/src/app/_layout.tsx`:
  - `setNotificationHandler` shows banner and sound in the foreground;
  - `addNotificationReceivedListener` invalidates `notificationKeys.all`;
  - `addNotificationResponseReceivedListener` and `getLastNotificationResponseAsync` (cold start, handled once after the session is restored) call `openTarget(response.notification.request.content.data.target)`.

**Checkpoint**: US6 complete (validated on a development build).

---

## Phase 11: User Story 8 - Notificación de prueba (Priority: P3)

**Goal**: comprobar desde Perfil que llegan las notificaciones a este teléfono.

**Independent Test**: quickstart.md B6 (prueba); en la app, B9.3.

### Tests for User Story 8 (write first, must FAIL) ⚠️

- [ ] T049 [P] [US8] Add to `apps/api/test/notifications.e2e-spec.ts`:
  - POST `/notifications/test` without a device in the session → 409 `DEVICE_NOT_REGISTERED`;
  - with one → 202 `{ sent: 1 }` and one message "Corte" / "Las notificaciones funcionan." only to this session's token (another session of the same user with its own device gets nothing);
  - again at +10 s → 429 `TEST_RATE_LIMITED` with `retryAfterSeconds` 20; at +31 s → 202 (data-model.md → `Device.lastTestAt`);
  - `FakePushClient` throwing → 502 `PUSH_FAILED`;
  - no `notifications` row is created.

### Implementation for User Story 8

- [ ] T050 [US8] Implement `test(user)` in `notifications.service.ts` and POST `/notifications/test` (`@HttpCode(202)`) in `notifications.controller.ts` (research.md R11: session tokens, `last_test_at` with the `Clock`, `TEST_PUSH_CONTENT`, no history); make T049 pass
- [ ] T051 [US8] Add the button "Enviar notificación de prueba" to `apps/mobile/src/app/(app)/(tabs)/profile.tsx`:
  - only with status "Activadas";
  - messages for 202, 409, 429 (disabled with "Espera <s> s" counting down) and 502 or network errors, per contracts/screens.md → Prueba.

**Checkpoint**: US8 complete.

---

## Phase 12: User Story 10 - Mis notificaciones son solo mías (Priority: P1)

**Goal**: aislamiento de dispositivos, historial, prueba y envíos.

**Independent Test**: `pnpm --filter api test:e2e -- notifications-isolation`.

- [ ] T052 [US10] Write `apps/api/test/notifications-isolation.e2e-spec.ts` with users A and B, each with cards, a recurring payment and a device:
  - A's budget alert and reminders reach only A's token and A's history, and B's only B's;
  - B's GET `/notifications` has nothing of A;
  - B's DELETE `/devices/current` and POST `/notifications/test` leave A's device untouched and do not send to it;
  - B's GET of A's `card`, `statement` and `occurrence` targets → 404 like an unknown id;
  - no push `data` contains a user id;
  - **token handover** (plan.md → Complexity Tracking, the principle III exception): A has two devices; B posts the token of one of them → 204 with an empty body, that row now belongs to B and B's session, A's other device and all A's data are unchanged, and the next alert of A reaches only A's remaining device.

  FR-027, SC-007; make it pass, fixing whatever leaks.

**Checkpoint**: all API stories green.

---

## Phase 13: Polish & Cross-Cutting Concerns

- [ ] T053 [P] Update `docs/design-system.md`:
  - NotificationRow, BellButton, PermissionIntro and NotificationStatusRow;
  - the "Recordar con anticipación" field of RecurringForm;
  - the bell in "Pantalla de inicio" point 1;
  - check that every color pair used is in the measured list (AA).
- [ ] T054 [P] Update `docs/mvp-spec.md` (rule 3 of "Cupo, tope y alertas": al registrar o editar una compra, una sola alerta con el umbral más alto cruzado, y todos los umbrales cruzados quedan avisados una vez por ciclo, per research.md R2; data model: `devices`, `notifications`, `notification_dispatches` and `push_tickets` replace `alert_logs`; API table: `/devices`, `/devices/current`, `/notifications` and `/notifications/test`, linking contracts/notifications.openapi.yaml), `README.md` and `specs/000-project-skeleton/contracts/environment.md`. The README gets a section "Alertas y recordatorios" with:
  - `JOBS_ENABLED` and `EXPO_ACCESS_TOKEN`;
  - the single API instance requirement;
  - the 15-minute job, receipts and cleanup;
  - that push needs a development build.
- [ ] T055 Design review of the new screens against `docs/design-system.md` and contracts/screens.md (tokens only, touch areas ≥ 44, states written, AA contrast, long texts with $9.999.999.999 not cut in NotificationRow); fix what is found
- [ ] T056 Run quickstart.md B1–B8 (curl and test commands), `pnpm lint && pnpm format:check && pnpm typecheck`, `pnpm --filter @corte/domain test:cov`, `pnpm --filter api test && pnpm --filter api test:e2e` and `pnpm --filter mobile exec expo export` for iOS and Android; B9 (development build on iOS and Android) is validated manually by the user
- [ ] T057 After B9 passes, mark spec 006 as "(cerrada)" in "Orden de specs" of `docs/mvp-spec.md` and update "Estado" in `CLAUDE.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T005 after T004.
- **Foundational (Phase 2)**: after Setup; blocks every story (domain rules, tables, push layer,
  device registration, app API and permission helpers).
- **US1 (Phase 3)**: after Foundational. MVP: the device registers.
- **US2 (Phase 4)**: after Foundational; independent from US1's app work (e2e register devices
  through the API).
- **US3 (Phase 5)**: after Foundational. Creates the job.
- **US5 (Phase 6)**: after US3 (same service and job).
- **US9 (Phase 7)**: after Foundational. T034 uses budget alerts from US2 to check delivery;
  T037 extends the job of US3.
- **US4 (Phase 8)**: after US3 (reminders service). T042 is app-only and independent.
- **US7 (Phase 9)**: after US2 or US3 (rows to show). T044 extends the job.
- **US6 (Phase 10)**: after US7 (the history screen is the fallback destination).
- **US8 (Phase 11)**: after Foundational (devices) and T024 (Profile status).
- **US10 (Phase 12)**: after every endpoint and the job exist (T050, T041).
- **Polish (Phase 13)**: after all stories.

### Within Each User Story

- Tests first and failing; domain before API; API before the app; components before screens.
- `pnpm --filter @corte/domain build` after each domain change, before the API typecheck.
- Tasks that touch `notifications.jobs.ts` (T031, T033, T037, T044) and `reminders.service.ts`
  (T030, T033, T041) run one after another.

### Parallel Opportunities

- Setup: T002 ‖ T003 ‖ T004.
- Foundational:
  - T006 ‖ T007 ‖ T008 ‖ T009 ‖ T010 (T007–T009 share a file: separate `describe` blocks,
    coordinate);
  - T015 ‖ T019 ‖ T020 while T011–T014 run.
- US1: T022 ‖ T024 after T021.
- US2 ‖ US3 on the API, while US1 advances on the app.
- US9: T034 ‖ T035.
- US4: T038 ‖ T039 ‖ T042.
- US7: T043 ‖ T045.
- Polish: T053 ‖ T054.

---

## Parallel Example: Foundational

```text
Task: "T007 budgetAlert tests in packages/domain/src/notifications.test.ts"
Task: "T010 localDateTimeIn tests in apps/api/src/common/today.spec.ts"
Task: "T019 apps/mobile/src/api/notifications.ts"
Task: "T020 apps/mobile/src/notifications/permission.ts + intro-flag.ts"
```

## Parallel Example: User Story 2 and User Story 3 (API)

```text
Task: "T026 apps/api/test/budget-alerts.e2e-spec.ts"
Task: "T029 apps/api/test/reminders.e2e-spec.ts (cards)"
```

---

## Implementation Strategy

### MVP First

1. Setup + Foundational: rules, tables, push layer and device registration.
2. US1: explanation, permission and registration in the app.
3. US2: budget alerts, the first push with real value.
4. **Stop and validate**: quickstart.md B2 and B3, the e2e, and B9.1, B9.2 and B9.4 on a
   development build.

### Incremental Delivery (by tramos: domain → API → app)

1. **Domain**: T006–T012.
2. **API**: Foundational API, US2, US3, US5, US9, US4 (API), US7 (API), US8 (API), US10; e2e
   green.
3. **App**: US1, US4 (form), US7 (screens), US6, US8 (button); then B9 by the user on iOS and
   Android.
4. **Polish**: docs, design review, quickstart, close the spec.
