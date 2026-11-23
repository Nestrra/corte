---

description: "Task list for spec 003 — Compras, cuotas y extractos"
---

# Tasks: Compras, cuotas y extractos

**Input**: Design documents from `/specs/003-purchases/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. La constitución exige pruebas primero en dominio y API (principio II), e2e de cada
endpoint y aislamiento entre usuarios (principio III); la spec pide pruebas de los ejemplos y de
propiedades (FR-005) y mantener la cobertura del dominio ≥ 95% (SC-002). En cada fase las pruebas
se escriben antes de implementar y deben fallar primero. La app se valida a mano (quickstart.md
B11).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo (plan.md → Project Structure): `packages/domain/`, `apps/api/`, `apps/mobile/`. Las e2e
usan `createTestApp({}, { now: FIXED_NOW })` de `apps/api/test/helpers.ts`: `FIXED_NOW` =
`2026-11-22T02:30:00Z`, es decir **hoy = 2026-11-21** en America/Bogota. Con corte 8 y pago 25 ese
día: el extracto del 2026-11-08 está `due`, el del 2026-10-08 `overdue` (si existe y no está
pagado) y el del 2026-12-08 `open`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencia nueva de la app.

- [X] T001 Add `@react-native-community/datetimepicker` to `apps/mobile` with `pnpm --filter mobile exec expo install @react-native-community/datetimepicker` (research.md R11; approved by the user) and run `pnpm install`; confirm `pnpm --filter mobile typecheck` still passes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modelo y migración, helpers de fechas y UUID, error nuevo, servicio `ledger` base,
helpers de e2e, tipos de la app y StatusChip. Todas las historias dependen de esta fase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Extend `apps/api/prisma/schema.prisma` (comment: specs 001–003): add `annualRate Decimal? @map("annual_rate") @db.Decimal(5, 2)` to `Card` and the relations `purchases` / `statements`; add `model Purchase`, `model Installment` and `model Statement` with every column, unique and index of data-model.md: `Card.annualRate`; `Purchase.id`, `Purchase.cardId` (cascade), `Purchase.amount`, `Purchase.concept`, `Purchase.purchaseDate` (`@db.Date`), `Purchase.installmentCount`, `Purchase.noInterest`, `Purchase.annualRate`, `Purchase.createdAt`, `Purchase.updatedAt` and its `(card_id, purchase_date DESC, created_at DESC)` index; `Installment.id`, `Installment.purchaseId` (cascade), `Installment.statementId` (cascade), `Installment.number`, `Installment.principal`, `Installment.interest`, `UNIQUE (purchase_id, number)` and the `(statement_id)` index; `Statement.id`, `Statement.cardId` (cascade), `Statement.cutoffDate`, `Statement.dueDate`, `Statement.paidAt` (`@db.Date`, with a `///` comment saying it is a business date, not an instant), `Statement.paidAmount`, `Statement.createdAt`, `Statement.updatedAt` and `UNIQUE (card_id, cutoff_date)`
- [X] T003 Generate the migration with `pnpm --filter api exec prisma migrate dev --create-only --name purchases_statements`, add by hand to its `migration.sql` every `CHECK` listed in data-model.md (`cards_annual_rate_range`; Purchase "CHECK"; Installment "CHECK"; Statement "CHECK", including `statements_payment_pair` and `statements_due_after_cutoff`), and apply it with `pnpm --filter api db:migrate`; verify each `CHECK` rejects a bad row with a quick `psql` insert against `corte_dev`
- [X] T004 [P] Implement `apps/api/src/common/iso-date.ts` (`toDbDate(iso)` = `new Date(iso + 'T00:00:00.000Z')`, `fromDbDate(date)` = `toISOString().slice(0, 10)`) with unit tests in `apps/api/src/common/iso-date.spec.ts` (round trip, no shift with `TZ=America/Bogota` and `TZ=Pacific/Kiritimati`) (research.md R9)
- [X] T005 [P] Move `UUID_PATTERN` from `apps/api/src/cards/cards.service.ts` to `apps/api/src/common/uuid.ts` (`isUuid(id)`) and use it in `CardsService`; existing e2e stay green
- [X] T006 [P] Add `STATEMENT_OPEN` (409) to `ErrorCode` and `AppErrors.statementOpen()` in `apps/api/src/common/errors.ts`, and `AppErrors.cardArchivedPurchases()` reusing code `CARD_ARCHIVED` with message "Restore the card before changing its purchases" (contracts/errors.md)
- [X] T007 Create `apps/api/src/ledger/ledger.module.ts` and `apps/api/src/ledger/ledger.service.ts` with the transactional building blocks of research.md R5, all taking a Prisma transaction client: `lockOwnedCard(tx, userId, cardId)` (`SELECT … FOR UPDATE` filtered by `user_id`; returns the card or throws `AppErrors.notFound('Card not found')`, using `isUuid`), `todayFor(userId)` (user time zone + `Clock`, via `todayInTimeZone`), and `deleteEmptyUnpaidStatements(tx, cardId)` (FR-022); export the module
- [X] T008 Extend `apps/api/test/helpers.ts`: `createPurchase(token, cardId, overrides?)` (valid defaults: 300000, "Mercado", `2026-11-09`, 1 cuota), `listStatements(token, cardId)`, `statementByCutoff(token, cardId, cutoffDate)`, and `createCard` overrides for `annualRate`; confirm `resetDatabase` removes purchases, installments and statements through the cascade (assert the three tables are empty in one e2e)
- [X] T009 [P] Add `apps/mobile/src/api/purchases.ts` and `apps/mobile/src/api/statements.ts` with the types of contracts/purchases.openapi.yaml (`Purchase`, `PurchaseDetail`, `PlanInstallment`, `CreatePurchase`, `UpdatePurchase`, `Statement`, `StatementDetail`, `StatementInstallment`, `StatementStatus`) and the functions `listPurchases(cardId)`, `getPurchase(id)`, `createPurchase(cardId, input)`, `updatePurchase(id, input)`, `deletePurchase(id)`, `listStatements(cardId)`, `getStatement(id)`, `payStatement(id)`, `unpayStatement(id)` over `apiFetch`; add the new field texts and `STATEMENT_OPEN` / `CARD_ARCHIVED` (purchases) / `NOT_FOUND` texts of contracts/errors.md to `apps/mobile/src/api/errors.ts`
- [X] T010 [P] Implement `apps/mobile/src/components/StatusChip.tsx` per contracts/screens.md "StatusChip" (Abierto, Por pagar, Vencido, Pagado; always with text; theme tokens only; AA contrast) and add Abierto and Por pagar to the StatusChip section of `docs/design-system.md` (research.md R11)
- [X] T011 [P] Extend `apps/mobile/src/features/money.ts`: `formatCop` for negative amounts as `−$300.000` (U+2212), with the same `Intl` path as research.md R4 of spec 002

