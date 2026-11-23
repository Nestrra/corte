# Implementation Plan: Compras, cuotas y extractos

**Branch**: `003-purchases` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-purchases/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Compras a cuotas, extractos y cupo real (HU-03 y HU-04 de `docs/mvp-spec.md`). `packages/domain`
gana el plan de cuotas (`buildInstallmentPlan`: abono floor con residuo en la última, interés
estimado sobre saldo con EM = (1 + EA)^(1/12) − 1 y redondeo al peso, cuota k en el corte k − 1
meses después del de la compra), la reprogramación de cuotas abiertas al cambiar las fechas de la
tarjeta, el estado derivado de un extracto y las validaciones de compra y tasa. El API agrega
`annual_rate` a `cards` y las tablas `purchases` (con la tasa como snapshot), `installments` y
`statements` (única por tarjeta y corte; solo guarda `paid_at` y `paid_amount`, el estado se
deriva del "hoy" del `Clock`). Registrar, editar o borrar una compra y cambiar las fechas de la
tarjeta corren en una transacción que bloquea la tarjeta, crea extractos bajo demanda (los
pasados nuevos, como pagados) y borra los no pagados que quedan vacíos. Nueve operaciones nuevas
con e2e de aislamiento. La app agrega la tasa al formulario de tarjeta, el registro de compras
desde el detalle con su confirmación, listas y detalles de compras y extractos, pagar y deshacer,
y el cupo disponible real con la deuda total y el uso del tope. Detalle en
[research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict) sobre Node.js 24; Expo SDK 58 (React Native 0.88,
Hermes).

**Primary Dependencies** (nuevas en esta spec):
- `apps/mobile`: `@react-native-community/datetimepicker` (selector nativo de la fecha de compra
  con mínimo y máximo; incluido en Expo Go, sin código nativo propio; research.md R11).
- Sin cambios: NestJS 12, Prisma 7, zod, TanStack Query, react-hook-form, expo-router,
  `expo-linear-gradient`, `@expo/vector-icons`.
- `packages/domain` sigue sin dependencias de ejecución; las propiedades se prueban con
  recorridos exhaustivos, sin `fast-check` (R12).

**Storage**: PostgreSQL 17. Migración nueva: `cards.annual_rate NUMERIC(5,2)` y tablas
`purchases`, `installments` y `statements` con montos `BIGINT`, fechas `DATE`, `CHECK` a mano y
únicos `(card_id, cutoff_date)` y `(purchase_id, number)` ([data-model.md](./data-model.md)).

**Testing**: Vitest en `packages/domain` (ejemplos de la spec, propiedades por recorrido de n =
1..72, reprogramación y estados; umbral 95%); Jest unitarias y e2e contra PostgreSQL real con el
reloj fijo `2026-11-22T02:30:00Z`, incluido el aislamiento de las 9 operaciones; la app se valida
a mano con [quickstart.md](./quickstart.md).

**Target Platform**: API en contenedor Linux (`node:24-alpine`); app en Expo Go (iOS y Android).

**Project Type**: monorepo móvil + API.

**Performance Goals**: una compra genera a lo sumo 72 cuotas y 72 extractos; registrar, editar o
reprogramar es una transacción de pocas decenas de sentencias. Listas de cientos de extractos por
tarjeta sin paginación. Cupo y deuda de todas las tarjetas con una consulta agregada.

**Constraints**: montos enteros COP (`BIGINT`) y tasa `NUMERIC(5,2)` (principio IV); interés
calculado en punto flotante y presentado siempre como estimado (R2); fechas `DATE` convertidas en
un solo helper (R9); escrituras por tarjeta serializadas con `SELECT … FOR UPDATE` (R5); los
extractos cerrados no cambian al reprogramar (SC-007).

