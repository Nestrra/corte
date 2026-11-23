# Implementation Plan: Pagos recurrentes

**Branch**: `005-recurring-payments` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-recurring-payments/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Pagos recurrentes (HU-07 y los recurrentes del mes de HU-08 de `docs/mvp-spec.md`) como módulo
aparte de las tarjetas.

- **Dominio**: `packages/domain` gana `recurring.ts`:
  - el calendario anclado al día original (`dueDateFor`, `nextDueOnOrAfter`);
  - `duePeriods`, que lista los vencimientos de un rango respetando inicio, pausa y eliminación;
  - estados, totales y orden del mes (`occurrenceStatus`, `summarizeMonth`);
  - `nextDueDate`, `monthBounds` y las validaciones.
- **Base de datos**:
  - tablas `recurring_payments` (con borrado lógico) y `recurring_occurrences`, con
    `UNIQUE (recurring_payment_id, period)`;
  - las ocurrencias se crean bajo demanda al pedir un mes, en una transacción que bloquea los
    pagos del usuario (sin cron);
  - antes de editar, pausar o reanudar se congela la historia hasta el periodo actual.
- **API**:
  - los endpoints de `docs/mvp-spec.md` (`/recurring`, `/recurring/occurrences?month=`,
    `/occurrences/:id/payment`), más los detalles `GET /recurring/:id` y `GET /occurrences/:id`;
  - `GET /summary` agrega la vista del mes actual.
- **App**:
  - pestaña Pagos con navegador de mes y "Mis pagos";
  - formularios de crear y editar, y detalle de pago y de ocurrencia;
  - hoja nativa para marcar pagado, con el monto prellenado;
  - sección "Pagos de <mes>" en el inicio;
  - toda mutación invalida `['recurring']` y `['summary']`.

Sin dependencias nuevas. Detalle en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict) sobre Node.js 24; Expo SDK 58 (React Native 0.88,
Hermes).

**Primary Dependencies**: sin dependencias nuevas (R14). Se usan NestJS 12, Prisma 7, zod,
TanStack Query, react-hook-form, expo-router, `react-native-screens` (hoja `formSheet`) y
`@expo/vector-icons`.

**Storage**: PostgreSQL 17. Una migración nueva (`recurring_payments`):
- enum `recurring_frequency`;
- tablas `recurring_payments` y `recurring_occurrences`;
- clave única `(recurring_payment_id, period)`;
- CHECKs de montos, nombre, periodo y pago.

Detalle en [data-model.md](./data-model.md).

**Testing**:
- **Dominio**: Vitest en `packages/domain`, con meses cortos, febrero bisiesto, anual 29 feb,
  cambio de año, pausa y reanudación, y totales del criterio. Umbral de cobertura 95%.
- **API**: Jest e2e contra PostgreSQL real con `HOME_NOW` (23 nov 2026):
  - CRUD, mes, pagos y aislamiento en todos los endpoints;
  - dos lecturas simultáneas sin duplicados;
  - otros relojes para la reanudación y el cambio de día.
- **App**: se valida a mano con [quickstart.md](./quickstart.md) B10.

**Target Platform**: API en contenedor Linux (`node:24-alpine`); app en Expo Go (iOS y Android).

**Project Type**: monorepo móvil + API.

**Performance Goals**:
- La vista de un mes y `GET /summary` usan un número fijo de consultas sin importar cuántos pagos
  hay: bloquear los pagos, insertar las que falten con `createMany` y leer el mes con un join.
- Congelar la historia (R5) inserta como máximo un mes por cada mes transcurrido desde
  `starts_on`, en una sola sentencia.

**Constraints**:
- Una ocurrencia por pago y periodo, garantizada en la base (FR-003).
- Las ocurrencias pagadas nunca cambian ni se borran (FR-004, FR-005, FR-007).
- "Hoy" del servidor en la zona del usuario (FR-008).
- Los recurrentes no tocan tarjetas (FR-011).
- Estados escritos, no solo color (principio IX).

