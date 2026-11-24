# Data Model: Pagos recurrentes

Fase 1 de [plan.md](./plan.md). Dos tablas nuevas, una migración (`recurring_payments`) y las
estructuras derivadas que calcula el dominio ([research.md](./research.md) R1 a R5). Montos en
pesos enteros (`BIGINT`); fechas de negocio `DATE` en la zona del usuario (principio IV).

## RecurringPayment → `recurring_payments`

| Campo | Columna | Tipo | Regla |
| --- | --- | --- | --- |
| `id` | `id` | `UUID` | `gen_random_uuid()` |
| `userId` | `user_id` | `UUID` FK → `users` | `ON DELETE CASCADE` (borrar la cuenta borra todo, spec 001) |
| `name` | `name` | `VARCHAR(40)` | 1–40 caracteres tras quitar espacios sobrantes (`validateRecurringName`, mismas reglas que `Card.name`) |
| `amount` | `amount` | `BIGINT` | Monto esperado, 1..`MAX_AMOUNT_COP` (`validateAmount`); CHECK en la migración |
| `frequency` | `frequency` | enum `recurring_frequency` (`monthly`, `annual`) | FR-001 |
| `firstDueDate` | `first_due_date` | `DATE` | Primer vencimiento al crear; no cambia. En el alta: `validateFirstDueDate` (desde el 1.º del mes actual hasta hoy + 12 meses). Sirve para `monthBounds` |
| `anchorDate` | `anchor_date` | `DATE` | De aquí salen el día (y el mes, si es anual) de cada vencimiento. Al crear = `firstDueDate`; al editar con `nextDueDate` = `nextDueDate` |
| `startsOn` | `starts_on` | `DATE` | Ningún vencimiento anterior genera ocurrencia. Al crear = `firstDueDate`; al editar con `nextDueDate` = `nextDueDate`; al reanudar = `nextDueOnOrAfter(ancla, hoy)` |
| `pausedOn` | `paused_on` | `DATE` null | Hoy al pausar; null si está activo. Con valor, solo se generan periodos ≤ `periodOf(pausedOn)` |
| `deletedAt` | `deleted_at` | `TIMESTAMPTZ` null | Borrado lógico (R6); con valor no se lista ni se puede leer, editar, pausar ni reanudar (404) |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` | `TIMESTAMPTZ` | — |

Índice: `(user_id, deleted_at)`. CHECKs: `amount BETWEEN 1 AND 9999999999`,
`char_length(name) BETWEEN 1 AND 40`. No hay CHECK entre `starts_on` y `first_due_date`: editar
puede adelantar el próximo vencimiento dentro del mismo mes (spec US5-4: 28 → 25 de noviembre).

**Estado expuesto** (`status`): `paused` si `pausedOn` tiene valor; `active` si no.

**Transiciones**

```text
            crear
              │
              ▼
   ┌────── active ◄────────┐
   │          │            │ reanudar: startsOn = nextDueOnOrAfter(ancla, hoy); pausedOn = null
   │          │ pausar: pausedOn = hoy; borra las no pagadas posteriores al fin del periodo actual
   │          ▼            │
   │       paused ─────────┘
   │          │
   └──────────┴──► eliminado (deletedAt): borra las ocurrencias no pagadas; quedan las pagadas
```

Editar se permite en `active` y `paused` (no en eliminado). Antes de editar, pausar o reanudar se
materializan los periodos hasta el actual con las reglas vigentes (R5).

## RecurringOccurrence → `recurring_occurrences`

| Campo | Columna | Tipo | Regla |
| --- | --- | --- | --- |
| `id` | `id` | `UUID` | `gen_random_uuid()` |
| `recurringPaymentId` | `recurring_payment_id` | `UUID` FK → `recurring_payments` | `ON DELETE CASCADE` (solo ocurre al borrar la cuenta; eliminar un pago es lógico) |
| `period` | `period` | `VARCHAR(7)` | `YYYY-MM` (mensual) o `YYYY` (anual), `periodOf(dueDate, frequency)`; CHECK `period ~ '^[0-9]{4}(-[0-9]{2})?$'` |
| `dueDate` | `due_date` | `DATE` | `dueDateFor(schedule, period)` al materializar; al editar solo se borran las no pagadas con `due_date ≥ hoy` |
| `expectedAmount` | `expected_amount` | `BIGINT` | Monto del pago al materializar; 1..máximo |
| `paidAt` | `paid_at` | `DATE` null | Hoy al marcar pagado; null si no |
| `paidAmount` | `paid_amount` | `BIGINT` null | Monto real (por defecto el esperado), 1..máximo |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` | `TIMESTAMPTZ` | — |

