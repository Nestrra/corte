---

description: "Task list for spec 002 — Tarjetas y dominio de ciclos"
---

# Tasks: Tarjetas y dominio de ciclos

**Input**: Design documents from `/specs/002-cards/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. La constitución exige pruebas primero en dominio y API (principio II), e2e de cada
endpoint y aislamiento entre usuarios (principio III); la spec pide pruebas exhaustivas de
calendario (FR-008) y cobertura ≥ 95% (FR-009). En cada fase las pruebas se escriben antes de
implementar y deben fallar primero. La app se valida a mano (quickstart.md B8).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo (plan.md → Project Structure): `packages/domain/`, `apps/api/`, `apps/mobile/`. Las e2e de
tarjetas viven en `apps/api/test/cards.e2e-spec.ts` (un `describe` por historia) y
`apps/api/test/cards-isolation.e2e-spec.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencia nueva y umbral de cobertura.

- [ ] T001 Add `@expo/vector-icons` to `apps/mobile` with `pnpm exec expo install @expo/vector-icons` (research.md R8); run `pnpm install`
- [ ] T002 [P] Add `coverage.thresholds` of 95 for `lines`, `branches`, `functions` and `statements` in `packages/domain/vitest.config.ts` and replace the "no threshold yet" comment (research.md R11, FR-009); confirm `pnpm --filter @corte/domain test:cov` still passes with the current rules

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Reglas de validación de tarjetas, modelo y migración, errores, mapper y módulo base del
API, y la navegación con pestañas de la app. Todas las historias dependen de esta fase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational (write first, must FAIL) ⚠️

- [ ] T003 [P] Write Vitest tests in `packages/domain/src/card-rules.test.ts`: `CARD_COLORS` (the 6 keys, same order as `cardColors` in the design system), `validateCardName` after trimming (REQUIRED / TOO_LONG at 41), `isValidLast4` (exactly 4 digits), `validateDayOfMonth` (1–31, integers only), `validateReminderDays` (0–15, integers only), `validateAmount` (1–9.999.999.999, integers only), `validateCycleBudget` (OUT_OF_RANGE, EXCEEDS_CREDIT_LIMIT, equal to the limit is valid) and the default reminder constants, per data-model.md `Card.name`, `Card.color`, `Card.last4`, `Card.cutoffDay`, `Card.dueDay`, `Card.creditLimit`, `Card.cycleBudget`, `Card.remindCutoffDays` and `Card.remindDueDays`
- [ ] T004 [P] Write unit tests in `apps/api/src/cards/card.mapper.spec.ts`: `bigint → number` conversion of `creditLimit` and `cycleBudget`, error when a value is not a safe integer, `availableCredit` equal to `creditLimit` (FR-017), `last4` null kept as null, dates as ISO strings, no `userId` in the output (research.md R5, contracts/cards.openapi.yaml `Card`)

### Implementation for Foundational

