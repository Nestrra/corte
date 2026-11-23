---

description: "Task list for spec 004 — Inicio y simulador"
---

# Tasks: Inicio y simulador

**Input**: Design documents from `/specs/004-home-simulator/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. La constitución exige pruebas primero en dominio y API (principio II), e2e de cada
endpoint contra PostgreSQL real y aislamiento entre usuarios (principio III); la spec pide pruebas
con dos usuarios y de que simular no escribe (FR-024) y cobertura del dominio ≥ 95% (SC-009). En
cada fase las pruebas se escriben antes de implementar y deben fallar primero. La app se valida a
mano (quickstart.md B8).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo (plan.md → Project Structure): `packages/domain/`, `apps/api/`, `apps/mobile/`. Las e2e
nuevas usan `createTestApp({}, { now: HOME_NOW })` con `HOME_NOW` = `2026-11-23T15:00:00Z`, es
decir **hoy = 2026-11-23** en America/Bogota. Con corte 8 y pago 25 ese día: el extracto del
2026-12-08 está `open` (ciclo actual, 15 días al corte), el del 2026-11-08 `due` (2 días a la fecha
límite) y el del 2026-10-08 `overdue` si existe y no está pagado. Las e2e de specs anteriores
siguen con `FIXED_NOW`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tokens y utilidades sin dependencias nuevas (research.md R13).

- [X] T001 [P] Add `layout.tabCenterButton = 56` and `interaction.staleOpacity = 0.85` to `apps/mobile/src/theme/spacing.ts` and document both tokens in the tokens table of `docs/design-system.md` (staleOpacity: "valores de una simulación que se recalcula; solo sobre `text`, `textSecondary` y `primaryStrong`", research.md R7)
- [X] T002 [P] Add `HOME_NOW = new Date('2026-11-23T15:00:00Z')` to `apps/api/test/helpers.ts` (comment: hoy = 2026-11-23 en Bogotá, spec 004) and a helper `countLedgerRows(app, cardId)` that returns the number of purchases, installments and statements of a card plus its `availableCredit` from `GET /cards/:id` (for SC-002)
- [X] T003 [P] Let `apiFetch` in `apps/mobile/src/api/client.ts` accept an optional `signal` and abort the request when either that signal or its own timeout fires (research.md R7); an abort caused by the caller's signal rethrows the abort instead of `NetworkError`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Reglas puras compartidas por el simulador y el inicio, y tipos de la app.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests (write first, must FAIL) ⚠️

- [X] T004 [P] Add tests to `packages/domain/src/statements.test.ts` for `budgetLevel` (data-model.md → "Reglas de presentación" `budgetLevel`: 0, 69 → `normal`; 70, 99 → `warning`; 100, 105 → `danger`; negative or non-integer → `RangeError`) and `paymentUrgency` (`paymentUrgency`: `due` with 6 → `normal`, 5 and 0 → `soon`; `overdue` with −1 → `overdue`; `due` with a negative value → `RangeError`)
- [X] T005 [P] Add tests to `packages/domain/src/statements.test.ts` for `nextPayment(statements, today)` (data-model.md → "Reglas de presentación" `nextPayment`): none → `null`; only open (cutoff ≥ today) or paid → `null`; one due → it; due and overdue → the overdue one (earliest `dueDate`); equal `dueDate` → lower cutoff; cutoff equal to today is still open (not chosen)

### Implementation

- [X] T006 Implement in `packages/domain/src/statements.ts` the constants `BUDGET_WARNING_PERCENT = 70`, `BUDGET_DANGER_PERCENT = 100`, `PAYMENT_SOON_DAYS = 5` and the functions `budgetLevel`, `paymentUrgency` and `nextPayment` (research.md R5, data-model.md → "Reglas de presentación"); export them and the types `BudgetLevel` and `PaymentUrgency` from `packages/domain/src/index.ts`; run `pnpm --filter @corte/domain test:cov` and `pnpm domain:build`
- [X] T007 [P] Add `apps/mobile/src/api/summary.ts` with the types of contracts/home.openapi.yaml (`Summary`, `CardSummary`, `NextPayment`) and `getSummary()` and `summaryKeys = { all: ['summary'] as const }`; add `Simulation`, `SimulatedInstallment`, `SimulatePurchase` and `simulatePurchase(cardId, input, signal?)` to `apps/mobile/src/api/purchases.ts`
- [X] T008 [P] Implement `apps/mobile/src/components/ProgressBar.tsx` per contracts/screens.md "ProgressBar" (fill color from `budgetLevel`, width `min(percent, 100)%`, `accessibilityRole="progressbar"`, `accessibilityValue` and a label with the real percent; tokens only) and `apps/mobile/src/features/days.ts` with `daysLeftText(n)` and `formatDayMonth(date)` ("25 nov") ("Hoy", "Mañana", "En N días", "Hace 1 día", "Hace N días")

**Checkpoint**: domain green with coverage ≥ 95%; app typecheck green.

---

## Phase 3: User Story 1 - Simular una compra mientras la registro (Priority: P1) 🎯 MVP

**Goal**: el formulario de registrar compra muestra, sin guardar, el extracto de la primera cuota,
el plan, los intereses, el tope del ciclo y el cupo después de la compra.

**Independent Test**: quickstart.md B2–B5 con curl y e2e; en la app, abrir "Registrar compra"
desde el detalle de una tarjeta y ver la simulación cambiar al escribir, salir sin guardar y ver
que nada cambió (B8.5–B8.6).

### Tests for User Story 1 (write first, must FAIL) ⚠️

- [X] T009 [P] [US1] Write `packages/domain/src/simulation.test.ts` for `simulatePurchase` (research.md R2; data-model.md → Simulation): the two spec criteria (300.000 a 3 cuotas el 2026-11-23 con corte 8 y pago 25 → cortes 2026-12-08/2027-01-08/2027-02-08, límite 2026-12-25 en la primera; 1.500.000 abierto + 600.000 a 1 cuota con tope 2.000.000 → `Simulation.cycleBudgetUsage.amountAfter` 2.100.000 y `percentAfter` 105); `Simulation.installments[].statementStatus` for an existing paid cutoff (`paid`), an existing unpaid past cutoff (`due` / `overdue`), a new cutoff whose due date passed (`paid`) and a new open one (`open`); a purchase whose first installment falls after the open cutoff (`amountAfter` = `amountBefore`); `Simulation.availableCredit.after` negative; no open statement yet → `Simulation.cycleBudgetUsage.amountBefore` 0 and `percentBefore` 0; `Simulation.totalInterest` = sum of the plan's interests (24% EA, 1.200.000 a 12 → same interests as spec 003); invalid input throws like `buildInstallmentPlan`
- [X] T010 [P] [US1] Write `apps/api/test/simulate.e2e-spec.ts` with `HOME_NOW`: quickstart.md B2 (plan, interests 5426/3618/1809, `totalInterest` 10853), B3 (75% → 105%, credit 3.500.000 → 2.900.000), B4 (negative credit; date 2026-11-05 → first cutoff 2026-11-08 `due` and unchanged budget; 400 `VALIDATION_ERROR` with `amount`, `installmentCount` and `purchaseDate` `IN_FUTURE`; `TOO_OLD`; `concept` → `UNKNOWN_FIELD`); defaults (no `purchaseDate` → today, no `installmentCount` → 1); a card without purchases → `amountBefore` 0 and `percentBefore` 0; archived card → 409 `CARD_ARCHIVED`; non-UUID and unknown id → 404; SC-002: `countLedgerRows` identical before and after 5 simulations; SC-001: simulating and then registering the same purchase give the same `cutoffDate`, `dueDate`, `principal` and `interest` per installment

### Implementation for User Story 1

- [X] T011 [US1] Implement `simulatePurchase` in `packages/domain/src/simulation.ts` per research.md R2 and data-model.md → Simulation (`Simulation.installments`, `Simulation.totalInterest`, `Simulation.cycleBudget`, `Simulation.cycleBudgetUsage`, `Simulation.availableCredit`), reusing `buildInstallmentPlan`, `statementStatus` and `budgetUsagePercent`; export it and its types from `packages/domain/src/index.ts`; make T009 pass; run `pnpm --filter @corte/domain test:cov` (≥ 95%) and `pnpm domain:build`
- [X] T012 [US1] Add `simulatePurchaseSchema = createPurchaseSchema.omit({ concept: true })` to `apps/api/src/purchases/purchases.schemas.ts` (research.md R3; contracts/home.openapi.yaml → SimulatePurchase)
- [X] T013 [US1] Add `simulate(userId, cardId, input)` to `apps/api/src/purchases/purchases.service.ts`, read-only (no transaction, no lock): find the card owned by the user (404 otherwise, with `isUuid`), reject archived with `AppErrors.cardArchivedPurchases()`, validate `IN_FUTURE` / `TOO_OLD` with the user's today exactly like `create`, read the current cycle (`nextCutoff`), the open statement total (`LedgerService.totalForCutoff`), the debt (`debtByCard`) and the card's statements with cutoff within the plan range (`cutoffDate`, `paidAt`), call `simulatePurchase` and return contracts/home.openapi.yaml → Simulation, including data-model.md → `Simulation.cycleBudget` (the card's cycle budget); extract the shared date validation of `create` into a private helper instead of duplicating it
- [X] T014 [US1] Add `@Post('cards/:id/simulate')` with `@HttpCode(200)` and `ZodValidationPipe(simulatePurchaseSchema)` to `apps/api/src/purchases/purchases.controller.ts`; make T010 pass with `pnpm --filter api test:e2e -- simulate`
- [X] T015 [P] [US1] Add `apps/mobile/src/features/use-debounced-value.ts` (`useDebouncedValue<T>(value, delayMs)`, compares by JSON so equal objects do not restart the timer)
- [X] T016 [US1] Implement `apps/mobile/src/components/SimulationPanel.tsx` per contracts/screens.md "SimulationPanel": first installment line (+ StatusChip if not open), "Tope del ciclo (estimado): X% → Y%" with ProgressBar of the after level and "$A de $B" or "No cambia el tope de este ciclo", "Cupo disponible después", "Intereses estimados" or "Sin intereses", the plan with `InstallmentRow` (status chip per installment; rows memoized by installment number and values so 72 rows do not slow typing), the two warnings in `dangerSoft` with `accessibilityLiveRegion="polite"`, the "what is missing" line, "Calculando…" the first time, and while `stale` the last values at `interaction.staleOpacity` with "Actualizando…" and `accessibilityState.busy` — dimming only figures, dates and bar, never warnings nor StatusChips (research.md R7); error with "Reintentar"
- [X] T017 [US1] Extend `apps/mobile/src/components/PurchaseForm.tsx`: new optional props `cardId` and `simulate` (on for registering, off for editing); watch amount, date, installments and "Sin intereses", validate them with the local schema, debounce 350 ms and `useQuery({ queryKey: ['simulation', cardId, input], queryFn: ({ signal }) => simulatePurchase(cardId, input, signal), enabled: valid, placeholderData: keepPreviousData, staleTime: 0, gcTime: 30_000 })`; pass `isPlaceholderData` as `stale` to `SimulationPanel` (rendered between "Sin intereses" and the buttons); a simulation error never blocks "Guardar"; the props `annualRate`, `availableCredit` and `cardId` can change without resetting the form (research.md R9)
- [X] T018 [US1] Create `apps/mobile/src/app/(app)/purchase/new.tsx` (param `cardId`) with the registration flow of `card/[id]/purchases/new.tsx` (confirmation, "Ver compra" replaces with `purchase/[id]`, "Listo" → `router.back()`) and `PurchaseForm` with `simulate`; register it in `apps/mobile/src/app/(app)/_layout.tsx`, point "Registrar compra" of `card/[id]/index.tsx` and of `card/[id]/statements.tsx` to `/purchase/new?cardId=`, delete `apps/mobile/src/app/(app)/card/[id]/purchases/new.tsx` and its route, and update the "Registrar compra" button of `card/[id]/purchases/index.tsx`

**Checkpoint**: US1 complete: simulation in the API (e2e green) and in the form from the card detail.

---

## Phase 4: User Story 6 - La simulación es solo mía (Priority: P1)

**Goal**: aislamiento de `simulate` (y de `summary` cuando exista, T024).

**Independent Test**: `pnpm --filter api test:e2e -- home-isolation`.

- [X] T019 [US6] Write `apps/api/test/home-isolation.e2e-spec.ts` with two users (A with an active and an archived card, B with one card): B simulating on A's active card and on A's archived card gets 404 `NOT_FOUND` with the same body as an unknown id (FR-023, SC-007); A simulating on A's card works. Leave a `describe('GET /summary')` block to be filled in T024

---

## Phase 5: User Story 2 - Resumen de la tarjeta al frente en el inicio (Priority: P1)

**Goal**: el inicio muestra saludo, carrusel y CycleSummary de la tarjeta al frente.

**Independent Test**: quickstart.md B6 con curl; en la app, B8.1–B8.3.

### Tests for User Story 2 (write first, must FAIL) ⚠️

- [X] T020 [P] [US2] Write `apps/api/test/summary.e2e-spec.ts` with `HOME_NOW`: user without cards → `{ today: '2026-11-23', cards: [] }` (data-model.md → `HomeSummary.today`); data-model.md → `HomeSummary.cards[]`: archived cards are left out and the order matches `GET /cards`; per card (data-model.md → HomeSummary): `HomeSummary.cards[].nextPayment` for a 2026-11-05 purchase (`statementId`, cutoff 2026-11-08, due 2026-11-25, `amount` with interest, `status` `due`, `daysLeft` 2), `overdue` with negative `daysLeft` (create the purchase with the clock at 2026-10-20, then read with `HOME_NOW`), the overdue one chosen over a due one, `null` after paying; `HomeSummary.cards[].nextCutoff` 2026-12-08 / 2026-12-25 / 15; `HomeSummary.cards[].cycleBudgetUsage` equal to `GET /cards/:id`; `HomeSummary.cards[].card` equal to the `GET /cards` item

### Implementation for User Story 2

- [X] T021 [US2] Add `totalsForCutoffs(pairs: { cardId, cutoffDate }[])` to `apps/api/src/ledger/ledger.service.ts` (one aggregated query, `Map<cardId, bigint>`, 0 when the statement does not exist) with a unit test in `ledger.service.spec.ts`
- [X] T022 [US2] Create `apps/api/src/summary/summary.module.ts`, `summary.service.ts` and `summary.controller.ts` (`GET /summary`) per research.md R4 and data-model.md → HomeSummary: `HomeSummary.today` (user's today), `HomeSummary.cards[]` (active cards only, in the `GET /cards` order), `debtByCard`, unpaid statements with cutoff < today of those cards and their totals (`totalsByStatement`), `nextPayment` from the domain, `nextCutoff` with `daysBetween`, open totals with `totalsForCutoffs`; a fixed number of queries; reuse `toPublicCard` and the `cycleBudgetUsage` shape of `CardsService.getDetail`; register `SummaryModule` in `apps/api/src/app.module.ts`; make T020 pass
- [X] T023 [P] [US2] Add `onActiveChange?(card)` to `apps/mobile/src/components/CardCarousel.tsx` (called on mount, after each swipe and when the list changes; contracts/screens.md "CardCarousel") and create `apps/mobile/src/features/front-card-store.ts` (Zustand, memory only: `frontCardId`, `setFrontCardId`; data-model.md → "Estado en la app" `front-card-store.frontCardId`)
- [X] T024 [US2] Fill the `GET /summary` block of `apps/api/test/home-isolation.e2e-spec.ts`: each user only sees their own cards and figures; B's summary never contains A's card ids
- [X] T025 [US2] Implement `apps/mobile/src/components/CycleSummary.tsx` per contracts/screens.md "CycleSummary": header "Resumen de <tarjeta>" in a polite live region; "Próximo pago" row (amount, "Paga hasta 25 nov", `daysLeftText`, chip "Pronto" or "Vencido" from `paymentUrgency` on `warningSoft` / `dangerSoft`, or "Sin pagos pendientes"; tap → `statement/[statementId]`); "Próximo corte" row; "Ciclo actual" row with "Tope del ciclo (estimado)", "N% · $X de $Y", `ProgressBar` and "Superaste el tope" from 100% (tap → `card/[id]/statements`); rows ≥ 44 with full-sentence accessibility labels
- [X] T026 [US2] Rewrite `apps/mobile/src/app/(app)/(tabs)/home.tsx`: "Hola, <nombre>", SectionHeader "Mis tarjetas" + "Agregar" (→ `card/new`), `CardCarousel` with the summary's cards and `onActiveChange` → `setFrontCardId`, and `CycleSummary` of the front card (falling back to the first when the stored id is not active); loading with label "Cargando inicio" and `QueryError`; `useQuery({ queryKey: summaryKeys.all, queryFn: getSummary })` with `useRefetchOnFocus`

**Checkpoint**: US2 complete: `GET /summary` green and the home shows the summary that follows the carousel.

---

## Phase 6: User Story 3 - Botón central "Registrar compra" (Priority: P1)

**Goal**: el botón central abre el registro desde cualquier pestaña con la tarjeta al frente y un
selector.

**Independent Test**: quickstart.md B8.4 y B8.7.

- [X] T027 [P] [US3] Implement `apps/mobile/src/components/CardPicker.tsx` per contracts/screens.md "CardPicker" (selected card name and "·· 1234", "Cambiar" only with more than one card, options with `accessibilityRole="radio"` and `checked`, every row ≥ 44)
- [X] T028 [US3] Add `apps/mobile/src/app/(app)/(tabs)/register.tsx` (renders nothing) and register it between `cards` and `profile` in `apps/mobile/src/app/(app)/(tabs)/_layout.tsx`; in `apps/mobile/src/components/TabBar.tsx` draw the `register` route as the 56 center button (`layout.tabCenterButton`, `primary`, `add` icon in `onPrimary`, `accessibilityRole="button"`, label "Registrar compra"), which pushes `/purchase/new` with `cardId` = `frontCardId` instead of switching tabs (research.md R8); update the TabBar comments and its entry in `docs/design-system.md`
- [X] T029 [US3] In `apps/mobile/src/app/(app)/purchase/new.tsx` load the active cards (`listCards()`), select `cardId` (param) when it is among the active cards, otherwise the first active one (an archived or deleted front card falls back; spec edge case "Tarjeta al frente archivada o borrada"), render `CardPicker` above the form and pass the selected card's `annualRate`, `availableCredit`, `today` and `id` to `PurchaseForm` without remounting it (written values kept, simulation re-requested; research.md R9); save with the selected card

**Checkpoint**: US3 complete: registering and simulating from any tab.

---

## Phase 7: User Story 4 - Inicio sin tarjetas (Priority: P2)

**Goal**: invitación a crear la primera tarjeta en el inicio y en el registro.

**Independent Test**: quickstart.md B8.9.

- [X] T030 [P] [US4] Implement `apps/mobile/src/components/EmptyCards.tsx` per contracts/screens.md "EmptyCards" ("Agrega tu primera tarjeta", "Así sabrás cuánto y cuándo pagar cada tarjeta", button "Agregar tarjeta" → `card/new`, with an optional `replace` to use `router.replace`)
- [X] T031 [US4] Use `EmptyCards` in `apps/mobile/src/app/(app)/(tabs)/home.tsx` when `summary.cards` is empty (instead of the carousel and the summary) and in `apps/mobile/src/app/(app)/purchase/new.tsx` when there are no active cards (with `replace`)

---

## Phase 8: User Story 5 - El inicio siempre al día (Priority: P2)

**Goal**: toda mutación de compras, pagos y tarjetas invalida `['summary']`; el inicio se refresca
al volver a primer plano.

**Independent Test**: quickstart.md B8.8.

- [X] T032 [US5] In `apps/mobile/src/features/ledger-cache.ts` add `summaryKeys.all` to `invalidateCardLedger` and create `invalidateCards(queryClient)` (`['cards']` + `['summary']`) (research.md R11)
- [X] T033 [US5] Route every card, purchase and payment mutation through those helpers and remove direct `invalidateQueries` calls: `apps/mobile/src/app/(app)/card/new.tsx` (create → `invalidateCards`), `card/[id]/index.tsx` (archive and restore → `invalidateCards` + the detail), `card/[id]/edit.tsx`, `purchase/new.tsx`, `purchase/[id]/index.tsx`, `purchase/[id]/edit.tsx` and `statement/[id].tsx` (→ `invalidateCardLedger`); confirm with `grep -rn invalidateQueries apps/mobile/src/app` that none is left
- [X] T034 [P] [US5] Add `apps/mobile/src/features/use-refetch-on-app-active.ts` (`AppState` → `active` calls `refetch`) and use it in `apps/mobile/src/app/(app)/(tabs)/home.tsx`

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T035 [P] Update `docs/design-system.md`: components CycleSummary (urgency chips "Pronto" / "Vencido"), ProgressBar (accessibility), CardPicker, SimulationPanel (dimming rule and its contrast) and EmptyCards; check every new color pair is in the measured list (AA)
- [X] T036 [P] Update `docs/mvp-spec.md`: `POST /cards/:id/simulate` and `GET /summary` descriptions with links to `specs/004-home-simulator/contracts/home.openapi.yaml`; and `README.md` with a short "Inicio y simulador" section
- [X] T037 Design review of the new screens against `docs/design-system.md` and contracts/screens.md (tokens only, no hand-written values, touch areas ≥ 44, tabular amounts, states with text, AA contrast including dimmed values; with $9.999.999.999 nothing is cut or overflows in CycleSummary, SimulationPanel and CardPicker); fix what is found
- [ ] T038 Run quickstart.md B1–B7 (curl and test commands) and `pnpm lint && pnpm format:check && pnpm typecheck`, `pnpm --filter @corte/domain test:cov`, `pnpm --filter api test && pnpm --filter api test:e2e`, and `pnpm --filter mobile exec expo export` for iOS and Android; B8 (app on iOS simulator and Android emulator) is validated manually by the user
- [ ] T039 After B8 passes, mark spec 004 as "(cerrada)" in "Orden de specs" of `docs/mvp-spec.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup; blocks every story (domain rules, app types,
  ProgressBar).
