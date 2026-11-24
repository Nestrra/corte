---

description: "Task list for spec 005 — Pagos recurrentes"
---

# Tasks: Pagos recurrentes

**Input**: Design documents from `/specs/005-recurring-payments/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. La constitución exige pruebas primero en dominio y API (principio II), e2e de cada
endpoint contra PostgreSQL real y aislamiento entre usuarios (principio III); la spec pide pruebas
del dominio con meses cortos, febrero bisiesto y cambio de año (FR-022), pruebas con dos usuarios
para cada operación (FR-021) y cobertura del dominio ≥ 95% (SC-009). En cada fase las pruebas se
escriben antes de implementar y deben fallar primero. La app se valida a mano (quickstart.md B10).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo (plan.md → Project Structure): `packages/domain/`, `apps/api/`, `apps/mobile/`. Las e2e
nuevas usan `createTestApp({}, { now: HOME_NOW })` con `HOME_NOW` = `2026-11-23T15:00:00Z`, es
decir **hoy = 2026-11-23** en America/Bogota (mes actual 2026-11, `bounds.last` 2027-11). Los
casos con otro "hoy" (reanudar, cambio de día) usan una segunda app con otro reloj, como el caso
vencido de `summary.e2e-spec.ts`. Después de cada cambio del dominio se corre
`pnpm --filter @corte/domain build` antes del typecheck del API.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ayudas de prueba y el código de error nuevo.

- [X] T001 [P] Add e2e helpers to `apps/api/test/helpers.ts`: `createRecurring(app, token, body)` (POST `/recurring`, returns the body), `monthView(app, token, month)` (GET `/recurring/occurrences?month=`) and `occurrenceByName(view, name)`; confirm `resetDatabase` also empties the new tables through the `users` cascade
- [X] T002 [P] Add `RECURRING_DELETED` to `ErrorCode` and `AppErrors.recurringDeleted()` (409, "The recurring payment was deleted; its paid history cannot be undone") in `apps/api/src/common/errors.ts`, and its Spanish text "Este pago fue eliminado; lo pagado no se puede deshacer" plus the field codes `TOO_OLD`, `TOO_FAR`, `IN_PAST` and `BEFORE_LAST_DUE` for the recurring form in `apps/mobile/src/api/errors.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Reglas puras del calendario, tablas y base del módulo `recurring`, tipos y piezas
comunes de la app.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests (write first, must FAIL) ⚠️

- [X] T003 [P] Write the calendar tests in `packages/domain/src/recurring.test.ts` (research.md R1): `periodOf` (`'2027-03'` / `'2027'`); `dueDateFor` monthly with anchor 2027-01-31 → 2027-02-28, 2027-03-31, 2027-04-30 (spec criterion), anchors on day 29, 30 and 31 in February 2027 and 2028 (leap: 2028-02-29), year change (anchor 2026-12-15 → 2027-01-15); annual with anchor 2028-02-29 → 2029-02-28 and 2032-02-29, anchor 2027-03-10 → only March; `nextDueOnOrAfter` (same day counts, day already passed → next period, annual past date → next year); `duePeriods` (range limits inclusive, nothing before `startsOn`, paused → periods up to `periodOf(pausedOn)` included and none after, deleted → none, ascending order, annual inside a monthly range)
- [X] T004 [P] Write the rule tests in `packages/domain/src/recurring.test.ts` in a separate `describe` (research.md R2): `occurrenceStatus` (paid; due yesterday → `overdue`; due today → `pending`); `summarizeMonth` with the November criterion (1.200.000 and 95.000 paid, 65.000 pending, 120.000 overdue → total 1.480.000, paid 1.295.000, remaining 185.000; with paid amount 70.000 → 1.485.000 / 1.365.000 / 120.000), order overdue → pending → paid, ties by `dueDate` then name, empty list → zeros; `nextDueDate` (skips paid periods, respects `startsOn`, paused → null); `monthBounds` (no payments → current month; earliest later than today → current; earliest earlier → its month; `last` = current + 12); `validateRecurringName` (same as card names), `validateFirstDueDate` (2026-11-01 ok, 2026-10-31 `TOO_OLD`, 2027-11-23 ok, 2027-11-24 `TOO_FAR`, invalid date) and `validateNextDueDate` (today ok, yesterday `IN_PAST`, today + 12 months ok, one more day `TOO_FAR`)

