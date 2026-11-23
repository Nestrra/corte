# Data Model: Compras, cuotas y extractos

Fase 1 de [plan.md](./plan.md). Reglas de los campos: spec FR-006 a FR-024 y FR-030/FR-031;
decisiones en [research.md](./research.md). Modelo `Card` base: `specs/002-cards/data-model.md`.

```text
User 1 ── N Card 1 ── N Purchase 1 ── N Installment N ── 1 Statement N ── 1 Card
```

Borrar un usuario borra sus tarjetas y, en cascada, compras, cuotas y extractos (spec 001).

## Card (`cards`): cambio

| Campo (Prisma) | Columna | Tipo | Reglas |
| --- | --- | --- | --- |
| `annualRate` | `annual_rate` | `NUMERIC(5,2)`, nulo | 0–100 con hasta 2 decimales; nulo = sin tasa (FR-006) |

- **CHECK**: `cards_annual_rate_range` (`annual_rate IS NULL OR annual_rate BETWEEN 0 AND 100`).
- Cambiarla no toca compras (FR-007). Cambiar `cutoff_day` o `due_day` reprograma los extractos
  abiertos (research.md R7).
- **Derivados** (no se guardan, R8): `totalDebt`, `availableCredit = creditLimit − totalDebt`,
  `cycleBudgetUsage`.

## Purchase (`purchases`)

| Campo (Prisma) | Columna | Tipo | Reglas |
| --- | --- | --- | --- |
| `id` | `id` | `uuid`, PK, `gen_random_uuid()` | — |
| `cardId` | `card_id` | `uuid`, FK → `cards.id`, `ON DELETE CASCADE` | Tarjeta del usuario del token (principio III) |
| `amount` | `amount` | `BIGINT` | 1–9.999.999.999 (pesos COP) |
| `concept` | `concept` | `VARCHAR(60)` | 1–60 caracteres tras recortar espacios |
| `purchaseDate` | `purchase_date` | `DATE` | ≤ hoy y ≥ hoy − 72 meses (zona del usuario, al registrar o editar) |
| `installmentCount` | `installment_count` | `SMALLINT` | 1–72 |
| `noInterest` | `no_interest` | `BOOLEAN`, por defecto `false` | "Sin intereses" |
| `annualRate` | `annual_rate` | `NUMERIC(5,2)`, nulo | Copia de `cards.annual_rate` al registrar; no cambia al editar (FR-009, FR-007) |
| `createdAt` | `created_at` | `TIMESTAMPTZ`, `now()` | Desempate del orden |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ` | — |

- **Índice**: `(card_id, purchase_date DESC, created_at DESC)` para la lista.
- **CHECK**: `purchases_amount_range`, `purchases_installment_count_range`,
  `purchases_annual_rate_range`, `purchases_concept_length` (`char_length(concept)` 1–60). La
  regla de fecha depende de "hoy" y solo se valida en el API.
- Sin `user_id`: la propiedad se comprueba por `card.user_id` (R10).

## Installment (`installments`)

| Campo (Prisma) | Columna | Tipo | Reglas |
| --- | --- | --- | --- |
| `id` | `id` | `uuid`, PK | — |
| `purchaseId` | `purchase_id` | `uuid`, FK → `purchases.id`, `ON DELETE CASCADE` | — |
| `statementId` | `statement_id` | `uuid`, FK → `statements.id`, `ON DELETE CASCADE` | Extracto donde cae |
| `number` | `number` | `SMALLINT` | 1..`installment_count` |
| `principal` | `principal` | `BIGINT` | ≥ 0; floor(valor / n), residuo en la última (FR-001) |
| `interest` | `interest` | `BIGINT` | ≥ 0; interés estimado (FR-003) |

- **Únicos e índices**: `UNIQUE (purchase_id, number)`; índice `(statement_id)`.
- **CHECK**: `installments_number_range` (`number BETWEEN 1 AND 72`),
  `installments_amounts_non_negative`.
- **Invariante** (lo garantiza el dominio, se prueba en e2e): `SUM(principal)` de una compra =
  `purchases.amount`, y hay exactamente `installment_count` cuotas.
- El `ON DELETE CASCADE` hacia `statements` solo actúa al borrar la tarjeta o el usuario: la app
  nunca borra un extracto con cuotas (solo los vacíos, R5).

## Statement (`statements`)

| Campo (Prisma) | Columna | Tipo | Reglas |
| --- | --- | --- | --- |
| `id` | `id` | `uuid`, PK | — |
| `cardId` | `card_id` | `uuid`, FK → `cards.id`, `ON DELETE CASCADE` | — |
| `cutoffDate` | `cutoff_date` | `DATE` | Fecha de corte |
| `dueDate` | `due_date` | `DATE` | Fecha límite; `> cutoff_date` |
| `paidAt` | `paid_at` | `DATE`, nulo | "Hoy" del usuario al marcar pagado (o al crearse por FR-030) |
| `paidAmount` | `paid_amount` | `BIGINT`, nulo | "A pagar" en ese momento |
| `createdAt` | `created_at` | `TIMESTAMPTZ`, `now()` | — |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ` | — |