**Checkpoint**: tablas migradas con sus CHECK, `LedgerService` base listo, tipos de la app y StatusChip.

---

## Phase 3: User Story 1 - Cuotas e intereses correctos (Priority: P1) 🎯 MVP

**Goal**: Plan de cuotas, tasa mensual, redondeo y reglas de compra en `packages/domain`
(FR-001 a FR-005).

**Independent Test**: `pnpm --filter @corte/domain test:cov` en verde con cobertura ≥ 95%
(quickstart.md B1).

### Tests for User Story 1 (write first, must FAIL) ⚠️

- [X] T012 [P] [US1] Write Vitest tests in `packages/domain/src/rates.test.ts`: `validateAnnualRate` (0, 100, 26.82 valid; −0.01 and 100.01 → OUT_OF_RANGE; 26.825 → TOO_MANY_DECIMALS; float artifacts like 0.1 + 0.2 tolerated per research.md R2), `monthlyRate(24)` ≈ 0.018087582483510722, `monthlyRate(0)` = 0, `roundHalfUp` (2.5 → 3, 2.4999 → 2, 0 → 0), per data-model.md `Card.annualRate` and `Purchase.annualRate`
- [X] T013 [P] [US1] Write Vitest tests in `packages/domain/src/purchase-rules.test.ts`: `normalizeConcept` / `validateConcept` (trim, REQUIRED on spaces only, TOO_LONG at 61), `validateInstallmentCount` (1 and 72 valid; 0, 73 and 1.5 → OUT_OF_RANGE), `validatePurchaseDate(date, today)` (today valid; tomorrow → IN_FUTURE; exactly today − 72 months valid and one day earlier → TOO_OLD, including a month-end clamp such as today 2026-08-31 → minimum 2020-08-31 and today 2028-02-29 → 2022-02-28; malformed → INVALID), per data-model.md `Purchase.concept`, `Purchase.installmentCount` and `Purchase.purchaseDate`
- [X] T014 [P] [US1] Write Vitest tests in `packages/domain/src/installments.test.ts` with every scenario of spec User Story 1 (1–7): 3.090.000 / 30 → 30 × 103.000; 4.765.548 / 60 → 59 × 79.425 and 79.473; corte 8 / pago 25 from 2026-11-09 at 3 → cutoffs 2026-12-08, 2027-01-08, 2027-02-08 with due 25; 1 cuota at 26.82% → interest 0; 1.200.000 / 12 at 24% → 21.705, 19.896, 18.088 … 1.809; `noInterest` and `annualRate` null → 0; corte 31 from 2027-01-15 → 2027-01-31, 2027-02-28, 2027-03-31; plus a purchase on the cutoff day, a December purchase crossing the year, and `cutoffForMonthOffset` (offset 0, 1, 12, from a clamped February cutoff back to 31) (research.md R1). Add `describe('real Davivienda statement (SC-003)')` with corte 8 / pago 25, checking that the given installment falls in cutoff `2026-10-08` with due `2026-10-25` and its principal (interest is not compared, it is an estimate): 2026-06-13, 3.090.000 / 30 → installment 4, principal 103.000, remaining principal after it 2.678.000; 2026-06-11, 4.765.548 / 60 → installment 4, 79.425; 2026-05-22, 2.215.000 / 36 → installment 5, 61.527; 2026-07-01, 520.000 / 35 → installment 4, 14.857, remaining principal 460.572 (the bank reports 460.571: $1 difference from truncating each principal, accepted and documented in research.md R12); 2026-02-07, 360.000 / 12 → installment 9, 30.000; 2026-09-28, 60.000 / 6 with `noInterest` → installment 1, 10.000, interest 0
- [X] T015 [P] [US1] Write `packages/domain/src/installments.property.test.ts`: for every n in 1..72 and amounts {1, n − 1 (if ≥ 1), n, n + 1, 1.000.000, 3.090.000, 4.765.548, 999.999.937, 9.999.999.999} with rates {null, 0, 26.82} and `noInterest` {false, true}: n items numbered 1..n; sum of `principal` = amount; every principal ≥ 0 and all but the last equal `floor(amount / n)`; interest 0 when n = 1, `noInterest`, rate null or 0, and ≥ 0 otherwise; cutoffs strictly increasing and one month apart; each due date after its cutoff (FR-005, SC-001)

