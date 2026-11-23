# Implementation Plan: Inicio y simulador

**Branch**: `004-home-simulator` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-home-simulator/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Inicio con el resumen de la tarjeta al frente y simulación en vivo al registrar una compra (HU-05
y HU-08 de `docs/mvp-spec.md`, sin los pagos recurrentes). `packages/domain` gana
`simulatePurchase` (plan de la spec 003 + estado que tendría cada extracto + tope del ciclo y cupo
después de la compra), `nextPayment` y los umbrales `budgetLevel` (70/100) y `paymentUrgency`
(5 días). El API agrega dos lecturas sin escrituras: `POST /cards/:id/simulate` (mismas
validaciones que el registro, con el "hoy" del servidor) y `GET /summary` (tarjetas activas con
próximo pago, próximo corte y uso del tope, en un número fijo de consultas). La app reemplaza el
inicio temporal por saludo, carrusel y CycleSummary; agrega el botón central "Registrar compra"
al TabBar; une el registro en una sola pantalla `purchase/new` con selector de tarjeta y un panel
de simulación que se actualiza 350 ms después de cada cambio, mostrando los últimos valores
atenuados mientras recalcula y descartando respuestas viejas. Toda mutación de compras, pagos y
tarjetas invalida `['summary']`. Sin migraciones ni dependencias
nuevas. Detalle en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict) sobre Node.js 24; Expo SDK 58 (React Native 0.88,
Hermes).

**Primary Dependencies**: sin dependencias nuevas (R13). Se usan NestJS 12, Prisma 7, zod,
TanStack Query, react-hook-form, Zustand, expo-router y `@expo/vector-icons`.

**Storage**: PostgreSQL 17 sin cambios de esquema; solo lecturas de `cards`, `purchases`,
`installments` y `statements` ([data-model.md](./data-model.md)).

**Testing**: Vitest en `packages/domain` (criterios de la spec, fechas pasadas, umbrales en sus
bordes; umbral 95%); Jest e2e contra PostgreSQL real con el reloj en `2026-11-23T15:00:00Z` para
`simulate` y `summary`, incluido el aislamiento y la comprobación de que simular no escribe; la app
se valida a mano con [quickstart.md](./quickstart.md) B8.

**Target Platform**: API en contenedor Linux (`node:24-alpine`); app en Expo Go (iOS y Android).

**Project Type**: monorepo móvil + API.

**Performance Goals**: simulación visible en menos de 1 s tras dejar de escribir (SC-003): 350 ms
de espera + una lectura de pocas consultas; 72 cuotas como máximo. `GET /summary` con un número fijo de consultas (zona del usuario, tarjetas, deuda, extractos vencidos o por pagar y sus totales, totales de los abiertos)
sin importar el número de tarjetas (sin N+1).

**Constraints**: simular no escribe ni bloquea (FR-005); mismo dominio y mismas validaciones que el
registro (FR-001, FR-006); "hoy" del servidor en días y estados (FR-022); interés siempre
"estimado" (principio IV); estados y niveles escritos, no solo color (principio IX).

**Scale/Scope**: 2 endpoints nuevos; 4 funciones puras nuevas en el dominio; 1 pantalla nueva
(`purchase/new`) que reemplaza otra, el inicio reescrito, el TabBar ampliado; 5 componentes nuevos
(ProgressBar, CycleSummary, SimulationPanel, CardPicker, EmptyCards) y 2 ampliados (CardCarousel,
PurchaseForm).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo se cumple en esta spec | Estado |
| --- | --- | --- |
| I. Dominio puro | `simulatePurchase`, `nextPayment`, `budgetLevel` y `paymentUrgency` en `packages/domain`, sin reloj ni I/O ("hoy" como parámetro). El API solo reúne datos y llama al dominio; la app no calcula cuotas ni estados, solo importa los umbrales del dominio para elegir colores. | ✅ |
| II. Pruebas primero | Pruebas del dominio con los dos criterios de la spec, fechas pasadas (extractos existentes pagados y no pagados, nuevos vencidos), umbrales 69/70/99/100 y 6/5/0/−1 días. E2e de `simulate` y `summary` contra PostgreSQL real. | ✅ |
| III. Aislamiento | `userId` del token; `simulate` busca la tarjeta filtrando por usuario (ajena = inexistente = id inválido: 404); `summary` filtra tarjetas y extractos por usuario. E2e con dos usuarios para ambos. | ✅ |
| IV. Dinero y fechas | Montos enteros en el dominio y la respuesta (`BIGINT` → número seguro con `toNumberAmount`); porcentajes con floor; fechas `IsoDate` en la zona del usuario; intereses y totales con interés marcados "estimado" en la simulación y el resumen. | ✅ |
| V. Seguridad | Sin endpoints públicos; guard global y contraseña temporal aplican a las rutas nuevas. Sin datos sensibles nuevos. | ✅ |
| VI. Simplicidad | Sin tablas, migraciones ni dependencias; tarjeta al frente en memoria; simulación solo al registrar (no al editar); notificaciones y recurrentes fuera (specs 005 y 006). | ✅ |
| VII. Configuración por entorno | Sin variables nuevas. | ✅ |
| VIII. Convenciones | Código, rutas (`/summary`, `/simulate`) y valores (`normal`, `warning`, `danger`, `soon`, `overdue`) en inglés; textos de la app en español. | ✅ |
| IX. Sistema de diseño | CycleSummary, ProgressBar y TabBar según `docs/design-system.md`; token nuevo `layout.tabCenterButton` (56); componentes nuevos documentados ahí; colores de urgencia y tope con texto ("Pronto", "Vencido", "Superaste el tope"); áreas táctiles ≥ 44; contraste AA con pares ya medidos (warning/warningSoft 5,20; danger/dangerSoft 6,05). | ✅ |