**Scale/Scope**:
- **API**: 2 tablas, 1 migración y 11 operaciones nuevas (8 endpoints de `/recurring` y 3 de
  `/occurrences`), más `GET /summary` ampliado.
- **Dominio**: ~10 funciones puras.
- **App**: 1 pestaña, 6 pantallas nuevas (una de ellas la hoja), el inicio y el TabBar
  ampliados, 7 componentes nuevos y StatusChip ampliado.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo se cumple en esta spec | Estado |
| --- | --- | --- |
| I. Dominio puro | Calendario, periodos, pausa/reanudación, estados, totales, orden, límites del mes y validaciones en `packages/domain/src/recurring.ts`, sin reloj ni I/O ("hoy" como parámetro). El API reúne datos, bloquea e inserta; la app solo muestra y valida con las mismas funciones del dominio. | ✅ |
| II. Pruebas primero | Pruebas del dominio con el criterio 31 ene → 28 feb → 31 mar → 30 abr, días 29/30/31, febrero bisiesto y no bisiesto, anual 29 feb y cambio de año, antes de implementar. E2e de cada endpoint contra PostgreSQL real. | ✅ |
| III. Aislamiento | `userId` del token; pagos filtrados por `user_id` y ocurrencias por el join con su pago (también de pagos eliminados); ajeno = inexistente = id inválido: 404. `recurring-isolation.e2e-spec.ts` con dos usuarios en los 11 endpoints nuevos (8 de `/recurring` y 3 de `/occurrences`) y en `/summary`. | ✅ |
| IV. Dinero y fechas | Montos `BIGINT` (enteros en el dominio y la respuesta, `toNumberAmount`); `first_due_date`, `anchor_date`, `starts_on`, `paused_on`, `due_date` y `paid_at` como `DATE`; "hoy" en la zona del usuario. No hay intereses en esta spec. | ✅ |
| V. Seguridad | Sin endpoints públicos; guard global y contraseña temporal aplican a las rutas nuevas. Sin datos sensibles nuevos. | ✅ |
| VI. Simplicidad | Sin cron ni dependencias; una sola ruta de borrado (lógico); periodos como texto en lugar de una tabla de intervalos; recordatorios push y cargar a tarjeta fuera (spec 006 y v2). | ✅ |
| VII. Configuración por entorno | Sin variables nuevas. | ✅ |
| VIII. Convenciones | Código, tablas (`recurring_payments`, `recurring_occurrences`), rutas y valores (`monthly`, `annual`, `active`, `paused`, `pending`, `overdue`, `paid`) en inglés; textos de la app en español. | ✅ |
| IX. Sistema de diseño | StatTile, ListRow (RecurringRow), StatusChip y TabBar según `docs/design-system.md`; Pendiente con el par ya medido `warning`/`warningSoft` (5,20); estados escritos; áreas táctiles ≥ 44; sin tokens nuevos; componentes nuevos documentados en el sistema de diseño. | ✅ |

**Resultado (pre-Phase 0)**: PASA sin violaciones.
**Re-evaluación (post-Phase 1)**: PASA.
- El contrato ([contracts/recurring.openapi.yaml](./contracts/recurring.openapi.yaml)) no recibe
  ids de usuario y responde igual a recursos ajenos que a inexistentes.
- El modelo guarda dinero en `BIGINT` y fechas en `DATE`.
- `GET /summary` ahora puede insertar ocurrencias (R4); se documenta como cambio respecto de la
  spec 004 y no afecta ningún principio.

## Project Structure

### Documentation (this feature)

```text
specs/005-recurring-payments/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── recurring.openapi.yaml   # /recurring, /recurring/occurrences, /occurrences, Summary.recurring
│   └── screens.md               # pestaña Pagos, Mis pagos, formularios, detalle, hoja, inicio
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks
```

### Source Code (repository root)