- **Único**: `(card_id, cutoff_date)` (FR-015).
- **CHECK**: `statements_due_after_cutoff` (`due_date > cutoff_date`),
  `statements_payment_pair` (`(paid_at IS NULL) = (paid_amount IS NULL)`),
  `statements_paid_amount_non_negative`.
- **Derivados**: `total` = `SUM(principal + interest)` de sus cuotas; `hasInterest`;
  `installmentsInStatement` (cuántas cuotas tiene); `status` (abajo).

### Estado (derivado, `statementStatus` del dominio)

| `status` | En la app | Condición (hoy en la zona del usuario) |
| --- | --- | --- |
| `paid` | Pagado | `paid_at` no nulo |
| `open` | Abierto | `paid_at` nulo y hoy ≤ `cutoff_date` |
| `due` | Por pagar | `paid_at` nulo y `cutoff_date` < hoy ≤ `due_date` |
| `overdue` | Vencido | `paid_at` nulo y hoy > `due_date` |

Transiciones guardadas (las demás ocurren solas al avanzar "hoy"):

```text
due | overdue ──POST /payment──▶ paid  (paid_at = hoy, paid_amount = total)
paid ──DELETE /payment──▶ open | due | overdue según fechas
(nuevo, due_date < hoy, creado por una compra) ──▶ paid  (FR-030)
open ──POST /payment──▶ 409 STATEMENT_OPEN
```

### Ciclo de vida

- **Creación**: bajo demanda, cuando una cuota lo necesita (R5).
- **Reprogramación**: solo los abiertos, al cambiar las fechas de la tarjeta (R7).
- **Borrado**: los que quedan sin cuotas y sin pago, al final de cada operación (FR-022); los
  pagados vacíos se conservan.

## Reglas nuevas en `packages/domain`

| Constante / función | Valor o firma |
| --- | --- |
| `ANNUAL_RATE_MIN` / `MAX` | 0 / 100 |
| `PURCHASE_CONCEPT_MAX_LENGTH` | 60 |
| `INSTALLMENTS_MIN` / `MAX` | 1 / 72 |
| `PURCHASE_MAX_AGE_MONTHS` | 72 |
| `validateAnnualRate(rate)` | `'OUT_OF_RANGE' \| 'TOO_MANY_DECIMALS' \| null` |
| `normalizeConcept(s)`, `validateConcept(s)` | `string`; `'REQUIRED' \| 'TOO_LONG' \| null` |
| `validateInstallmentCount(n)` | `'OUT_OF_RANGE' \| null` |
| `validatePurchaseDate(date, today)` | `'INVALID' \| 'IN_FUTURE' \| 'TOO_OLD' \| null` |
| `monthlyRate(annualRate)` | `number` (EM) |
| `roundHalfUp(x)` | entero |
| `cutoffForMonthOffset(cutoff, months, cutoffDay)` | `IsoDate` |
| `buildInstallmentPlan(purchase, days)` | `InstallmentPlanItem[]` (R1) |
| `rescheduleInstallments(purchases, today, days)` | nuevas `{ cutoffDate, dueDate }` por cuota abierta (R7) |
| `statementStatus({ cutoffDate, dueDate, paidAt }, today)` | `'open' \| 'due' \| 'overdue' \| 'paid'` |
| `budgetUsagePercent(amount, cycleBudget)` | entero (floor) |