- **US1 (Phase 3)**: after Foundational. MVP.
- **US6 (Phase 4)**: after T014 (needs the endpoint); its summary part (T024) after T022.
- **US2 (Phase 5)**: after Foundational; independent from US1 on the API side.
- **US3 (Phase 6)**: after US1 (T018, `purchase/new`) and T023 (front card store).
- **US4 (Phase 7)**: after US2 (home) and T029 (registration with cards).
- **US5 (Phase 8)**: after US2 (summary keys in use); T033 touches files of US1 and US3.
- **Polish (Phase 9)**: after all stories.

### Within Each User Story

- Tests first and failing; domain before API; API before the app; components before screens.
- `pnpm domain:build` after each domain change, before API typecheck.

### Parallel Opportunities

- Setup: T001, T002, T003.
- Foundational: T004 ‖ T005 (same file, different `describe`: coordinate), T007 ‖ T008.
- US1: T009 ‖ T010 ‖ T015; then T011 → T012 → T013 → T014; T016 → T017 → T018.
- US2: T020 ‖ T023; T021 → T022 → T024; T025 → T026.
- US1 (API) and US2 (API) can advance in parallel after Foundational.
- Polish: T035 ‖ T036.

---

## Parallel Example: User Story 1

```text
Task: "T009 simulation.test.ts in packages/domain"
Task: "T010 simulate.e2e-spec.ts in apps/api/test"
Task: "T015 use-debounced-value.ts in apps/mobile/src/features"
```

## Parallel Example: User Story 2

```text
Task: "T020 summary.e2e-spec.ts in apps/api/test"
Task: "T023 CardCarousel onActiveChange + front-card-store.ts"
```

---

## Implementation Strategy

### MVP First

1. Setup + Foundational.
2. US1: simulation in the domain, the API and the form from the card detail.
3. **Stop and validate**: quickstart.md B2–B5 and the e2e.

### Incremental Delivery

1. US1 + US6 (simulate isolation) → simulator usable.
2. US2 (+ T024) → real home.
3. US3 → center button from any tab.
4. US4 + US5 → empty state and always up to date.
5. Polish → docs, design review, quickstart, B8 by the user, close the spec.