**Scale/Scope**: 9 endpoints nuevos y cambios en 3 de tarjetas (`GET` lista y detalle, `POST` y
`PATCH`); 6 pantallas nuevas y 2 ampliadas (detalle y formulario de tarjeta); ~12 funciones puras
nuevas en el dominio.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo se cumple en esta spec | Estado |
| --- | --- | --- |
| I. Dominio puro | Plan de cuotas, interés, EM, reprogramación, estado del extracto, uso del tope y validaciones de compra y tasa en `packages/domain`, sin reloj ni I/O; "hoy" entra como parámetro. El API solo persiste lo que devuelve el dominio; la app no calcula cuotas ni estados (los recibe del API) y valida con las reglas del dominio. | ✅ |
| II. Pruebas primero | Pruebas del dominio con los ejemplos reales, propiedades para n = 1..72 y bordes de calendario (corte 31 en febrero, cambio de año, hoy = corte, hoy = fecha límite); umbral 95%. E2e de cada endpoint nuevo y del `PATCH` de tarjeta con reprogramación contra PostgreSQL real. | ✅ |
| III. Aislamiento | `userId` siempre del token; compras y extractos se filtran por `card.userId`; las escrituras empiezan con `SELECT … FOR UPDATE` filtrado por `user_id`. Recurso ajeno = inexistente = id inválido (mismo 404). E2e con dos usuarios para las 9 operaciones. | ✅ |
| IV. Dinero y fechas | Montos `BIGINT` y enteros; abono con floor y residuo (suma exacta); interés redondeado al peso y guardado como entero. Fechas de compra, corte, límite y pago como `DATE` en la zona del usuario. Interés y totales con interés marcados "estimado" en toda la UI. La tasa no es dinero: `NUMERIC(5,2)`. | ✅ |
| V. Seguridad | Sin endpoints públicos nuevos; el guard global y la restricción de contraseña temporal aplican a las rutas nuevas. Sin datos sensibles nuevos. | ✅ |
| VI. Simplicidad | Estado del extracto derivado (no se guarda); sin historial de fechas de la tarjeta (R6); sin paginación; propiedades sin librería; pago mínimo, parciales, mora e interés por días quedan en v2. | ✅ |
| VII. Configuración por entorno | Sin variables nuevas. | ✅ |
| VIII. Convenciones | Código, tablas, rutas, estados (`open`, `due`, `overdue`, `paid`) y códigos de error en inglés; textos de la app en español. | ✅ |
| IX. Sistema de diseño | Pantallas con tokens del tema; StatusChip ampliado con Abierto y Por pagar (se actualiza `docs/design-system.md`); estados, cupo negativo y tope superado siempre con texto; montos tabulares; áreas táctiles ≥ 44 en filas, chips y DateField; contraste AA. | ✅ |

**Resultado (pre-Phase 0)**: PASA sin violaciones.
**Re-evaluación (post-Phase 1)**: PASA. El contrato
([contracts/purchases.openapi.yaml](./contracts/purchases.openapi.yaml)) no recibe ids de usuario y
responde igual a un recurso ajeno que a uno inexistente; el modelo ([data-model.md](./data-model.md))
usa `BIGINT` para dinero, `DATE` para fechas de negocio y borra en cascada desde el usuario.

## Project Structure

### Documentation (this feature)

```text
specs/003-purchases/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── purchases.openapi.yaml   # compras, extractos, pago y cambios a /cards
│   ├── errors.md                # STATEMENT_OPEN, CARD_ARCHIVED en compras, códigos por campo
│   └── screens.md               # registrar, listas, detalles, pago, tasa en la tarjeta
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks
```

### Source Code (repository root)