### Implementation for User Story 1

- [X] T016 [P] [US1] Implement `packages/domain/src/rates.ts` (`ANNUAL_RATE_MIN`, `ANNUAL_RATE_MAX`, `validateAnnualRate`, `monthlyRate`, `roundHalfUp`) and export it from `packages/domain/src/index.ts` (makes T012 pass)
- [X] T017 [P] [US1] Implement `packages/domain/src/purchase-rules.ts` (`PURCHASE_CONCEPT_MAX_LENGTH`, `INSTALLMENTS_MIN`, `INSTALLMENTS_MAX`, `PURCHASE_MAX_AGE_MONTHS`, `normalizeConcept`, `validateConcept`, `validateInstallmentCount`, `validatePurchaseDate`) per data-model.md `Purchase.concept`, `Purchase.installmentCount` and `Purchase.purchaseDate`, and export it (makes T013 pass)
- [X] T018 [US1] Implement `packages/domain/src/installments.ts` (`InstallmentPlanInput`, `InstallmentPlanItem`, `cutoffForMonthOffset`, `buildInstallmentPlan`) per research.md R1 and export it (makes T014 and T015 pass); confirm `pnpm --filter @corte/domain test:cov` keeps ≥ 95%

**Checkpoint**: el plan de cuotas es correcto y está probado; el API puede guardarlo.

---

## Phase 4: User Story 8 - Tasa de interés de la tarjeta (Priority: P2, adelantada)

**Goal**: `annualRate` en crear, editar y ver tarjetas, en el API y en el formulario de la app
(FR-006). Se adelanta porque US2 copia la tasa de la tarjeta en cada compra.

**Independent Test**: quickstart.md B2 y B11.1.

### Tests for User Story 8 (write first, must FAIL) ⚠️

- [X] T019 [US8] Add `describe('annualRate')` to `apps/api/test/cards.e2e-spec.ts`: `POST /cards` without `annualRate` → `null`; with `26.82` → `26.82`; `PATCH` to `24` and to `null`; 400 `annualRate/OUT_OF_RANGE` for −1 and 100.5 and `annualRate/TOO_MANY_DECIMALS` for 26.825; `GET /cards` and `GET /cards/:id` return it (data-model.md `Card.annualRate`)

### Implementation for User Story 8

- [X] T020 [US8] Add `annualRate` (per data-model.md `Card.annualRate`; optional, nullable, `validateAnnualRate` from `@corte/domain`, issue codes of contracts/errors.md) to `createCardSchema` and `updateCardSchema` in `apps/api/src/cards/cards.schemas.ts`; write it in `CardsService.create` / `update` and map `Decimal → number` with `Number(value.toFixed(2))` in `apps/api/src/cards/card.mapper.ts` (`PublicCard.annualRate`), with a case in `apps/api/src/cards/card.mapper.spec.ts` (makes T019 pass; research.md R2)
- [ ] T021 [P] [US8] Implement `apps/mobile/src/features/rate.ts`: `parseRateInput(text)` (accepts "26,82" and "26.82", empty → null, invalid → NaN for the schema) and `formatRate(rate)` → "26,82% EA"; add `annualRate` with `validateAnnualRate` to `apps/mobile/src/features/card-schema.ts`
- [ ] T022 [US8] Add the "Tasa de interés EA (%)" field (decimal keyboard, help text) after the budget in `apps/mobile/src/components/CardForm.tsx` per contracts/screens.md "Formulario de tarjeta"; show "Tasa: 26,82% EA" or "Sin tasa" in `apps/mobile/src/app/(app)/card/[id]/index.tsx`; add `annualRate` to the types in `apps/mobile/src/api/cards.ts`; after saving a card in `apps/mobile/src/app/(app)/card/[id]/edit.tsx`, invalidate `['statements', id]` and `['purchases', id]` besides the card queries, since a date change reschedules statements (SC-005)

**Checkpoint**: la tarjeta guarda su tasa y la app la edita y muestra.

---

## Phase 5: User Story 2 - Registrar una compra (Priority: P1)