- [ ] T005 [P] Implement `packages/domain/src/card-rules.ts` and export it from `packages/domain/src/index.ts`, per data-model.md "Reglas compartidas en packages/domain" and the Card fields cited in T003 (makes T003 pass)
- [ ] T006 Add `enum CardColor` and `model Card` to `apps/api/prisma/schema.prisma` with the `User.cards` relation, per data-model.md `Card.id`, `Card.userId` (cascade), `Card.name`, `Card.color`, `Card.last4`, `Card.cutoffDay`, `Card.dueDay`, `Card.creditLimit`, `Card.cycleBudget`, `Card.remindCutoffDays`, `Card.remindDueDays`, `Card.archivedAt`, `Card.createdAt`, `Card.updatedAt` and the `(user_id, archived_at, created_at)` index
- [ ] T007 Generate the migration with `pnpm --filter api exec prisma migrate dev --create-only --name cards`, add by hand the `CHECK` constraints listed in data-model.md (Card, "CHECK") to its `migration.sql`, and apply it with `pnpm --filter api db:migrate` (research.md R6)
- [ ] T008 [P] Add `CARD_ARCHIVED` (409) to `ErrorCode` and `AppErrors.cardArchived()` in `apps/api/src/common/errors.ts` (contracts/errors.md)
- [ ] T009 Implement `apps/api/src/cards/card.mapper.ts` (`PublicCard`, `toPublicCard`, `toBigIntAmount`) (makes T004 pass)
- [ ] T010 Create `apps/api/src/cards/cards.module.ts`, an empty `apps/api/src/cards/cards.controller.ts` (`@Controller('cards')`) and `apps/api/src/cards/cards.service.ts` with the private helper `findOwned(userId, id)` that validates the id as UUID and queries `where: { id, userId }`, throwing `AppErrors.notFound('Card not found')` for invalid ids, missing cards and cards of other users (research.md R7, FR-018); register `CardsModule` in `apps/api/src/app.module.ts`
- [ ] T011 Implement the `Clock` provider in `apps/api/src/common/clock.ts` (injection token `CLOCK`, interface `{ now(): Date }`, default `new Date()`), register it globally in `apps/api/src/app.module.ts`, and inject it in `CardsService`; in e2e `createTestApp({ now })` overrides it with a fixed instant (research.md R3, U1 of the analysis)
- [ ] T012 Add `createCard(token, overrides?)` with valid defaults (`Visa principal`, `petroleo`, `4821`, corte 8, pago 25, 5000000, 2000000) to `apps/api/test/helpers.ts`. `resetDatabase` already removes cards through the cascade from `users`; add an assertion in one e2e that the `cards` table is empty after `resetDatabase`, without changing it. Also let `createTestApp` accept a fixed instant that overrides the `Clock` provider (T011)
- [ ] T013 [P] Add `apps/mobile/src/api/cards.ts` with the `Card`, `CardDetail`, `Cycle`, `CardInput` types of contracts/cards.openapi.yaml and the functions `listCards(archived?)`, `getCard(id)`, `createCard(input)`, `updateCard(id, input)`, `archiveCard(id)`, `restoreCard(id)` over `apiFetch`; add the card field and `CARD_ARCHIVED` / `NOT_FOUND` texts of contracts/errors.md to `apps/mobile/src/api/errors.ts`
- [ ] T014 [P] Implement `apps/mobile/src/features/money.ts`: `formatCop(amount)` = `'$' + Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })` (research.md R4) and `parseAmountInput(text)` (digits only → integer or null)
- [ ] T015 [P] Implement `apps/mobile/src/components/TabBar.tsx` per contracts/screens.md "TabBar" (Ionicons, `tab` / `tabActive`, `accessibilityRole="tab"`, ≥ 44, theme tokens only)
- [ ] T016 Restructure the app into tabs (research.md R8, contracts/screens.md "Navegación"): move `apps/mobile/src/app/(app)/home.tsx` and `profile.tsx` into `apps/mobile/src/app/(app)/(tabs)/`, remove the "Perfil" button from home, create `apps/mobile/src/app/(app)/(tabs)/_layout.tsx` (`Tabs` with `tabBar={TabBar}` and screens `home`, `cards`, `profile`) and a placeholder `apps/mobile/src/app/(app)/(tabs)/cards.tsx`; in `apps/mobile/src/app/(app)/_layout.tsx` set `anchor: '(tabs)'` and put `(tabs)` and the `card/*` screens inside the `Stack.Protected guard={!mustChangePassword}` (change-password stays outside); keep the `/` → `/home` redirect working and fix any navigation to `/profile`

**Checkpoint**: domain card rules green, `cards` table migrated, app with three tabs and profile working as in spec 001.

---

## Phase 3: User Story 1 - Fechas de ciclo correctas (Priority: P1) 🎯 MVP

**Goal**: Calendario propio y reglas de corte y fecha límite en `packages/domain` (FR-001–FR-008).