**Resultado (pre-Phase 0)**: PASA sin violaciones.
**Re-evaluación (post-Phase 1)**: PASA. El contrato
([contracts/home.openapi.yaml](./contracts/home.openapi.yaml)) no recibe ids de usuario, responde
igual a una tarjeta ajena que a una inexistente y no escribe; el modelo no cambia la base.

## Project Structure

### Documentation (this feature)

```text
specs/004-home-simulator/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── home.openapi.yaml        # POST /cards/:id/simulate, GET /summary
│   └── screens.md               # inicio, TabBar, purchase/new, componentes nuevos
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks
```

### Source Code (repository root)

```text
packages/domain/src/
├── simulation.ts                # simulatePurchase
├── simulation.test.ts           # criterios de la spec, fechas pasadas, ciclo siguiente, cupo
├── statements.ts                # + nextPayment, budgetLevel, paymentUrgency y sus constantes
├── statements.test.ts           # + bordes de umbrales y selección del próximo pago
└── index.ts                     # + exports

apps/api/src/
├── app.module.ts                # + SummaryModule
├── ledger/ledger.service.ts     # + totalsForCutoffs (A pagar de varios extractos abiertos en una consulta)
├── purchases/
│   ├── purchases.schemas.ts     # + simulatePurchaseSchema (= create sin concept)
│   ├── purchases.controller.ts  # + POST cards/:id/simulate
│   └── purchases.service.ts     # + simulate (solo lectura)
└── summary/
    ├── summary.module.ts
    ├── summary.controller.ts    # GET /summary
    └── summary.service.ts

apps/api/test/
├── simulate.e2e-spec.ts         # criterios, igual al registro, no escribe, validaciones, archivada
├── summary.e2e-spec.ts          # orden, próximo pago (por pagar, vencido, ninguno), tope, sin tarjetas
└── home-isolation.e2e-spec.ts   # dos usuarios: simulate y summary

apps/mobile/src/
├── app/(app)/
│   ├── (tabs)/_layout.tsx       # + register entre cards y profile
│   ├── (tabs)/home.tsx          # inicio real
│   ├── (tabs)/register.tsx      # ruta vacía del botón central
│   ├── purchase/new.tsx         # registrar con CardPicker y simulación (reemplaza card/[id]/purchases/new)
│   ├── card/[id]/index.tsx      # "Registrar compra" → purchase/new?cardId=
│   └── _layout.tsx              # rutas: + purchase/new, − card/[id]/purchases/new
├── api/
│   ├── summary.ts               # getSummary, summaryKeys
│   └── purchases.ts             # + simulatePurchase
├── components/
│   ├── TabBar.tsx               # + botón central
│   ├── CardCarousel.tsx         # + onActiveChange
│   ├── PurchaseForm.tsx         # + simulación (props de tarjeta cambiables)
│   ├── ProgressBar.tsx
│   ├── CycleSummary.tsx
│   ├── SimulationPanel.tsx
│   ├── CardPicker.tsx
│   └── EmptyCards.tsx
├── features/
│   ├── front-card-store.ts      # Zustand en memoria
│   ├── use-debounced-value.ts
│   ├── use-refetch-on-app-active.ts
│   ├── days.ts                  # "Hoy", "Mañana", "En N días", "Hace N días"
│   └── ledger-cache.ts          # + ['summary'] en invalidateCardLedger; invalidateCards nuevo
├── api/client.ts                # apiFetch acepta signal (cancela simulaciones viejas)
└── theme/spacing.ts             # + layout.tabCenterButton = 56, interaction.staleOpacity = 0.85

docs/design-system.md            # TabBar con botón central; CycleSummary, CardPicker, SimulationPanel, EmptyCards
docs/mvp-spec.md                 # 004 cerrada al final
```

**Structure Decision**: misma estructura de monorepo. El dominio agrega `simulation.ts` y amplía
`statements.ts`. El API pone `simulate` en el módulo `purchases` (comparte esquema y reglas con el
registro) y crea `summary` como módulo propio que reutiliza `LedgerService`. La app une el registro
en `purchase/new` y concentra la simulación en `PurchaseForm` + `SimulationPanel`.

## Complexity Tracking

Sin violaciones de la constitución; no se requiere justificación.