**Goal**: `POST /cards/:id/purchases` y `GET /purchases/:id` con el plan, y el formulario de
compra con su confirmación (FR-008 a FR-013).

**Independent Test**: quickstart.md B3 y B11.2–B11.3.

### Tests for User Story 2 (write first, must FAIL) ⚠️

- [X] T023 [US2] Write e2e tests in `apps/api/test/purchases.e2e-spec.ts` (`describe('POST /cards/:id/purchases')`, `FIXED_NOW`): 201 with trimmed concept, `annualRate` copied from the card, `noInterest` false, and the plan of 1.200.000 / 12 from 2026-11-09 with corte 8 / pago 25 at 24% (first installment `2026-12-08` / `2026-12-25`, principal 100000, interest 21705, `statementStatus: "open"`); defaults → `purchaseDate` 2026-11-21 and 1 installment with interest 0; one statement per cutoff (two purchases in the same cycle share `statementId`); in the database, `SUM(principal)` = amount and the installment count = n; 400 per field of contracts/errors.md (`amount` 0 and above max, blank concept, 61 chars, `installmentCount` 0 and 73, `purchaseDate` 2026-11-22 → IN_FUTURE, 2020-11-20 → TOO_OLD, `2026-02-30` → INVALID, unknown field); amount above available credit → 201; archived card → 409 `CARD_ARCHIVED`; 401 without token and 403 `PASSWORD_CHANGE_REQUIRED` with a pending temporary password; `GET /purchases/:id` returns the same plan (data-model.md `Purchase.amount`, `Purchase.concept`, `Purchase.purchaseDate`, `Purchase.installmentCount`, `Purchase.noInterest`, `Purchase.annualRate`)

### Implementation for User Story 2