**Independent Test**: `pnpm --filter @corte/domain test:cov` en verde con cobertura ≥ 95% (quickstart.md B1).

### Tests for User Story 1 (write first, must FAIL) ⚠️

- [ ] T017 [P] [US1] Write Vitest tests in `packages/domain/src/calendar.test.ts`: `isValidIsoDate` (format and real dates, e.g. `2027-02-29` invalid, `2028-02-29` valid), `parseIsoDate` / `toIsoDate` round trip with zero padding, `isLeapYear` (2024, 2027, 2028, 1900, 2000), `daysInMonth` for every month, `clampedDate(year, month, day)` (31 → 28/29/30), `addMonths` across December → January, `compareIsoDates` and `daysBetween` (same day 0, across months, leap years and year change, negative when reversed) (research.md R1)
- [ ] T018 [P] [US1] Write Vitest tests in `packages/domain/src/cycles.test.ts` with every scenario of spec User Story 1 (1–9) and the FR-008 list: corte 8 / pago 25 with purchases on 2026-11-08 and 2026-11-09; corte 25 / pago 8 with year change; corte 31 in February 2027 and 2028 and back to 31 in March; corte 30 / pago 15 from January 31; day límite equal to corte; corte 28 / pago 30 in February 2027 → due March 30; months of 30 days with days 29, 30 and 31; `nextCutoff` when today is the cutoff day; `nextDueDate` before and after the previous cycle's due date (research.md R2)
- [ ] T019 [P] [US1] Write `packages/domain/src/cycles.reference.test.ts`: a naive reference written inside the test that walks day by day with `Date.UTC` (first cutoff ≥ date; first due-day date > cutoff, both clamped to month end), compared with `cycleForDate`, `nextCutoff` and `nextDueDate` for every cutoff day 1–31, every due day 1–31 and every date of 2027 and 2028 (research.md R2, SC-003)

### Implementation for User Story 1

- [ ] T020 [US1] Implement `packages/domain/src/calendar.ts` without `Date` (`IsoDate`, parse/format, leap years, days in month, clamp, addMonths, compare, `daysBetween` via days-from-civil) and export it from `packages/domain/src/index.ts` (makes T017 pass)
- [ ] T021 [US1] Implement `packages/domain/src/cycles.ts` (`CycleDays`, `cutoffForDate`, `dueDateForCutoff`, `cycleForDate`, `nextCutoff`, `nextDueDate`) and export it (makes T018 and T019 pass); confirm the ≥ 95% threshold of T002 holds

**Checkpoint**: reglas de ciclo verificadas de forma exhaustiva; el resto de historias puede usarlas.

---

## Phase 4: User Story 2 - Registrar una tarjeta (Priority: P1)

**Goal**: Crear tarjetas en el API (`POST /cards`) y desde el formulario de la app.

**Independent Test**: quickstart.md B2 (crear y validaciones) y B8.3 (formulario en la app).

### Tests for User Story 2 (write first, must FAIL) ⚠️

- [ ] T022 [US2] Write e2e tests in `apps/api/test/cards.e2e-spec.ts` (`describe('POST /cards')`): 201 with trimmed name, default reminders 2 and 3, `availableCredit` = `creditLimit`, `archivedAt` null and no `userId`; `last4` omitted or null → null; 400 `VALIDATION_ERROR` with field and code for each invalid field of contracts/errors.md (day 0 and 32, decimal day, `last4` `48a1`, unknown color, amount 0 and above the maximum, `cycleBudget` > `creditLimit` → `EXCEEDS_CREDIT_LIMIT`, reminders 16, unknown field); 401 without token; 403 `PASSWORD_CHANGE_REQUIRED` with a pending temporary password

### Implementation for User Story 2

