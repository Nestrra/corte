# Data Model: Tarjetas y dominio de ciclos

Fase 1 de [plan.md](./plan.md). Reglas de los campos: spec FR-010; decisiones en
[research.md](./research.md) R5 y R6.

## Card (`cards`)

| Campo (Prisma) | Columna | Tipo | Reglas |
| --- | --- | --- | --- |
| `id` | `id` | `uuid`, PK, `gen_random_uuid()` | — |
| `userId` | `user_id` | `uuid`, FK → `users.id`, `ON DELETE CASCADE` | Siempre el usuario del token (principio III) |
| `name` | `name` | `VARCHAR(40)` | 1–40 caracteres tras recortar espacios |
| `color` | `color` | enum `CardColor` | `indigo`, `petroleo`, `ciruela`, `grafito`, `bosque`, `terracota` (claves de `cardColors`) |
| `last4` | `last4` | `CHAR(4)`, nulo | Exactamente 4 dígitos o nulo |
| `cutoffDay` | `cutoff_day` | `SMALLINT` | 1–31 |
| `dueDay` | `due_day` | `SMALLINT` | 1–31 |
| `creditLimit` | `credit_limit` | `BIGINT` | 1–9.999.999.999 (pesos COP) |
| `cycleBudget` | `cycle_budget` | `BIGINT` | 1–9.999.999.999 y ≤ `credit_limit` |
| `remindCutoffDays` | `remind_cutoff_days` | `SMALLINT`, por defecto 2 | 0–15 |
| `remindDueDays` | `remind_due_days` | `SMALLINT`, por defecto 3 | 0–15 |
| `archivedAt` | `archived_at` | `TIMESTAMPTZ`, nulo | Nulo = activa |
| `createdAt` | `created_at` | `TIMESTAMPTZ`, `now()` | Orden del carrusel |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ` | — |

- **Índice**: `(user_id, archived_at, created_at)`.
- **CHECK** (agregados a mano en la migración, R6): `cards_cutoff_day_range`, `cards_due_day_range`,
  `cards_remind_days_range`, `cards_amounts_range`, `cards_budget_within_limit`,
  `cards_last4_format` (`last4 ~ '^[0-9]{4}$'`), `cards_name_length` (`char_length(name)` 1–40).
- **Relación**: `User 1 — N Card`; borrar el usuario borra sus tarjetas (spec 001, FR-020).
- **Estados**: activa (`archived_at` nulo) ⇄ archivada (`archived_at` con fecha). Archivar fija
  `archived_at = now()`; restaurar lo pone en nulo. Ambas son idempotentes. Una archivada no se
  edita (`PATCH` → 409 `CARD_ARCHIVED`).
- **Cupo disponible**: no se guarda; en esta spec el API lo devuelve igual a `credit_limit`
  (FR-017). La spec 003 lo calculará con las cuotas.

## Ciclo (derivado, no se guarda)

Calculado por `packages/domain` (R2) a partir de `cutoffDay`, `dueDay` y una fecha:

| Valor | Significado |
| --- | --- |
| `today` | Fecha calendario actual en la zona del usuario (R3) |
| `nextCutoff` | Primer corte igual o posterior a `today` (FR-004) |
| `nextCutoffDue` | Fecha límite de `nextCutoff` (FR-003) |
| `nextDue` | Primera fecha límite igual o posterior a `today` (FR-005) |

## Reglas compartidas en `packages/domain`

| Constante / función | Valor o firma |
| --- | --- |
| `CARD_COLORS` | `['indigo', 'petroleo', 'ciruela', 'grafito', 'bosque', 'terracota']` |
| `CARD_NAME_MAX_LENGTH` | 40 |
| `MAX_AMOUNT_COP` | 9_999_999_999 |
| `DAY_OF_MONTH_MIN` / `MAX` | 1 / 31 |
| `REMINDER_DAYS_MAX` | 15 |
| `DEFAULT_REMIND_CUTOFF_DAYS` / `DEFAULT_REMIND_DUE_DAYS` | 2 / 3 |
| `validateCardName(name)` | `'REQUIRED' \| 'TOO_LONG' \| null` |
| `isValidLast4(value)` | 4 dígitos |
| `validateDayOfMonth(n)`, `validateReminderDays(n)`, `validateAmount(n)` | `'OUT_OF_RANGE' \| null` |
| `validateCycleBudget(budget, creditLimit)` | `'OUT_OF_RANGE' \| 'EXCEEDS_CREDIT_LIMIT' \| null` |
| `cutoffForDate(date, cutoffDay)`, `dueDateForCutoff(cutoff, dueDay)` | `IsoDate` |
| `cycleForDate(date, days)`, `nextCutoff(today, days)` | `{ cutoffDate, dueDate }` |
| `nextDueDate(today, days)` | `IsoDate` |
| `daysBetween(from, to)` | entero (días calendario) |