- [X] T024 [P] [US2] Implement `createPurchaseSchema` in `apps/api/src/purchases/purchases.schemas.ts` with zod and the `@corte/domain` validators (strict object, concept normalized, defaults `installmentCount` 1 and `noInterest` false; `purchaseDate` checked against "today" in the service, since it depends on the user)
- [X] T025 [US2] Add to `apps/api/src/ledger/ledger.service.ts` `writePlan(tx, card, purchase, today)`: builds the plan with `buildInstallmentPlan`, upserts each statement by `(card_id, cutoff_date)`, creates new statements with `due_date < today` as paid (`paid_at = today`) and sets their `paid_amount` to their total after inserting the installments (FR-030), leaves existing statements' payment untouched (FR-031), and inserts the installments (research.md R5); unit test the paid/unpaid decision in `apps/api/src/ledger/ledger.service.spec.ts`
- [X] T026 [P] [US2] Implement `apps/api/src/purchases/purchase.mapper.ts` (`toPurchase`, `toPurchaseDetail` with `PlanInstallment` incl. `statementId` and `statementStatus` from `statementStatus` of the domain; `fromDbDate`; `Decimal → number`)
- [X] T027 [US2] Create `apps/api/src/purchases/purchases.module.ts` (imports `LedgerModule`), `purchases.service.ts` (`create(userId, cardId, input)`: transaction → `lockOwnedCard` → 409 if archived → `validatePurchaseDate` with `todayFor` → insert purchase with `annual_rate` = card's rate → `writePlan` → `deleteEmptyUnpaidStatements`, always in this order: cleanup runs after `writePlan`, never before (research.md R5); `get(userId, id)` filtering by `card.userId`, same 404 for foreign, missing or non-UUID ids) and `purchases.controller.ts` (`POST /cards/:id/purchases` 201, `GET /purchases/:id`); register the module in `apps/api/src/app.module.ts` (makes T023 pass)
- [ ] T028 [P] [US2] Implement `apps/mobile/src/features/purchase-schema.ts` (zod with `@corte/domain` validators, Spanish messages of contracts/errors.md, `today` as a parameter for the date rule) and `apps/mobile/src/components/DateField.tsx` per contracts/screens.md "DateField" (`@react-native-community/datetimepicker`, `maximumDate` today, `minimumDate` today − 72 months, Spanish date label, ≥ 44, conversion to `IsoDate` from local year/month/day)
- [ ] T029 [US2] Implement `apps/mobile/src/components/PurchaseForm.tsx` (react-hook-form + `purchase-schema`; amount, concept, `DateField`, installments, "Sin intereses" switch; "Se aplicará 26,82% EA (estimado)" when the rate applies; API field errors mapped with `applyApiFieldErrors`; values kept on error) and `apps/mobile/src/app/(app)/card/[id]/purchases/new.tsx` (uses `cycle.today` and `availableCredit` from `getCard`; over-limit confirm of contracts/screens.md "Aviso de cupo"; on success shows "Primera cuota en el extracto del … · se paga el …" with "Ver compra" and "Listo"; invalidates `['cards']`, `['card', id]`, `['purchases', id]`, `['statements', id]`)
- [ ] T030 [US2] Add "Registrar compra" (primary, active cards only) to `apps/mobile/src/app/(app)/card/[id]/index.tsx` → `card/[id]/purchases/new`, and register the new routes inside the `Stack.Protected` of `apps/mobile/src/app/(app)/_layout.tsx`

**Checkpoint**: registrar una compra guarda su plan y la app muestra en qué extracto cae.

---

## Phase 6: User Story 3 - Ver extractos y su detalle (Priority: P1)

**Goal**: `GET /cards/:id/statements` y `GET /statements/:id`, y las pantallas de extractos
(FR-015 a FR-018).

**Independent Test**: quickstart.md B4–B5 y B11.5.

### Tests for User Story 3 (write first, must FAIL) ⚠️

- [X] T031 [P] [US3] Write Vitest tests in `packages/domain/src/statements.test.ts`: `statementStatus` for paid (any dates), today < cutoff and today = cutoff → open, cutoff < today = due date → due, today > due date → overdue; `budgetUsagePercent` (0, 45, 99.6 → 99, 100, 150, budget 1) (data-model.md "Estado")
- [X] T032 [US3] Write e2e tests in `apps/api/test/statements.e2e-spec.ts` (`FIXED_NOW`, corte 8 / pago 25): 401 without token and 403 `PASSWORD_CHANGE_REQUIRED` with a pending temporary password on both endpoints; list with `total` = sum of principal + interest, `hasInterest`, `installmentsInStatement`, `status` (2026-12-08 open, 2026-11-08 due) and FR-018 order (unpaid ascending, then paid descending); `GET /statements/:id` with installments (concept, purchaseDate, number, purchaseInstallmentCount, principal, interest) ordered by purchase date then number; empty card → `[]`; FR-030: a purchase on 2026-09-20 at 3 creates 2026-10-08 as `paid` with `paidAt` 2026-11-21 and `paidAmount` = its total, 2026-11-08 `due`, 2026-12-08 kept; FR-031: a second purchase on 2026-09-25 enters 2026-10-08, which stays `paid` with the same `paidAmount` and a higher `total` (data-model.md `Statement.cutoffDate`, `Statement.dueDate`, `Statement.paidAt`, `Statement.paidAmount`)

### Implementation for User Story 3

- [X] T033 [P] [US3] Implement `packages/domain/src/statements.ts` (`StatementStatus`, `statementStatus`, `budgetUsagePercent`) and export it (makes T031 pass)
- [X] T034 [P] [US3] Implement `apps/api/src/statements/statement.mapper.ts` (`toStatement`, `toStatementDetail`, totals from aggregates, `fromDbDate`)
- [X] T035 [US3] Create `apps/api/src/statements/statements.module.ts`, `statements.service.ts` (`listForCard(userId, cardId)` with one aggregate query for totals and the FR-018 sort; `get(userId, id)` filtering by `card.userId`, same 404 for foreign, missing or non-UUID ids) and `statements.controller.ts` (`GET /cards/:id/statements`, `GET /statements/:id`); register the module in `apps/api/src/app.module.ts` (makes T032 pass)
- [ ] T036 [P] [US3] Implement `apps/mobile/src/components/StatementRow.tsx` and `apps/mobile/src/components/InstallmentRow.tsx` per contracts/screens.md "Componentes" (estimado marks, `accessibilityLabel`, ≥ 44, tabular amounts)
- [ ] T037 [US3] Implement `apps/mobile/src/app/(app)/card/[id]/statements.tsx` (list in API order, empty state, refetch on focus, tap → `statement/[id]`) and `apps/mobile/src/app/(app)/statement/[id].tsx` (cutoff, due date, StatusChip, "A pagar" with estimado, installments, paid info with both amounts when they differ, 404 text); add "Extractos" to `apps/mobile/src/app/(app)/card/[id]/index.tsx`

**Checkpoint**: los extractos se ven con su total y estado, incluidos los pasados creados como pagados.

---

## Phase 7: User Story 4 - Marcar un extracto como pagado (Priority: P1)

**Goal**: `POST` y `DELETE /statements/:id/payment` y las acciones de la app (FR-019, FR-020).

**Independent Test**: quickstart.md B6 y B11.6.

### Tests for User Story 4 (write first, must FAIL) ⚠️

- [X] T038 [US4] Add `describe('payment')` to `apps/api/test/statements.e2e-spec.ts`: pay the 2026-11-08 statement (`due`) → 200 `paid`, `paidAt` 2026-11-21, `paidAmount` = total; repeat → 200 unchanged; pay an `overdue` one → 200; pay 2026-12-08 (`open`) → 409 `STATEMENT_OPEN`; `DELETE` → 200 back to `due` with nulls; repeat → 200 unchanged; both allowed on an archived card

### Implementation for User Story 4

- [X] T039 [US4] Implement `pay(userId, id)` and `unpay(userId, id)` in `apps/api/src/statements/statements.service.ts` (owned lookup, status with `todayFor`, idempotent, `paid_amount` = current total) and `POST` / `DELETE /statements/:id/payment` in `apps/api/src/statements/statements.controller.ts` (makes T038 pass)
- [ ] T040 [US4] Add "Marcar como pagado" (due/overdue, confirm with the amount) and "Deshacer pago" (paid, confirm) to `apps/mobile/src/app/(app)/statement/[id].tsx`, the "Podrás marcarlo pagado después del corte" text for open statements, loading state, and invalidation of `['statement', id]`, `['statements', cardId]`, `['cards']` and `['card', cardId]`

**Checkpoint**: pagar y deshacer funcionan en el API y en la app.

---

## Phase 8: User Story 5 - Cupo disponible real y deuda total (Priority: P1)

**Goal**: `totalDebt`, `availableCredit` real y `cycleBudgetUsage` en tarjetas, y su vista en el
carrusel y el detalle (FR-023, FR-024).

**Independent Test**: quickstart.md B3 (cupo) y B11.4.

### Tests for User Story 5 (write first, must FAIL) ⚠️

- [X] T041 [US5] Add `describe('credit and debt')` to `apps/api/test/cards.e2e-spec.ts`: new card → `totalDebt` 0 and `availableCredit` = `creditLimit`; after 1.200.000 / 12 → 1.200.000 and 3.800.000 in `GET /cards` and `GET /cards/:id`; paying the first installment's statement → 1.100.000 and 3.900.000 (interest never counts); a purchase above the limit → negative `availableCredit`; `cycleBudgetUsage` for 2026-12-08 with `amount` = that statement's total and `percent` via `budgetUsagePercent`; no statement for the next cutoff → amount 0, percent 0. The spec 002 assertions `availableCredit: 5_000_000` (test "creates a card with trimmed name, default reminders and no owner in the body") and `availableCredit: 8_000_000` (the `PATCH` test that edits to "Mastercard") stay as they are: those cards have no purchases

### Implementation for User Story 5

- [X] T042 [US5] Add `debtByCard(cardIds)` (one aggregate query over installments in unpaid statements) and `nextStatementTotal(cardId, cutoffDate)` to `apps/api/src/ledger/ledger.service.ts`; use them in `CardsService.list`, `getDetail`, `create` and `update` and in `apps/api/src/cards/card.mapper.ts` (`PublicCard.totalDebt`, real `availableCredit`, `CardDetail.cycleBudgetUsage`; update `card.mapper.spec.ts`) (makes T041 pass; research.md R8)
- [ ] T043 [US5] Show the real available credit (negative with "Superaste el cupo") in `apps/mobile/src/components/CreditCardView.tsx`, and "Deuda total" and "Tope del ciclo: N% · $X de $Y" (above 100%: "Superaste el tope") in `apps/mobile/src/app/(app)/card/[id]/index.tsx`; add `totalDebt` and `cycleBudgetUsage` to `apps/mobile/src/api/cards.ts`

**Checkpoint**: cupo, deuda y tope reflejan las compras y los pagos sin recargar.

---

## Phase 9: User Story 9 - Mis compras y extractos son solo míos (Priority: P1)

**Goal**: Aislamiento verificado en las 9 operaciones (FR-025, FR-026).

**Independent Test**: quickstart.md B9.

- [X] T044 [US9] Write `apps/api/test/purchases-isolation.e2e-spec.ts` with two users: user B on A's resources → `GET` and `POST /cards/:id/purchases`, `GET`, `PATCH` and `DELETE /purchases/:id`, `GET /cards/:id/statements`, `GET /statements/:id`, `POST` and `DELETE /statements/:id/payment` all 404 `NOT_FOUND` with the same body as a missing UUID and a non-UUID id; A's purchases, installments and statements unchanged afterwards (compare database rows); deleting user A's account removes their purchases, installments and statements and leaves B's intact. The operations that do not exist yet (`PATCH`/`DELETE /purchases/:id`, `GET /cards/:id/purchases`) are added to this file in US6

**Checkpoint**: ningún usuario ve ni cambia compras o extractos de otro.

---

## Phase 10: User Story 6 - Editar y borrar una compra (Priority: P2)

**Goal**: Lista de compras, `PATCH` y `DELETE /purchases/:id`, y sus pantallas (FR-013, FR-014,
FR-022).

**Independent Test**: quickstart.md B7 y B11.7.

### Tests for User Story 6 (write first, must FAIL) ⚠️

- [X] T045 [US6] Add `describe('GET /cards/:id/purchases')`, `describe('PATCH /purchases/:id')` and `describe('DELETE /purchases/:id')` to `apps/api/test/purchases.e2e-spec.ts`: list ordered by purchase date desc then createdAt desc; 12 → 6 installments gives 6 × 200.000 and removes the 2027-06-08…2027-11-08 statements that only had them; concept-only change keeps the same `statementId`s and installment ids; changing the date moves installments; after changing the card rate to 30, editing the amount keeps `annualRate` 24 (FR-007); editing or deleting a purchase with an installment in a paid statement → 200/204, the statement stays `paid` with its `paidAmount` (FR-031); delete → 204, empty unpaid statements removed, empty paid ones kept with `total` 0; cleanup order: undo the payment of a past statement created as paid (FR-030), then edit the purchase's amount → that statement is reused and stays unpaid (`overdue`), it is not deleted and recreated as paid; validation errors as in T023; archived card → 409 `CARD_ARCHIVED` on `PATCH` and `DELETE`; extend `apps/api/test/purchases-isolation.e2e-spec.ts` with the three operations (data-model.md `Purchase.annualRate`)

### Implementation for User Story 6

- [X] T046 [P] [US6] Add `updatePurchaseSchema` (any subset of create, at least one field, strict) to `apps/api/src/purchases/purchases.schemas.ts`
- [X] T047 [US6] Implement `list(userId, cardId)`, `update(userId, id, input)` and `remove(userId, id)` in `apps/api/src/purchases/purchases.service.ts` per research.md R6 (concept-only update without touching installments; otherwise delete installments and `writePlan` with the stored rate and the card's current days; delete; always `deleteEmptyUnpaidStatements` as the last step, after `writePlan`, so an emptied statement is reused instead of being recreated as paid; 409 on archived cards) and `GET /cards/:id/purchases`, `PATCH /purchases/:id`, `DELETE /purchases/:id` (204) in `apps/api/src/purchases/purchases.controller.ts` (makes T045 pass)
- [ ] T048 [US6] Implement `apps/mobile/src/app/(app)/card/[id]/purchases/index.tsx` (list, empty state, "Registrar compra" if active), `apps/mobile/src/app/(app)/purchase/[id]/index.tsx` (data and plan with StatusChip per installment; "Editar" and "Borrar" with confirmation when the card is active; read-only otherwise; 404 text) and `apps/mobile/src/app/(app)/purchase/[id]/edit.tsx` (reuses `PurchaseForm` with the stored rate; over-limit confirm on amount increase); add "Compras" to `apps/mobile/src/app/(app)/card/[id]/index.tsx`; invalidate as in T029

**Checkpoint**: corregir o borrar compras recalcula cuotas, extractos y cupo.

---

## Phase 11: User Story 7 - Recalcular extractos al cambiar las fechas de la tarjeta (Priority: P2)

**Goal**: `rescheduleInstallments` en el dominio y su uso en `PATCH /cards/:id` (FR-021, SC-007).

**Independent Test**: quickstart.md B8 y B11.8.

### Tests for User Story 7 (write first, must FAIL) ⚠️

- [X] T049 [P] [US7] Add `describe('rescheduleInstallments')` to `packages/domain/src/installments.test.ts`: spec User Story 7 scenario 1 (today 2026-11-23, purchase 2026-11-09 at 3, 8/25 → 15/2 gives 2026-12-15 / 2027-01-02, 2027-01-15 / 2027-02-02, 2027-02-15 / 2027-03-02); a purchase with closed installments keeps them and places the rest consecutively from the first open cutoff; today equal to the new cutoff day; corte 31 → 30; a later cutoff by rule wins over the first open one; no output for purchases without open installments (research.md R7)
- [X] T050 [US7] Write `apps/api/test/card-reschedule.e2e-spec.ts` (`FIXED_NOW`): with purchases spanning 2026-10-08 (paid), 2026-11-08 (due) and future cutoffs, `PATCH /cards/:id {"cutoffDay":15,"dueDay":2}` moves only installments of statements with `cutoff_date ≥ 2026-11-21`, creates the new statements, removes the emptied 8th-day ones, and leaves the closed statements' rows (dates, installments, `paid_at`, `paid_amount`) byte-identical; changing only `dueDay` updates the due date of the open statements; changing `name`, `creditLimit` or `annualRate` moves nothing; a paid statement with `cutoff_date` = today (set up through Prisma) is not moved (SC-007)

### Implementation for User Story 7

- [X] T051 [US7] Implement `rescheduleInstallments` in `packages/domain/src/installments.ts` and export it (makes T049 pass); confirm the ≥ 95% threshold
- [X] T052 [US7] Add `rescheduleOpenStatements(tx, card, newDays, today)` to `apps/api/src/ledger/ledger.service.ts` (reads installments of statements with `cutoff_date ≥ today` and `paid_at IS NULL` only, so a paid statement whose cutoff equals "today" after a time zone change is never moved, applies `rescheduleInstallments`, upserts target statements, moves `statement_id`, updates the due date of reused open statements, cleans up) and call it from `CardsService.update` inside a transaction that starts with `lockOwnedCard` when `cutoffDay` or `dueDay` change (makes T050 pass)

**Checkpoint**: cambiar las fechas de una tarjeta reprograma solo los extractos abiertos.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Documentación, revisión de diseño y validación completa.

- [ ] T053 [P] Update `docs/mvp-spec.md`: "Spec 003" as closed in "Orden de specs", rule 2 of "Cuotas" with floor and the remainder in the last installment, the Davivienda decision resolved, `purchases.installment_count` and `statements.paid_at` (DATE) in the data model table, and `GET /purchases/:id` in the API table; in `specs/002-cards/contracts/cards.openapi.yaml`, change the `availableCredit` description to "creditLimit − totalDebt desde la spec 003 (ver specs/003-purchases/contracts/purchases.openapi.yaml)"
- [X] T054 [P] Add `@ApiTags('purchases')` / `@ApiTags('statements')` and `@ApiBearerAuth()` to `apps/api/src/purchases/purchases.controller.ts` and `apps/api/src/statements/statements.controller.ts`, as in `apps/api/src/cards/cards.controller.ts`; in `README.md`, add a "Compras y extractos" section after "Tarjetas" with the table of the 9 new routes (same format), update the `availableCredit` bullet of "Tarjetas" (now `creditLimit − totalDebt`) and add `purchases`, `installments` and `statements` to the tables listed next to `db:migrate`
- [ ] T055 Review every new screen against `docs/design-system.md` (tokens only, no hand-written values; AA contrast of StatusChip variants on `surface`; touch areas ≥ 44 in rows, chips, switch and DateField; tabular amounts; "estimado" on every interest and interest-bearing total; states and over-limit/over-budget with text) and fix deviations (SC-008)
- [X] T056 Run `pnpm lint`, `pnpm typecheck`, `pnpm --filter @corte/domain test:cov`, `pnpm --filter api test` and `pnpm --filter api test:e2e`; build the API image with `docker build -f apps/api/Dockerfile .` (same file as the `docker-build` job)
- [ ] T057 Validate quickstart.md B1–B10 and B12 with curl and the test commands, including in B1 the real Davivienda cases of T014 (SC-003); B11 (app on iOS simulator and Android emulator, including `$1.200.000` and `−$300.000` on Android, the date picker limits, VoiceOver/TalkBack on StatusChip, rows and DateField) is validated manually by the user

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; blocks all user stories. T002 → T003 → T007 → T008; T004, T005, T006, T009, T010 and T011 in parallel.
- **US1 (Phase 3)**: depends on Foundational only (domain); can run in parallel with US8.
- **US8 (Phase 4)**: depends on Foundational (column `annual_rate`). Moved before US2 because each purchase copies the card's rate.
- **US2 (Phase 5)**: depends on US1 (`buildInstallmentPlan`, purchase rules) and US8 (rate in the card).
- **US3 (Phase 6)**: depends on US2 (purchases create statements); T031/T033 (domain) can start right after Foundational.
- **US4 (Phase 7)**: depends on US3 (statement service and screen).
- **US5 (Phase 8)**: depends on US2 (installments) and US4 (paid statements free credit).
- **US9 (Phase 9)**: depends on US2–US4; completed in US6 for the remaining operations.
- **US6 (Phase 10)**: depends on US2 and US3.
- **US7 (Phase 11)**: depends on US2 and US3 (statements to move); T049 can start after US1.
- **Polish (Phase 12)**: depends on all stories.

### Within Each User Story

- Tests first, and they must fail before implementing.
- Domain → schemas → ledger → service → controller → app screen.
- Shared files run sequentially (no [P]): `apps/api/test/cards.e2e-spec.ts`, `purchases.e2e-spec.ts`, `statements.e2e-spec.ts`, `apps/api/src/ledger/ledger.service.ts`, `apps/api/src/cards/*`, `apps/api/src/purchases/purchases.service.ts`, `apps/api/src/statements/statements.service.ts`, `apps/mobile/src/app/(app)/card/[id]/index.tsx`, `packages/domain/src/installments.ts`.

### Parallel Opportunities

- Foundational: T004, T005, T006, T009, T010, T011 together while T002 → T003 run.
- US1: T012, T013, T014 and T015 in parallel; then T016 and T017 in parallel; then T018.
- US1 (domain) in parallel with US8 API (T019–T020).
- US2: T024, T026 and T028 in parallel after T023.
- US3: T031 → T033 in parallel with the API tests (T032); T034 and T036 in parallel.
- US7: T049 in parallel with any API work once US1 is done.

---

## Parallel Example: User Story 1

```bash
Task: "T012 [US1] rates.test.ts"
Task: "T013 [US1] purchase-rules.test.ts"
Task: "T014 [US1] installments.test.ts"
Task: "T015 [US1] installments.property.test.ts"
# Then:
Task: "T016 [US1] rates.ts"
Task: "T017 [US1] purchase-rules.ts"
# Then:
Task: "T018 [US1] installments.ts"
```

## Parallel Example: User Story 2

```bash
# After T023 (e2e, failing):
Task: "T024 [US2] purchases.schemas.ts"
Task: "T026 [US2] purchase.mapper.ts"
Task: "T028 [US2] purchase-schema.ts and DateField.tsx"
# Then, in order: T025 (ledger.writePlan) → T027 (service + controller) → T029 → T030
```

---

## Implementation Strategy

### MVP First

1. Phase 1 + Phase 2.
2. Phase 3 (US1): the installment plan, verified with the real examples and properties.
3. Phase 4 (US8) and Phase 5 (US2): rate on the card and registering a purchase with its
   confirmation. **Stop and validate** with quickstart.md B1–B3 and B11.1–B11.3.

### Incremental Delivery

4. US3 (statements) → US4 (payment) → US5 (credit and debt): the full "cuánto y cuándo pago".
5. US9 (isolation) before any PR; completed with US6.
6. US6 (edit/delete) and US7 (reschedule on date change).
7. Polish: docs, design review, full checks and quickstart.