```text
packages/domain/src/
├── recurring.ts                 # calendario, duePeriods, estados, summarizeMonth, nextDueDate, monthBounds, validaciones
├── recurring.test.ts
└── index.ts                     # + export

apps/api/
├── prisma/schema.prisma         # + RecurringFrequency, RecurringPayment, RecurringOccurrence (User.recurringPayments)
├── prisma/migrations/<ts>_recurring_payments/migration.sql   # + CHECKs a mano
├── src/app.module.ts            # + RecurringModule
├── src/common/errors.ts         # + RECURRING_DELETED
├── src/recurring/
│   ├── recurring.module.ts
│   ├── recurring.schemas.ts     # create, update, pay, month (validadores del dominio)
│   ├── recurring.mapper.ts      # filas → RecurringPayment / Occurrence / MonthView
│   ├── recurring.controller.ts  # /recurring (occurrences antes que :id)
│   ├── occurrences.controller.ts # /occurrences/:id, /occurrences/:id/payment
│   └── recurring.service.ts     # lockUserPayments, materializeMonth, materializeThrough, monthView, CRUD, pause/resume, pay/unpay
├── src/summary/summary.service.ts  # + recurring (monthView del mes actual), también sin tarjetas
└── test/
    ├── recurring.e2e-spec.ts            # crear, validar, listar, detalle, editar, pausar, reanudar, eliminar
    ├── occurrences.e2e-spec.ts          # mes, totales, orden, pagar, deshacer, eliminado, límites, concurrencia
    ├── recurring-isolation.e2e-spec.ts  # dos usuarios en todos los endpoints
    └── summary.e2e-spec.ts              # + sección del mes

apps/mobile/src/
├── app/(app)/
│   ├── (tabs)/_layout.tsx       # + payments entre register y profile
│   ├── (tabs)/payments.tsx      # vista por mes + "Mis pagos"
│   ├── (tabs)/home.tsx          # + RecurringSection
│   ├── recurring/index.tsx      # Mis pagos
│   ├── recurring/new.tsx
│   ├── recurring/[id]/index.tsx # detalle: editar, pausar/reanudar, eliminar
│   ├── recurring/[id]/edit.tsx
│   ├── occurrence/[id]/index.tsx
│   ├── occurrence/[id]/pay.tsx  # hoja formSheet con el monto prellenado
│   └── _layout.tsx              # + rutas nuevas
├── api/
│   ├── recurring.ts             # tipos, llamadas y recurringKeys (todas bajo ['recurring'])
│   └── summary.ts               # + recurring: MonthView
├── components/
│   ├── StatTile.tsx
│   ├── RecurringRow.tsx
│   ├── MonthOverview.tsx
│   ├── MonthNavigator.tsx
│   ├── RecurringSection.tsx
│   ├── RecurringForm.tsx
│   ├── PayOccurrenceForm.tsx
│   ├── StatusChip.tsx           # + pending
│   └── TabBar.tsx               # + ícono de payments
├── features/
│   ├── recurring-schema.ts      # formularios con validadores del dominio
│   ├── recurring-cache.ts       # invalidateRecurring → ['recurring'] y ['summary']
│   └── months.ts                # "noviembre de 2026", mes anterior/siguiente, "Mensual · día 5"
└── theme/                       # sin cambios

docs/design-system.md            # StatTile, ListRow, MonthOverview, MonthNavigator, StatusChip pending, TabBar con Pagos
docs/mvp-spec.md                 # tabla del API (+ detalles), 005 cerrada al final
```

**Structure Decision**: misma estructura de monorepo.
- **Dominio**: agrega `recurring.ts`.
- **API**:
  - crea el módulo `recurring`, con dos controladores (el de `occurrences` aparte para sus
    rutas de primer nivel) y un servicio que también usa `SummaryService`;
  - reutiliza `LedgerService.todayFor` para "hoy".
- **App**:
  - concentra la vista del mes en `MonthOverview`, usada por el inicio y la pestaña;
  - concentra la invalidación en `recurring-cache.ts`.

## Complexity Tracking

Sin violaciones de la constitución; no se requiere justificación.