- [ ] T023 [P] [US2] Implement `createCardSchema` in `apps/api/src/cards/cards.schemas.ts` with zod and the `@corte/domain` validators (issue messages = field codes of contracts/errors.md, strict object, defaults for reminders, `cycleBudget` vs `creditLimit` check on the `cycleBudget` field)
- [ ] T024 [US2] Implement `create(userId, input)` in `apps/api/src/cards/cards.service.ts` and `POST /cards` (201) in `apps/api/src/cards/cards.controller.ts` with `ZodValidationPipe` and `@CurrentUser()` (makes T022 pass)
- [ ] T025 [P] [US2] Implement `apps/mobile/src/features/card-schema.ts`: zod schema of the form with the `@corte/domain` validators and Spanish messages of contracts/errors.md; amounts parsed with `parseAmountInput`
- [ ] T026 [P] [US2] Implement `apps/mobile/src/components/ColorPicker.tsx` per contracts/screens.md "ColorPicker" (radiogroup, 6 options ≥ 44, check icon on the selected one, accessible Spanish names)
- [ ] T027 [P] [US2] Implement `apps/mobile/src/components/CreditCardView.tsx` per contracts/screens.md "CreditCardView" (300 × 184, radius `card`, `cardColors[color]`, `formatCop`, `tabular-nums`, full `accessibilityLabel`; with `last4` null the "****" line is not shown, spec US2 scenario 2)
- [ ] T028 [US2] Implement `apps/mobile/src/components/CardForm.tsx` (react-hook-form + `card-schema`, fields of contracts/screens.md, numeric keyboards, amounts formatted on blur, API field errors mapped with `applyApiFieldErrors`, values kept on error) and `apps/mobile/src/app/(app)/card/new.tsx` (title "Nueva tarjeta", "Guardar tarjeta" creates the card, invalidates `['cards']` and returns to the Tarjetas tab; "Cancelar" returns)

**Checkpoint**: crear una tarjeta funciona en el API y en la app.

---

## Phase 5: User Story 3 - Ver mis tarjetas en el carrusel (Priority: P1)

**Goal**: `GET /cards` (activas en orden de creación) y la pestaña Tarjetas con carrusel y estado vacío.

**Independent Test**: quickstart.md B2 (lista) y B8.1–B8.4.

### Tests for User Story 3 (write first, must FAIL) ⚠️

- [ ] T029 [US3] Add `describe('GET /cards')` to `apps/api/test/cards.e2e-spec.ts`: empty list for a new user; active cards in creation order; archived cards excluded (set `archivedAt` through Prisma in the test); `?archived=false` same as default; `?archived=maybe` → 400 `VALIDATION_ERROR` on `archived`

### Implementation for User Story 3

- [ ] T030 [US3] Implement `listCardsQuerySchema` in `apps/api/src/cards/cards.schemas.ts`, `list(userId, archived)` in `apps/api/src/cards/cards.service.ts` (ordered by `createdAt`) and `GET /cards` in `apps/api/src/cards/cards.controller.ts` (makes T029 pass; the `archived=true` branch is exercised in US6)
- [ ] T031 [P] [US3] Implement `apps/mobile/src/components/CardCarousel.tsx` per contracts/screens.md "CardCarousel" (FlatList horizontal, snap 312, peek, dots with `accessibilityLabel` "Tarjeta X de N", `onPressCard`)
- [ ] T032 [US3] Implement `apps/mobile/src/app/(app)/(tabs)/cards.tsx` per contracts/screens.md (title "Tarjetas", TanStack Query `['cards', 'active']`, carousel, empty state, "Agregar tarjeta" → `/card/new`, loading and error with "Reintentar"; tapping a card → `/card/[id]`)

**Checkpoint**: crear y ver tarjetas en el carrusel funciona de punta a punta.

---

## Phase 6: User Story 4 - Ver el detalle de una tarjeta (Priority: P1)

**Goal**: `GET /cards/:id` con el ciclo calculado en la zona del usuario, y la pantalla de detalle.

**Independent Test**: quickstart.md B3 y B8.5.

### Tests for User Story 4 (write first, must FAIL) ⚠️