Clave única: `(recurring_payment_id, period)` (FR-003). Índice: `(recurring_payment_id,
due_date)`. CHECKs: `(paid_at IS NULL) = (paid_amount IS NULL)`, montos en rango.

**Estado derivado** (`occurrenceStatus`, no se guarda): `paid` si `paidAt`; `overdue` si no y
`dueDate < hoy`; `pending` en otro caso.

**Aislamiento**: toda consulta filtra por `recurring_payments.user_id` del token (join), también
para ocurrencias de pagos eliminados.

## Schedule (dominio, entrada de `duePeriods` y `nextDueDate`)

| Campo | Tipo | Origen |
| --- | --- | --- |
| `anchorDate` | `IsoDate` | `anchor_date` |
| `frequency` | `'monthly' \| 'annual'` | `frequency` |
| `startsOn` | `IsoDate` | `starts_on` |
| `pausedOn` | `IsoDate \| null` | `paused_on` |
| `deleted` | `boolean` | `deleted_at IS NOT NULL` |

## MonthView (derivado; `GET /recurring/occurrences` y `Summary.recurring`)

| Campo | Tipo | Regla |
| --- | --- | --- |
| `month` | `'YYYY-MM'` | Mes pedido (o el actual en el resumen) |
| `today` | `IsoDate` | "Hoy" del servidor en la zona del usuario |
| `bounds.first` / `bounds.last` | `'YYYY-MM'` | `monthBounds(today, min(first_due_date) de todos sus pagos, incluidos eliminados)` |
| `hasPayments` | `boolean` | El usuario tiene al menos un pago no eliminado (invitación de FR-015) |
| `totals.total` / `paid` / `remaining` | entero COP | `summarizeMonth`: `paid` = Σ `paidAmount`; `remaining` = Σ `expectedAmount` no pagadas; `total = paid + remaining` |
| `items[]` | lista | Ocurrencias con `dueDate` en el mes, ordenadas: `overdue`, `pending`, `paid`; dentro por `dueDate` y `name` |
| `items[].id`, `recurringPaymentId`, `name`, `dueDate`, `expectedAmount`, `paidAmount`, `paidAt`, `status`, `paymentDeleted` | — | `amount` mostrado = `paidAmount ?? expectedAmount` |

## RecurringPaymentView (derivado; `GET /recurring`, `GET /recurring/:id`)

Campos del pago (`id`, `name`, `amount`, `frequency`, `anchorDate`, `status`) más `nextDueDate`:
`nextRecurringDueDate(schedule, hoy, periodos pagados)` o null si está pausado. "Mis pagos" ordena activos
antes que pausados y luego por nombre.

## Validación (cuerpos)

| Operación | Campo | Códigos (`contracts/recurring.openapi.yaml`) |
| --- | --- | --- |
| Crear | `name` | `REQUIRED`, `TOO_LONG` |
| Crear | `amount` | `REQUIRED`, `OUT_OF_RANGE` |
| Crear | `frequency` | `REQUIRED`, `INVALID` |
| Crear | `firstDueDate` | `REQUIRED`, `INVALID`, `TOO_OLD`, `TOO_FAR` |
| Editar | cualquiera de los anteriores (al menos uno) | los mismos; `nextDueDate`: `INVALID`, `IN_PAST`, `TOO_FAR`, `BEFORE_LAST_DUE` (con cambio de frecuencia, debe caer en un mes posterior al del último vencimiento pagado o vencido); `frequency` sin `nextDueDate`: `nextDueDate: REQUIRED` |
| Pagar | `amount` (opcional) | `OUT_OF_RANGE` |
| Mes | `month` (query) | `INVALID`, `OUT_OF_RANGE` |

`TOO_OLD`, `TOO_FAR`, `IN_PAST`, `BEFORE_LAST_DUE` y `OUT_OF_RANGE` del mes dependen de "hoy" o de
la base y se comprueban en el servicio, como `IN_FUTURE` en la spec 003.