### Implementation

- [X] T005 Implement `packages/domain/src/recurring.ts` per research.md R1 and R2: `RecurringFrequency`, `PeriodKey`, `Schedule` (data-model.md → Schedule), `periodOf`, `dueDateFor`, `nextDueOnOrAfter`, `duePeriods`, `occurrenceStatus`, `summarizeMonth`, `nextRecurringDueDate` (named so because `cycles.ts` already exports `nextDueDate`), `monthBounds`, `RECURRING_NAME_MAX_LENGTH = 40`, `validateRecurringName` (data-model.md → `RecurringPayment.name`, reusing the card name normalization), `validateFirstDueDate` (data-model.md → `RecurringPayment.firstDueDate`) and `validateNextDueDate` (data-model.md → Validación (Editar, `nextDueDate`)); amounts use `validateAmount` (data-model.md → `RecurringPayment.amount`, `RecurringOccurrence.expectedAmount`, `RecurringOccurrence.paidAmount`); export everything from `packages/domain/src/index.ts`; make T003 and T004 pass; run `pnpm --filter @corte/domain test:cov` (≥ 95%) and `pnpm --filter @corte/domain build`
- [X] T006 Add to `apps/api/prisma/schema.prisma` the enum `RecurringFrequency` (`monthly`, `annual`, mapped to `recurring_frequency`), the models `RecurringPayment` and `RecurringOccurrence` and `User.recurringPayments`, with the columns, types, cascades, unique key and indexes of data-model.md → `RecurringPayment.userId`, `RecurringPayment.name`, `RecurringPayment.amount`, `RecurringPayment.frequency`, `RecurringPayment.firstDueDate`, `RecurringPayment.anchorDate`, `RecurringPayment.startsOn`, `RecurringPayment.pausedOn`, `RecurringPayment.deletedAt`, `RecurringOccurrence.recurringPaymentId`, `RecurringOccurrence.period`, `RecurringOccurrence.dueDate`, `RecurringOccurrence.expectedAmount`, `RecurringOccurrence.paidAt` and `RecurringOccurrence.paidAmount`; generate the migration `recurring_payments` with `pnpm --filter api db:migrate --name recurring_payments` and add by hand the CHECKs of data-model.md (amounts in range, name length, period pattern; no CHECK between `starts_on` and `first_due_date`, `(paid_at IS NULL) = (paid_amount IS NULL)`); run `pnpm --filter api prisma:generate`
- [X] T007 Create `apps/api/src/recurring/recurring.module.ts`, `recurring.schemas.ts` (zod with the domain validators: create, update with at least one field and `frequency` requiring `nextDueDate`, pay with optional `amount`, `month` query `YYYY-MM` → `INVALID`), `recurring.mapper.ts` (rows → contracts/recurring.openapi.yaml `RecurringPayment`, `Occurrence` and `MonthView`, `BIGINT` through `toNumberAmount`, dates through `fromDbDate`) and `recurring.service.ts` with the shared internals of research.md R4 and R5: `lockUserPayments(tx, userId)` (`FOR UPDATE` ordered by id, non-deleted), `lockOwnedPayment(tx, userId, id)` (404 for missing, foreign, deleted or non-UUID), `materializeMonth(tx, payments, month)` and `materializeThrough(tx, payment, today)` (`duePeriods` + `createMany({ skipDuplicates: true })` with the payment amount), and `monthView(userId, month, db?)` (transaction: lock, materialize the month, read the month's occurrences of the user — including paused payments and paid ones of deleted payments — with the payment name, `summarizeMonth`, `monthBounds` from `min(first_due_date)` including deleted, `hasPayments`); register `RecurringModule` in `apps/api/src/app.module.ts` and export `RecurringService`
- [X] T008 [P] Add `apps/mobile/src/api/recurring.ts` with the types of contracts/recurring.openapi.yaml (`RecurringPayment`, `Occurrence`, `OccurrenceStatus`, `MonthView`, `CreateRecurringPayment`, `UpdateRecurringPayment`), one function per endpoint and `recurringKeys` (`all: ['recurring']`, `list()`, `detail(id)`, `month(month)`, `occurrence(id)`, all under `['recurring']`); add `apps/mobile/src/features/recurring-cache.ts` with `invalidateRecurring(queryClient)` that invalidates `['recurring']` and `['summary']` (research.md R11)
- [X] T009 [P] Add the shared UI pieces (research.md R12, contracts/screens.md): the `pending` variant ("Pendiente", `warning` on `warningSoft`) in `apps/mobile/src/components/StatusChip.tsx` (widen its type to statement and occurrence statuses); `apps/mobile/src/components/StatTile.tsx` (label, `amount` variant with `tabular-nums` and `adjustsFontSizeToFit`, optional secondary line); `apps/mobile/src/components/RecurringRow.tsx` (name and short date left, amount — `paidAmount ?? expectedAmount` — and StatusChip right, tappable ≥ 44, accessible label "Gimnasio, 10 de noviembre, $120.000, vencido"); `apps/mobile/src/features/months.ts` (`monthLabel('2026-11')` → "noviembre de 2026", `shiftMonth`, `currentMonth(today)`, `frequencyText(payment)` → "Mensual · día 5" / "Anual · 10 mar")

**Checkpoint**: domain green with coverage ≥ 95%; migration applied in `corte_dev` and `corte_test`; API and app typecheck green.

---

## Phase 3: User Story 1 - Crear un pago recurrente y ver sus vencimientos (Priority: P1) 🎯 MVP

**Goal**: crear pagos mensuales y anuales y ver sus vencimientos anclados mes a mes.

**Independent Test**: quickstart.md B2 con curl y las e2e; en la app, crear un pago desde
"Nuevo pago" (B10.5).

### Tests for User Story 1 (write first, must FAIL) ⚠️

- [X] T010 [P] [US1] Write `apps/api/test/recurring.e2e-spec.ts` (create, list, detail) with `HOME_NOW`: POST `/recurring` → 201 with `status` `active`, `anchorDate` = `firstDueDate`, trimmed name and `nextDueDate`; validation 400 with `name` `REQUIRED`/`TOO_LONG`, `amount` `OUT_OF_RANGE` (0, decimals, above the maximum), `frequency` `INVALID`, `firstDueDate` `INVALID`, `TOO_OLD` (2026-10-31) and `TOO_FAR` (2027-11-24), unknown field `UNKNOWN_FIELD`; first due 2026-11-05 → `nextDueDate` 2026-12-05 and the November occurrence `overdue`; GET `/recurring` ordered active first and by name; GET `/recurring/:id` → 200, non-UUID and unknown → 404
- [X] T011 [P] [US1] Write `apps/api/test/occurrences.e2e-spec.ts` (month view) with `HOME_NOW`: quickstart.md B2 (anchor 2027-01-31 → 2027-02-28, 2027-03-31, 2027-04-30; nothing in 2026-12), annual 2027-03-10 only in 2027-03, monthly 2026-12-15 → 2027-01-15; `bounds` (first = current month without earlier payments, last 2027-11); `month` `2028-01` → 400 `OUT_OF_RANGE`, `2026-13` and `nov` → 400 `INVALID`; a user without payments → `hasPayments` false and zero totals; asking the same month twice returns the same occurrence ids; two simultaneous GET of the same month (`Promise.all`) leave exactly one occurrence per payment and period (count rows with Prisma)

### Implementation for User Story 1

- [X] T012 [US1] Implement in `apps/api/src/recurring/recurring.service.ts` `create` (validate `firstDueDate` with the user's today; store `first_due_date = anchor_date = starts_on`), `list` (non-deleted, active first then name, `nextDueDate` with the paid periods of each payment) and `get`; add `apps/api/src/recurring/recurring.controller.ts` with `GET /recurring`, `POST /recurring` (201) and `GET /recurring/:id`; make the T010 cases pass
- [X] T013 [US1] Add `GET /recurring/occurrences?month=` to `apps/api/src/recurring/recurring.controller.ts`, declared before `GET /recurring/:id`, calling `monthView` and rejecting months outside `bounds` with `month: OUT_OF_RANGE`; make T011 pass with `pnpm --filter api test:e2e -- occurrences`
- [X] T014 [P] [US1] Add `apps/mobile/src/features/recurring-schema.ts` (create and edit form schemas with the domain validators and the same codes as the API) and `apps/mobile/src/components/RecurringForm.tsx` (Nombre, Monto esperado, Frecuencia as radio options ≥ 44, a date field labeled "Primer vencimiento" or "Próximo vencimiento" by prop, field errors with text, submit and cancel buttons) per contracts/screens.md
- [X] T015 [US1] Create `apps/mobile/src/app/(app)/recurring/new.tsx` ("Nuevo pago": RecurringForm with `today` from `useQuery({ queryKey: summaryKeys.all, queryFn: getSummary })`, which fetches the summary when it is not cached (e.g. opened from "Mis pagos"), `createRecurring`, `invalidateRecurring`, then `router.back()`) and register the routes of contracts/screens.md → Navegación in `apps/mobile/src/app/(app)/_layout.tsx` (`recurring/index` "Mis pagos", `recurring/new` "Nuevo pago", `recurring/[id]/index` "Pago", `recurring/[id]/edit` "Editar pago", `occurrence/[id]/index` "Pago del mes", `occurrence/[id]/pay` with `presentation: 'formSheet'` and `sheetAllowedDetents`)

**Checkpoint**: US1 complete: payments are created and their occurrences appear month by month (e2e green); the app creates a payment.

---

## Phase 4: User Story 2 - Pagos del mes en el inicio (Priority: P1)

**Goal**: el inicio muestra "Pagos de <mes>" con total, pagado, lo que falta y la lista ordenada.

**Independent Test**: quickstart.md B8 (`summary.recurring`); en la app, B10.2 y B10.8.

### Tests for User Story 2 (write first, must FAIL) ⚠️

- [X] T016 [P] [US2] Extend `apps/api/test/summary.e2e-spec.ts` with `HOME_NOW`: `recurring` is the MonthView of `2026-11` and equals `GET /recurring/occurrences?month=2026-11`; with the November data of quickstart.md B3 (Arriendo and Internet paid through the occurrence endpoint once it exists, or directly with Prisma until T021) totals 1.480.000 / 1.295.000 / 185.000 and order Gimnasio, Celular, Arriendo, Internet; a user without cards still gets `recurring`; a user without payments gets `hasPayments` false; the `cards` part is unchanged

### Implementation for User Story 2

- [X] T017 [US2] In `apps/api/src/summary/summary.service.ts` add `recurring: await recurring.monthView(userId, currentMonth(today))` (research.md R9) also when there are no cards (remove the early return), import `RecurringModule` in `summary.module.ts`, and update the class comment (the summary may now insert the current month's occurrences); make T016 pass
- [X] T018 [P] [US2] Add `recurring: MonthView` to `Summary` in `apps/mobile/src/api/summary.ts`; implement `apps/mobile/src/components/MonthOverview.tsx` (StatTiles "Total del mes" and "Pagado", "Faltan $X", or "Todo pagado" only when the month has occurrences and `remaining` is 0, RecurringRow list in a ListPanel, "Sin pagos este mes" when the month has no occurrences; rows open `occurrence/[id]`) and `apps/mobile/src/components/RecurringSection.tsx` (SectionHeader "Pagos de <mes>" + "Nuevo" → `recurring/new`; the invitation "Agrega tus pagos fijos" when `hasPayments` is false) per contracts/screens.md
- [X] T019 [US2] Render `RecurringSection` in `apps/mobile/src/app/(app)/(tabs)/home.tsx` below CycleSummary or below EmptyCards (also without cards), inside a scrollable screen

**Checkpoint**: US2 complete: the home shows the month's payments (e2e green).

---

## Phase 5: User Story 3 - Marcar una ocurrencia como pagada y deshacerlo (Priority: P1)

**Goal**: marcar pagada con monto real opcional y deshacer.

**Independent Test**: quickstart.md B4; en la app, B10.3.

### Tests for User Story 3 (write first, must FAIL) ⚠️

- [X] T020 [P] [US3] Add to `apps/api/test/occurrences.e2e-spec.ts`: GET `/occurrences/:id` (200; non-UUID and unknown → 404); POST `/occurrences/:id/payment` without body → `paid` with `paidAmount` = expected and `paidAt` 2026-11-23; with `{ amount: 70000 }` → totals 1.485.000 / 1.365.000 / 120.000 (quickstart.md B4); paying an `overdue` one works; paying a future month (2026-12) counts in December, not November; paying twice → 200 unchanged; `amount` 0, decimal or above the maximum → 400 `OUT_OF_RANGE`; DELETE → back to `pending` or `overdue` by date with `paidAmount` null, twice → 200 unchanged; card data (`GET /cards/:id`, statements) unchanged after paying (SC-007)

### Implementation for User Story 3

- [X] T021 [US3] Implement in `apps/api/src/recurring/recurring.service.ts` `getOccurrence`, `payOccurrence` and `unpayOccurrence` (research.md R7: find the occurrence through its payment's `user_id`, lock the parent payment `FOR UPDATE`, `paid_at` = user's today, default amount = expected, idempotent; unpay on a deleted payment → `AppErrors.recurringDeleted()`) and add `apps/api/src/recurring/occurrences.controller.ts` (`GET /occurrences/:id`, `POST` and `DELETE /occurrences/:id/payment` with `@HttpCode(200)`); register it in `recurring.module.ts`; make T020 pass and switch T016 to the endpoint
- [X] T022 [P] [US3] Create `apps/mobile/src/app/(app)/occurrence/[id]/index.tsx` per contracts/screens.md (name, long date, StatusChip, "Esperado …" and "Pagado … el …"; "Marcar pagado" → `occurrence/[id]/pay`; "Deshacer pago" when paid and the payment is not deleted; "Ver pago" → `recurring/[id]`; "Este pago fue eliminado" when `paymentDeleted`), every mutation through `invalidateRecurring`
- [X] T023 [US3] Implement `apps/mobile/src/components/PayOccurrenceForm.tsx` (field "Monto pagado" prefilled with the expected amount, numeric keyboard, focus on open, domain validation) and the sheet `apps/mobile/src/app/(app)/occurrence/[id]/pay.tsx` ("Marcar pagado · <nombre>", "Confirmar pago" → `payOccurrence` with the amount only when it differs, `invalidateRecurring`, close; "Cancelar")

**Checkpoint**: US3 complete: pay and undo from the home and the detail.

---

## Phase 6: User Story 4 - Pestaña Pagos: vista por mes y mis pagos (Priority: P1)

**Goal**: pestaña Pagos con navegación por mes y "Mis pagos".

**Independent Test**: en la app, B10.1, B10.4 y B10.5.

- [X] T024 [P] [US4] Implement `apps/mobile/src/components/MonthNavigator.tsx` per contracts/screens.md (buttons "Mes anterior" / "Mes siguiente" 44 × 44 with `chevron-back` / `chevron-forward`, disabled at `bounds` with `accessibilityState.disabled`; the month label as a header in a `polite` live region)
- [X] T025 [US4] Create `apps/mobile/src/app/(app)/(tabs)/payments.tsx` (title "Pagos", MonthNavigator, MonthOverview of `GET /recurring/occurrences?month=` with `placeholderData: keepPreviousData`, loading "Cargando pagos" and QueryError, secondary button "Mis pagos" → `recurring/index`); add `payments` ("Pagos") between `register` and `profile` in `apps/mobile/src/app/(app)/(tabs)/_layout.tsx` (update its comment) and the icons `calendar` / `calendar-outline` in `apps/mobile/src/components/TabBar.tsx`
- [X] T026 [US4] Create `apps/mobile/src/app/(app)/recurring/index.tsx` ("Mis pagos": SectionHeader + "Nuevo", rows with name, `frequencyText`, expected amount and "Activo"/"Pausado" written, empty invitation) and `apps/mobile/src/app/(app)/recurring/[id]/index.tsx` (name, amount, frequency, status, "Próximo vencimiento …" or "Pausado: no genera pagos nuevos", and the buttons "Editar", "Pausar"/"Reanudar" and "Eliminar" wired in US5–US7)

**Checkpoint**: US4 complete: the tab browses months and lists the payments.

---

## Phase 7: User Story 5 - Editar un pago recurrente (Priority: P2)

**Goal**: editar nombre, monto, frecuencia y fecha sin tocar lo pagado ni lo vencido.

**Independent Test**: quickstart.md B5; en la app, B10.6.

### Tests for User Story 5 (write first, must FAIL) ⚠️

- [X] T027 [P] [US5] Add the edit cases to `apps/api/test/recurring.e2e-spec.ts` (spec US5, research.md R5): amount change → November paid keeps 1.200.000 and December shows 1.300.000; an overdue November keeps its amount; `nextDueDate` 2026-12-20 → December 20, January 20 and earlier paid/overdue unchanged; Celular pending 2026-11-28 moved to 2026-11-25 → November occurrence on the 25th; December paid in advance + date change to 2026-12-20 → December keeps the paid one only; name change visible in paid occurrences; history freeze: create a payment on 2026-11-01 and, without viewing any month, edit its amount with a second app at 2026-12-23 → November and December (both overdue) appear with the old amount; `frequency` without `nextDueDate` → 400 `nextDueDate: REQUIRED`; frequency change with `nextDueDate` not after the last existing due date, paid or overdue (Gimnasio monthly overdue 2026-11-10 → annual 2026-11-25) → 400 `BEFORE_LAST_DUE`; `nextDueDate` yesterday → `IN_PAST`, beyond 12 months → `TOO_FAR`; empty body → 400; editing a paused payment works; undoing the payment of an occurrence paid before an edit brings it back with its own `dueDate` and `expectedAmount`, not the edited ones (spec edge case)
- [X] T028 [US5] Implement `update` in `apps/api/src/recurring/recurring.service.ts` (transaction: `lockOwnedPayment`, validate, `materializeThrough(today)`, delete unpaid occurrences with `due_date ≥ today`, apply name/amount, and with `nextDueDate` set `anchor_date = starts_on = nextDueDate` and the new frequency) and `PATCH /recurring/:id` in `recurring.controller.ts`; make T027 pass
- [X] T029 [US5] Create `apps/mobile/src/app/(app)/recurring/[id]/edit.tsx` (RecurringForm prefilled, "Próximo vencimiento" = `nextDueDate` or today when paused, the note "Los cambios de monto y fecha aplican desde hoy; lo pagado no cambia.", send only changed fields, always `nextDueDate` when the frequency changes, `invalidateRecurring`) and wire "Editar" in `recurring/[id]/index.tsx`

**Checkpoint**: US5 complete.

---

## Phase 8: User Story 6 - Pausar y reanudar un pago (Priority: P2)

**Goal**: pausar conserva lo existente hasta el periodo actual; reanudar vuelve desde el próximo
vencimiento igual o posterior a hoy.

**Independent Test**: quickstart.md B6; en la app, B10.7.

### Tests for User Story 6 (write first, must FAIL) ⚠️

- [X] T030 [P] [US6] Add the pause/resume cases to `apps/api/test/recurring.e2e-spec.ts` (spec US6, FR-005, FR-006): pause → `paused`, `nextDueDate` null, November kept (pending or overdue) and December without occurrence; pause twice → 200 unchanged; December and January viewed before pausing (occurrences materialized) → after pausing their unpaid occurrences are gone, a December paid in advance stays, and November (current period) stays; undoing a paid occurrence of a paused payment is allowed and it stays as pending/overdue (spec edge case); resume with `HOME_NOW` (day 10 passed) → `nextDueDate` 2026-12-10 and no second November occurrence; with an app at 2027-02-03 → occurrences from 2027-02-10, none in December and January; with an app at 2027-02-15 → first new one 2027-03-10, February empty and nothing overdue; pause and resume in the same month → one occurrence; annual resumed after this year's date → next year, on or before → this year; resume an active payment → 200 unchanged; paid occurrences unchanged through pause and resume (SC-005)
- [X] T031 [US6] Implement `pause` and `resume` in `apps/api/src/recurring/recurring.service.ts` (transaction: `lockOwnedPayment`, `materializeThrough(today)`, then `paused_on = today` and delete the unpaid occurrences with `due_date` after the end of the current period (the current period's occurrence and paid ones stay, research.md R5), or `starts_on = nextDueOnOrAfter(anchor, today)` and `paused_on = null`; idempotent) and `POST /recurring/:id/pause` and `/resume` (`@HttpCode(200)`) in `recurring.controller.ts`; make T030 pass
- [X] T032 [US6] Wire "Pausar" / "Reanudar" in `apps/mobile/src/app/(app)/recurring/[id]/index.tsx` through `invalidateRecurring`, with the button disabled while the request runs and the new status written

**Checkpoint**: US6 complete.

---

## Phase 9: User Story 7 - Eliminar un pago (Priority: P2)

**Goal**: eliminar borra lo no pagado y conserva el historial pagado.

**Independent Test**: quickstart.md B7; en la app, B10.7.

### Tests for User Story 7 (write first, must FAIL) ⚠️

- [X] T033 [P] [US7] Add the delete cases to `apps/api/test/recurring.e2e-spec.ts` and `occurrences.e2e-spec.ts` (spec US7, FR-007, research.md R6): DELETE → 204; the payment leaves `GET /recurring` and `GET /recurring/:id`, PATCH, pause, resume and DELETE give 404; its unpaid occurrences (also overdue) are gone; a paid October occurrence (app at 2026-10-20 to create and pay) stays in `2026-10` with `paymentDeleted` true and unchanged totals; GET `/occurrences/:id` of it → 200; DELETE its payment → 409 `RECURRING_DELETED`; following months show nothing of it; `bounds.first` still counts it
- [X] T034 [US7] Implement `remove` in `apps/api/src/recurring/recurring.service.ts` (transaction: `lockOwnedPayment`, delete unpaid occurrences, set `deleted_at`) and `DELETE /recurring/:id` (`@HttpCode(204)`) in `recurring.controller.ts`; make T033 pass
- [X] T035 [US7] Wire "Eliminar" in `apps/mobile/src/app/(app)/recurring/[id]/index.tsx` with the confirmation "¿Eliminar <nombre>? Se borran sus pagos pendientes y se conserva lo que ya pagaste." (destructive style), `invalidateRecurring` and back to "Mis pagos"

**Checkpoint**: US7 complete.

---

## Phase 10: User Story 8 - Mis pagos son solo míos (Priority: P1)

**Goal**: aislamiento de todos los endpoints de pagos y ocurrencias.

**Independent Test**: `pnpm --filter api test:e2e -- recurring-isolation`.

- [X] T036 [US8] Write `apps/api/test/recurring-isolation.e2e-spec.ts` with two users (A with an active, a paused and a deleted payment with paid history; B with one payment): B gets 404 `NOT_FOUND` with the same body as an unknown id on GET, PATCH and DELETE `/recurring/:id`, pause and resume, GET `/occurrences/:id` and POST/DELETE `/occurrences/:id/payment` for A's resources (FR-021, SC-006); B's `GET /recurring`, month views and `/summary` contain nothing of A; A's data is unchanged after B's attempts

**Checkpoint**: all API stories green.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [X] T037 Keep the views fresh (FR-020): `useRefetchOnFocus` and `useRefetchOnAppActive` in `apps/mobile/src/app/(app)/(tabs)/payments.tsx`, `recurring/index.tsx`, `recurring/[id]/index.tsx` and `occurrence/[id]/index.tsx`; confirm with `grep -rn invalidateQueries apps/mobile/src/app` that every recurring mutation goes through `invalidateRecurring`
- [X] T038 [P] Update `docs/design-system.md`: StatTile, ListRow (RecurringRow), MonthOverview, MonthNavigator, RecurringSection, StatusChip `pending` (5,20), TabBar with Pagos (icon `calendar`), and the "Pagos de <mes>" block of the home screen; check every color pair is in the measured list (AA)
- [X] T039 [P] Update `docs/mvp-spec.md`: rule 4 of "Pagos recurrentes" aligned with FR-007 (eliminar borra las ocurrencias no pagadas, también las vencidas, y conserva las pagadas) and a note that `GET /summary` may now create the current month's occurrences; API table with `GET /recurring/:id`, `GET /occurrences/:id`, `?month=YYYY-MM` and the summary's `recurring`, linking `specs/005-recurring-payments/contracts/recurring.openapi.yaml`; and `README.md` with a short "Pagos recurrentes" section
- [X] T040 Design review of the new screens against `docs/design-system.md` and contracts/screens.md (tokens only, no hand-written values, touch areas ≥ 44, tabular amounts, states with text, AA contrast; with $9.999.999.999 nothing is cut or overflows in StatTile, RecurringRow and the pay sheet); fix what is found
- [X] T041 Run quickstart.md B1–B9 (curl and test commands), `pnpm lint && pnpm format:check && pnpm typecheck`, `pnpm --filter @corte/domain test:cov`, `pnpm --filter api test && pnpm --filter api test:e2e` and `pnpm --filter mobile exec expo export` for iOS and Android; B10 (app on iOS and Android) is validated manually by the user
- [X] T042 After B10 passes, mark spec 005 as "(cerrada)" in "Orden de specs" of `docs/mvp-spec.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup; blocks every story (domain rules, tables, module base,
  app types and shared UI).
- **US1 (Phase 3)**: after Foundational. MVP.
- **US2 (Phase 4)**: after Foundational (`monthView`); independent from the US1 app screens.
  T016 uses Prisma to mark occurrences paid until T021 exists.
- **US3 (Phase 5)**: after US1 (occurrences exist through the month view) and T018 (rows to tap).
- **US4 (Phase 6)**: after US1 (T013) and T018 (MonthOverview).
- **US5, US6, US7 (Phases 7–9)**: after US1 and T026 (payment detail screen); they touch the same
  service, controller and detail screen, so they run one after another.
- **US8 (Phase 10)**: after every endpoint exists (T034).
- **Polish (Phase 11)**: after all stories.

### Within Each User Story

- Tests first and failing; domain before API; API before the app; components before screens.
- `pnpm --filter @corte/domain build` after each domain change, before the API typecheck.

### Parallel Opportunities

- Setup: T001 ‖ T002.
- Foundational: T003 ‖ T004 (same file, separate `describe`: coordinate); T008 ‖ T009 while
  T005–T007 run.
- US1: T010 ‖ T011 ‖ T014; then T012 → T013; T015 after T014.
- US2: T016 ‖ T018; T017 after T016; T019 after T018.
- US3: T020 ‖ T022; T021 after T020; T023 after T022.
- US4: T024 ‖ T026; T025 after T024.
- API of US2 and app of US1 can advance in parallel.
- Polish: T038 ‖ T039.

---

## Parallel Example: Foundational

```text
Task: "T003 calendar tests in packages/domain/src/recurring.test.ts"
Task: "T008 apps/mobile/src/api/recurring.ts + recurring-cache.ts"
Task: "T009 StatusChip pending, StatTile, RecurringRow, months.ts"
```

## Parallel Example: User Story 1

```text
Task: "T010 recurring.e2e-spec.ts (create, list, detail)"
Task: "T011 occurrences.e2e-spec.ts (month view)"
Task: "T014 recurring-schema.ts + RecurringForm.tsx"
```

---

## Implementation Strategy

### MVP First

1. Setup + Foundational.
2. US1: create payments and see their occurrences month by month (API and "Nuevo pago").
3. **Stop and validate**: quickstart.md B2 and the e2e.

### Incremental Delivery

1. US1 → payments and dues.
2. US2 + US3 → home section and paying: the daily use of the feature.
3. US4 → Pagos tab and "Mis pagos".
4. US5 + US6 + US7 → edit, pause/resume and delete.
5. US8 → isolation of every endpoint.
6. Polish → freshness, docs, design review, quickstart, B10 by the user, close the spec.
