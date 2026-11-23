# Data Model: Inicio y simulador

Fase 1 de [plan.md](./plan.md). **Sin cambios en la base de datos**: no hay migración. Esta spec
solo lee `cards`, `purchases`, `installments` y `statements` (specs 002 y 003). Abajo, las
estructuras derivadas que calculan el dominio y el API ([research.md](./research.md) R2, R4, R5).

## Simulation (no se guarda)

Respuesta de `POST /cards/:id/simulate` y salida de `simulatePurchase` (R2).

| Campo | Tipo | Regla |
| --- | --- | --- |
| `installments[]` | lista | Plan de `buildInstallmentPlan` (spec 003), n elementos |
| `installments[].number` | entero 1..n | — |
| `installments[].cutoffDate` / `dueDate` | `IsoDate` | Reglas de ciclo (spec 002, spec 003 FR-004) |
| `installments[].principal` / `interest` | entero COP | Spec 003 FR-001 y FR-003; interés estimado |
| `installments[].statementStatus` | `open` \| `due` \| `overdue` \| `paid` | Existente pagado → `paid`; existente no pagado → estado derivado; nuevo con fecha límite pasada → `paid` (spec 003 FR-030); nuevo → estado derivado |
| `totalInterest` | entero COP | Σ `interest` |
| `cycleBudgetUsage.cutoffDate` | `IsoDate` | Corte del extracto abierto (ciclo actual, spec 002) |
| `cycleBudgetUsage.amountBefore` | entero COP | "A pagar" actual del extracto abierto (0 si no existe) |
| `cycleBudgetUsage.amountAfter` | entero COP | `amountBefore` + abono e interés de la cuota con ese corte, si la hay (FR-003) |
| `cycleBudgetUsage.percentBefore` / `percentAfter` | entero ≥ 0 | `budgetUsagePercent` (floor, spec 003) |
| `cycleBudget` | entero COP | Tope de la tarjeta |
| `availableCredit.before` | entero COP | Cupo disponible actual (spec 003 FR-023); puede ser negativo |
| `availableCredit.after` | entero COP | `before − amount` (FR-004) |

Entrada (cuerpo): `amount`, `purchaseDate` (por defecto hoy), `installmentCount` (por defecto 1),
`noInterest` (por defecto `false`); validación de `Purchase` de `specs/003-purchases/data-model.md`
sin `concept`. La tasa es la actual de la tarjeta (como al registrar).

## HomeSummary (no se guarda)

Respuesta de `GET /summary` (R4).

| Campo | Tipo | Regla |
| --- | --- | --- |
| `today` | `IsoDate` | Hoy en la zona del usuario |
| `cards[]` | lista | Tarjetas activas en el orden de `GET /cards` |
| `cards[].card` | `Card` | Esquema de la spec 002 con los campos de la spec 003 |
| `cards[].nextPayment` | objeto \| `null` | Extracto no pagado con corte < hoy y fecha límite más antigua; `null` si no hay |
| `nextPayment.statementId` | `uuid` | Para abrir el detalle (FR-019) |
| `nextPayment.cutoffDate` / `dueDate` | `IsoDate` | — |
| `nextPayment.amount` | entero COP | "A pagar" (abonos + intereses estimados) |
| `nextPayment.status` | `due` \| `overdue` | — |
| `nextPayment.daysLeft` | entero | `daysBetween(today, dueDate)`; negativo si venció |
| `cards[].nextCutoff` | objeto | `{ cutoffDate, dueDate, daysLeft }` del ciclo actual (`nextCutoff`, spec 002) |
| `cards[].cycleBudgetUsage` | objeto | `{ cutoffDate, amount, percent }`, igual que `GET /cards/:id` (spec 003) |

## Reglas de presentación (dominio, R5)

| Función | Entrada | Salida |
| --- | --- | --- |
| `budgetLevel(percent)` | entero ≥ 0 | `normal` (< 70), `warning` (70–99), `danger` (≥ 100) |
| `paymentUrgency(daysLeft, status)` | entero, `due` \| `overdue` | `overdue` si `status = overdue`; `soon` si 0 ≤ `daysLeft` ≤ 5; si no `normal` |
| `nextPayment(statements, today)` | extractos `{ id, cutoffDate, dueDate, paidAt }` | El no pagado con corte < hoy y `dueDate` mínima (desempate: corte menor); `null` si no hay |

## Estado en la app (no se guarda en el servidor)

| Store | Campo | Regla |
| --- | --- | --- |
| `front-card-store` (Zustand, memoria) | `frontCardId: string \| null` | Lo fija el carrusel del inicio; si no está entre las activas se usa la primera (R6) |