```text
packages/domain/src/
├── rates.ts                     # validateAnnualRate, monthlyRate, roundHalfUp
├── rates.test.ts
├── purchase-rules.ts            # límites, normalizeConcept, validateConcept, validateInstallmentCount, validatePurchaseDate
├── purchase-rules.test.ts
├── installments.ts              # cutoffForMonthOffset, buildInstallmentPlan, rescheduleInstallments
├── installments.test.ts         # ejemplos de la spec, bordes de calendario, reprogramación
├── installments.property.test.ts# n = 1..72 × valores: suma exacta, interés 0, cortes consecutivos
├── statements.ts                # statementStatus, budgetUsagePercent
├── statements.test.ts
└── index.ts                     # + exports

apps/api/
├── prisma/
│   ├── schema.prisma            # + Card.annualRate, Purchase, Installment, Statement
│   └── migrations/              # + purchases_statements (con CHECK a mano)
├── src/
│   ├── app.module.ts            # + PurchasesModule, StatementsModule
│   ├── common/
│   │   ├── errors.ts            # + STATEMENT_OPEN
│   │   ├── iso-date.ts          # IsoDate ↔ Date (@db.Date) en UTC
│   │   └── uuid.ts              # UUID_PATTERN compartido (sale de cards.service)
│   ├── cards/                   # + annualRate en esquemas y mapper; totalDebt, availableCredit,
│   │                            #   cycleBudgetUsage; PATCH con reprogramación
│   ├── ledger/
│   │   ├── ledger.service.ts    # lockCard, upsert de extractos, FR-030, limpieza, reprogramación,
│   │   │                        #   totales por tarjeta (usado por cards, purchases y statements)
│   │   └── ledger.service.spec.ts
│   ├── purchases/
│   │   ├── purchases.module.ts
│   │   ├── purchases.controller.ts   # /cards/:id/purchases, /purchases/:id
│   │   ├── purchases.service.ts
│   │   ├── purchases.schemas.ts      # zod con las reglas del dominio
│   │   └── purchase.mapper.ts
│   └── statements/
│       ├── statements.module.ts
│       ├── statements.controller.ts  # /cards/:id/statements, /statements/:id(/payment)
│       ├── statements.service.ts
│       └── statement.mapper.ts
└── test/
    ├── purchases.e2e-spec.ts            # registrar, plan, validaciones, editar, borrar, archivada
    ├── statements.e2e-spec.ts           # lista, orden, estados, pagar, deshacer, FR-030/031
    ├── card-reschedule.e2e-spec.ts      # cambio de fechas, cerrados intactos, tasa en tarjeta
    └── purchases-isolation.e2e-spec.ts  # dos usuarios, las 9 operaciones

apps/mobile/src/
├── app/(app)/
│   ├── card/[id]/
│   │   ├── index.tsx            # + deuda, tope, tasa, Registrar compra, Compras, Extractos
│   │   ├── purchases/index.tsx
│   │   ├── purchases/new.tsx
│   │   └── statements.tsx
│   ├── purchase/[id]/index.tsx
│   ├── purchase/[id]/edit.tsx
│   └── statement/[id].tsx
├── api/
│   ├── cards.ts                 # + annualRate, totalDebt, cycleBudgetUsage
│   ├── purchases.ts
│   └── statements.ts
├── components/
│   ├── CardForm.tsx             # + campo de tasa
│   ├── PurchaseForm.tsx
│   ├── DateField.tsx
│   ├── StatusChip.tsx
│   ├── StatementRow.tsx
│   └── InstallmentRow.tsx
└── features/
    ├── rate.ts                  # parseo "26,82" y formato "26,82% EA"
    ├── purchase-schema.ts       # zod del formulario con @corte/domain
    └── money.ts                 # + negativos "−$300.000"

docs/design-system.md            # StatusChip: + Abierto, Por pagar
```

**Structure Decision**: misma estructura de monorepo. El dominio agrega módulos por tema (tasas,
reglas de compra, cuotas, extractos). El API agrega los módulos `purchases` y `statements` y un
servicio `ledger` que concentra las escrituras compartidas (bloqueo, extractos bajo demanda,
limpieza y reprogramación) para que `cards`, `purchases` y `statements` no las dupliquen. La app
agrega rutas apiladas bajo `card/[id]/`, `purchase/` y `statement/`.

## Complexity Tracking

Sin violaciones de la constitución; no se requiere justificación.