- [ ] T033 [P] [US4] Write unit tests in `apps/api/src/common/today.spec.ts`: `todayInTimeZone(timeZone, now)` for `2026-11-22T02:30:00Z` → `2026-11-21` in America/Bogota and `2026-11-22` in Europe/Madrid; year change at New Year's Eve; zero-padded month and day (research.md R3)
- [ ] T034 [US4] Add `describe('GET /cards/:id')` to `apps/api/test/cards.e2e-spec.ts`: 200 with the card fields and `cycle` with exact dates under the fixed instant `2026-11-22T02:30:00Z` (T011): for a card with corte 8 / pago 25, a user in America/Bogota gets `today` `2026-11-21`, `nextCutoff` `2026-12-08`, `nextCutoffDue` `2026-12-25`, `nextDue` `2026-11-25`; for a card with corte 21 / pago 5, Bogotá gets `today` `2026-11-21`, `nextCutoff` `2026-11-21` (today), `nextCutoffDue` `2026-12-05`, `nextDue` `2026-12-05`, and a user in Europe/Madrid gets `today` `2026-11-22`, `nextCutoff` `2026-12-21`, `nextCutoffDue` `2027-01-05`, `nextDue` `2026-12-05` (spec US4 scenario 3); archived cards are readable; 404 `NOT_FOUND` for a random UUID and for `no-es-uuid` with the same body

### Implementation for User Story 4

- [ ] T035 [P] [US4] Implement `apps/api/src/common/today.ts` with `Intl.DateTimeFormat('en-US', { timeZone, year, month, day }).formatToParts` (makes T033 pass)
- [ ] T036 [US4] Implement `getDetail(userId, id)` in `apps/api/src/cards/cards.service.ts` (takes `now` from the injected `Clock` of T011, reads the user's timezone, computes the cycle with `nextCutoff` and `nextDueDate` of `@corte/domain`) and `GET /cards/:id` in `apps/api/src/cards/cards.controller.ts` (makes T034 pass)
- [ ] T037 [P] [US4] Implement `apps/mobile/src/features/dates.ts`: `formatLongDate('2026-12-08')` → "8 de diciembre de 2026" with Spanish month names (no Intl) and `daysLeftLabel(today, date)` → "Hoy" / "Mañana" / "faltan N días" using `daysBetween` of `@corte/domain`
- [ ] T038 [US4] Implement `apps/mobile/src/app/(app)/card/[id]/index.tsx` per contracts/screens.md (CreditCardView, next cutoff and its due date with days left, configured data with amounts in `formatCop` and `tabular-nums` (FR-024); refetch on focus; 404 → "No encontramos esa tarjeta" with a back button; "Editar" and "Archivar" are wired in US5 and US6)

**Checkpoint**: el detalle muestra fechas coherentes con el calendario en la zona del usuario.

---

## Phase 7: User Story 5 - Editar una tarjeta (Priority: P2)

**Goal**: `PATCH /cards/:id` parcial y la pantalla de edición.

**Independent Test**: quickstart.md B4 y B8.6.

### Tests for User Story 5 (write first, must FAIL) ⚠️

- [ ] T039 [US5] Add `describe('PATCH /cards/:id')` to `apps/api/test/cards.e2e-spec.ts`: partial update of `cutoffDay` reflected in `GET /cards/:id`; `last4: null` clears it; `cycleBudget` above the stored `creditLimit` → 400 `EXCEEDS_CREDIT_LIMIT`; lowering `creditLimit` below the stored `cycleBudget` → 400 `EXCEEDS_CREDIT_LIMIT` on `cycleBudget`; empty body → 400; same field validations as POST; archived card → 409 `CARD_ARCHIVED` without changes; 404 for missing ids

### Implementation for User Story 5

- [ ] T040 [US5] Implement `updateCardSchema` (partial, strict, at least one field) in `apps/api/src/cards/cards.schemas.ts` and `update(userId, id, input)` in `apps/api/src/cards/cards.service.ts` (validates the budget against the resulting limit, rejects archived cards) plus `PATCH /cards/:id` in `apps/api/src/cards/cards.controller.ts` (makes T039 pass)
- [ ] T041 [US5] Implement `apps/mobile/src/app/(app)/card/[id]/edit.tsx` reusing `CardForm` with the current values (sends the full form; invalidates `['cards']` and `['card', id]`; returns to the detail) and wire "Editar" in `apps/mobile/src/app/(app)/card/[id]/index.tsx`

**Checkpoint**: editar una tarjeta recalcula las fechas mostradas.

---

## Phase 8: User Story 6 - Archivar y restaurar una tarjeta (Priority: P2)

**Goal**: `POST /cards/:id/archive`, `POST /cards/:id/restore`, `GET /cards?archived=true` y las pantallas.

**Independent Test**: quickstart.md B5 y B8.7.

### Tests for User Story 6 (write first, must FAIL) ⚠️

- [ ] T042 [US6] Add `describe('archive and restore')` to `apps/api/test/cards.e2e-spec.ts`: archive → 200 with `archivedAt`, gone from `GET /cards`, present in `GET /cards?archived=true`; archive again → 200 unchanged; restore → 200 with `archivedAt` null, back in `GET /cards` with the same data and creation order; restore an active card → 200 unchanged; 404 for missing ids

### Implementation for User Story 6

- [ ] T043 [US6] Implement `archive(userId, id)` and `restore(userId, id)` in `apps/api/src/cards/cards.service.ts` and `POST /cards/:id/archive` and `POST /cards/:id/restore` (200) in `apps/api/src/cards/cards.controller.ts` (makes T042 pass)
- [ ] T044 [P] [US6] Implement `apps/mobile/src/app/(app)/card/archived.tsx` per contracts/screens.md (list with color, name and last 4; tap → detail)
- [ ] T045 [US6] In `apps/mobile/src/app/(app)/card/[id]/index.tsx` wire "Archivar" (text `danger`, confirmation dialog, then back to the Tarjetas tab) and, for archived cards, the "Tarjeta archivada" notice, read-only data and "Restaurar"; in `apps/mobile/src/app/(app)/(tabs)/cards.tsx` add "Archivadas (N)" when N > 0 (query `['cards', 'archived']`); invalidate both lists after archive and restore

**Checkpoint**: archivar y restaurar conservan todos los datos (SC-006).

---

## Phase 9: User Story 7 - Mis tarjetas son solo mías (Priority: P1)

**Goal**: Pruebas de aislamiento de los 7 endpoints de tarjetas (FR-018, FR-019, principio III).

**Independent Test**: quickstart.md B6 y `pnpm --filter api test:e2e`.

### Tests for User Story 7 ⚠️

- [ ] T046 [US7] Write `apps/api/test/cards-isolation.e2e-spec.ts` with two users (Ana and Beto), each with active and archived cards: each `GET /cards` and `GET /cards?archived=true` lists only their own; Beto's `GET`, `PATCH`, `archive` and `restore` on Ana's card → 404 with the same body as a random UUID, and Ana's card is unchanged afterwards (compare the full record); `POST /cards` ignores any `userId` in the body (400 `UNKNOWN_FIELD`) and the card belongs to the token's user; a JWT with an altered `sub` is rejected; deleting Ana's account deletes her cards and leaves Beto's; `DELETE /cards/:id` → 404 and the card is unchanged (FR-016: no individual deletion); with a pending temporary password (spec 001), `GET /cards`, `GET /cards/:id` and `POST /cards` → 403 `PASSWORD_CHANGE_REQUIRED` (FR-026)
- [ ] T047 [US7] Fix any isolation gap found by T046 in `apps/api/src/cards/cards.service.ts` (every query by `{ id, userId }` or `{ userId }`); if none, record it in the task as verified

**Checkpoint**: ninguna operación de tarjetas cruza usuarios.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Documentación, verificación completa y validación del quickstart.

- [ ] T048 [P] Update `README.md`: API section with the `/cards` endpoints, app section with the tabs and the new components (`TabBar`, `CreditCardView`, `CardCarousel`, `ColorPicker`, `CardForm`), domain section with the cycle rules and the 95% coverage gate
- [ ] T049 [P] Update `docs/mvp-spec.md` → "Orden de specs" to write "(cerrada)" after 002, as for spec 000, and note in `docs/design-system.md` → TabBar that the center button and Pagos arrive in later specs (no token changes)
- [ ] T050 Run `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm --filter @corte/domain test:cov`, `pnpm --filter api test` and `pnpm --filter api test:e2e`; fix any failure
- [ ] T051 Build the API image (`docker build -f apps/api/Dockerfile -t corte-api .`) and the `migrate` target; check the image stays < 300 MB and the `cards` migration applies with the `migrate` target on a fresh database
- [ ] T052 Validate quickstart.md B1–B7 and B9 with curl and the test commands; B8 (app on iOS simulator and Android emulator, including `$5.000.000` on Android, plus a check of AA contrast and ≥ 44 touch areas on the new screens: `caption` text on the card, carousel dots and inactive tabs; SC-007) is validated manually by the user

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; blocks all user stories.
- **US1 (Phase 3)**: depends on Foundational only (domain); can run in parallel with US2/US3 API work.
- **US2 (Phase 4)**: depends on Foundational.
- **US3 (Phase 5)**: depends on US2 (needs cards to list; reuses `CreditCardView`).
- **US4 (Phase 6)**: depends on US1 (cycle rules) and US2 (cards to read).
- **US5 (Phase 7)**: depends on US4 (detail screen) for the app part; API part only on US2.
- **US6 (Phase 8)**: depends on US4 (detail screen) and US3 (list/tab).
- **US7 (Phase 9)**: depends on all endpoints (US2–US6).
- **Polish (Phase 10)**: depends on all stories.

### Within Each User Story

- Tests first, and they must fail before implementing.
- Domain → schemas → service → controller → app screen.
- `cards.e2e-spec.ts`, `cards.schemas.ts`, `cards.service.ts` and `cards.controller.ts` are shared files: tasks that touch them run sequentially (no [P]).

### Parallel Opportunities

- Setup: T001 and T002.
- Foundational: T003 and T004 (tests); then T005, T008, T013, T014 and T015 in parallel; T006 → T007 → T009/T010 → T011 → T012 in sequence; T016 after T015.
- US1: T017, T018 and T019 in parallel; then T020 → T021.
- US1 (domain) in parallel with the API part of US2 (T022–T024).
- US2 app: T025, T026 and T027 in parallel, then T028.
- US4: T033 in parallel with T034; T035 and T037 in parallel.

---

## Parallel Example: User Story 2

```bash
# After T024 (POST /cards) is green, build the app pieces together:
Task: "T025 [US2] card-schema.ts with @corte/domain validators"
Task: "T026 [US2] ColorPicker.tsx (radiogroup)"
Task: "T027 [US2] CreditCardView.tsx"
# Then:
Task: "T028 [US2] CardForm.tsx and card/new.tsx"
```

## Parallel Example: User Story 1

```bash
Task: "T017 [US1] calendar.test.ts"
Task: "T018 [US1] cycles.test.ts"
Task: "T019 [US1] cycles.reference.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 + Phase 2.
2. Phase 3 (US1): the cycle rules, verified exhaustively. This is the core asset for specs 003–005.
3. Phases 4–6 (US2–US4): create, list and see the detail of a card. **Stop and validate** with
   quickstart.md B1–B3 and B8.1–B8.5.

### Incremental Delivery

4. US5 (edit) and US6 (archive/restore).
5. US7 (isolation suite over the 7 endpoints) before opening the PR.
6. Polish: docs, full checks, image, quickstart.
