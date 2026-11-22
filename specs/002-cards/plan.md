# Implementation Plan: Tarjetas y dominio de ciclos

**Branch**: `002-cards` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-cards/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Tarjetas de crédito por usuario y las reglas de ciclo que usarán todas las specs siguientes
(HU-02 y reglas "Ciclos y extractos" 1–3 de `docs/mvp-spec.md`). `packages/domain` gana un
calendario propio sobre strings `YYYY-MM-DD` (sin `Date` ni librerías) y las reglas de corte y
fecha límite: el corte de una fecha, la fecha límite de un corte, el próximo corte y la próxima
fecha límite. Sus pruebas incluyen una comparación exhaustiva contra una implementación de
referencia, y la cobertura mínima de 95% hace fallar la CI. El API agrega el modelo `Card`
(montos `BIGINT`, color como enum) y siete operaciones: listar activas o archivadas, crear, ver
con el ciclo calculado en la zona del usuario, editar, archivar y restaurar. Todas tienen e2e de
aislamiento. La app pasa a pestañas (Inicio, Tarjetas, Perfil) con una TabBar propia, carrusel de
tarjetas, detalle, formulario con selector de color accesible y lista de archivadas. Detalle en
[research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict) sobre Node.js 24; Expo SDK 58 (React Native 0.88,
Hermes).

**Primary Dependencies** (nuevas en esta spec):
- `apps/mobile`: `@expo/vector-icons` (íconos de la TabBar; Expo 58 ya no la incluye; JS + fuentes,
  funciona en Expo Go; research.md R8).
- Sin cambios: NestJS 12, Prisma 7, zod, TanStack Query, react-hook-form, expo-router.
- `packages/domain` sigue sin dependencias de ejecución.

**Storage**: PostgreSQL 17, tabla nueva `cards` con enum `card_color`, montos `BIGINT` y `CHECK` de
rangos (migración de Prisma más SQL a mano).

**Testing**: Vitest en `packages/domain` (casos fijos de calendario y comparación exhaustiva con una
referencia, umbral de cobertura 95%); Jest unitarias y e2e contra PostgreSQL real en el API, con
aislamiento de todos los endpoints de tarjetas; la app se valida a mano con
[quickstart.md](./quickstart.md).

**Target Platform**: API en contenedor Linux (`node:24-alpine`); app en Expo Go (iOS y Android).

**Project Type**: monorepo móvil + API.

**Performance Goals**: listas de decenas de tarjetas por usuario; cálculos de ciclo O(1) (sin bucles
por día); una consulta indexada por solicitud.

**Constraints**: fechas de negocio sin hora y en la zona del usuario (principio IV); montos enteros
COP; `Intl` de Hermes solo para formatear montos y calcular "hoy" (verificado en iOS, Android en el
quickstart); nada de `Temporal`.

**Scale/Scope**: 7 endpoints, 5 pantallas nuevas (pestaña Tarjetas, formulario, detalle,
archivadas, más la TabBar), ~15 funciones puras en el dominio.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo se cumple en esta spec | Estado |
| --- | --- | --- |
| I. Dominio puro | Calendario y reglas de ciclo en `packages/domain`, sin I/O ni reloj; "hoy" entra como parámetro. El API y la app no reimplementan reglas: el API calcula el ciclo con el dominio y la app solo calcula días restantes con `daysBetween` del dominio. Las reglas de validación de tarjetas también viven en el dominio. Convertir el instante actual a la fecha de la zona del usuario (Intl) queda en el API, por decisión del usuario; es lectura del reloj, no una regla de negocio. | ✅ |
| II. Pruebas primero | Pruebas del dominio con todos los bordes exigidos (febrero 28/29, meses de 30, días 29–31, cambio de año) más la comparación exhaustiva; umbral 95% en la CI. E2e de cada endpoint de tarjetas contra PostgreSQL real. | ✅ |
| III. Aislamiento | `userId` siempre del token; toda consulta filtra por `{ id, userId }`; una tarjeta ajena responde igual que una inexistente. E2e con dos usuarios para los 7 endpoints. | ✅ |
| IV. Dinero y fechas | Montos `BIGINT` en la base y enteros en el código (number en JSON, con verificación de entero seguro). Fechas de negocio como `YYYY-MM-DD` sin hora y calculadas en la zona del usuario. No hay intereses en esta spec. | ✅ |
| V. Seguridad | Sin endpoints públicos nuevos; el guard global y la restricción de contraseña temporal aplican a `/cards`. Sin datos sensibles nuevos (solo últimos 4 dígitos, opcionales). | ✅ |
| VI. Simplicidad | Sin librerías de fechas; ciclo derivado sin tabla; cupo disponible = cupo hasta la spec 003; sin reordenar tarjetas ni borrarlas. | ✅ |
| VII. Configuración por entorno | Sin variables nuevas. | ✅ |
| VIII. Convenciones | Código, rutas y códigos de error en inglés; textos de la app en español. | ✅ |
| IX. Sistema de diseño | CreditCardView, CardCarousel y TabBar según `docs/design-system.md`; texto sobre los 6 colores de tarjeta con contraste AA (blanco ≥ 7,13; secundario ≥ 5,20, calculado); áreas táctiles ≥ 44; montos con números tabulares; estados con texto (pestaña activa, color elegido, tarjeta archivada). | ✅ |

**Resultado (pre-Phase 0)**: PASA sin violaciones.
**Re-evaluación (post-Phase 1)**: PASA. El contrato ([contracts/cards.openapi.yaml](./contracts/cards.openapi.yaml))
no recibe ids de usuario y trata igual una tarjeta ajena que una inexistente; el modelo
([data-model.md](./data-model.md)) usa `BIGINT` y borra en cascada.

## Project Structure

### Documentation (this feature)

```text
specs/002-cards/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── cards.openapi.yaml       # /cards y /cards/:id(/archive|/restore)
│   ├── errors.md                # CARD_ARCHIVED, códigos por campo
│   └── screens.md               # Pestañas, carrusel, detalle, formulario
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks
```

### Source Code (repository root)

```text
packages/domain/
├── vitest.config.ts             # + thresholds 95%
└── src/
    ├── calendar.ts              # IsoDate, parse/format, bisiestos, días del mes, clamp, addMonths, daysBetween
    ├── calendar.test.ts
    ├── cycles.ts                # cutoffForDate, dueDateForCutoff, cycleForDate, nextCutoff, nextDueDate
    ├── cycles.test.ts           # casos fijos de FR-008 y de la historia 1
    ├── cycles.reference.test.ts # comparación exhaustiva con la referencia día a día
    ├── card-rules.ts            # CARD_COLORS, límites, valores por defecto, validadores
    ├── card-rules.test.ts
    └── index.ts                 # + exports

apps/api/
├── prisma/
│   ├── schema.prisma            # + enum CardColor, model Card, relación en User
│   └── migrations/              # + migración de cards (con CHECK a mano)
├── src/
│   ├── app.module.ts            # + CardsModule
│   ├── common/
│   │   ├── errors.ts            # + CARD_ARCHIVED
│   │   ├── clock.ts             # proveedor Clock (now); las e2e lo fijan en 2026-11-22T02:30:00Z
│   │   └── today.ts             # todayInTimeZone(timeZone, now) con Intl
│   └── cards/
│       ├── cards.module.ts
│       ├── cards.controller.ts  # 7 rutas
│       ├── cards.service.ts     # consultas por { id, userId }, archivar/restaurar, ciclo
│       ├── cards.schemas.ts     # zod con las reglas del dominio (crear, editar, query)
│       ├── card.mapper.ts       # BigInt ↔ number verificado, PublicCard, availableCredit
│       └── *.spec.ts
└── test/
    ├── cards.e2e-spec.ts            # crear, listar, detalle con ciclo, editar, archivar, restaurar
    └── cards-isolation.e2e-spec.ts  # dos usuarios, los 7 endpoints

apps/mobile/src/
├── app/
│   ├── index.tsx                    # (existente) redirige a /home
│   └── (app)/
│       ├── _layout.tsx              # Stack: anchor (tabs); Protected envuelve (tabs) y card/*
│       ├── (tabs)/
│       │   ├── _layout.tsx          # Tabs con TabBar propia
│       │   ├── home.tsx             # movido desde (app)/home.tsx, sin botón "Perfil"
│       │   ├── cards.tsx            # carrusel, estado vacío, Agregar, Archivadas
│       │   └── profile.tsx          # movido desde (app)/profile.tsx
│       ├── card/
│       │   ├── new.tsx
│       │   ├── archived.tsx
│       │   └── [id]/
│       │       ├── index.tsx        # detalle
│       │       └── edit.tsx
│       ├── timezone.tsx · delete-account.tsx · change-password.tsx   # (existentes)
├── api/cards.ts                     # llamadas y tipos de /cards
├── components/
│   ├── TabBar.tsx
│   ├── CreditCardView.tsx
│   ├── CardCarousel.tsx
│   ├── ColorPicker.tsx
│   └── CardForm.tsx                 # formulario compartido por crear y editar
└── features/
    ├── money.ts                     # formatCop, parseo de montos
    ├── dates.ts                     # "8 de diciembre de 2026", "Hoy" / "Mañana" / "faltan N días"
    └── card-schema.ts               # zod del formulario con @corte/domain
```

**Structure Decision**: misma estructura de monorepo. El dominio se divide por tema (calendario,
ciclos, reglas de tarjeta); el API agrega un módulo `cards`; la app agrega el grupo `(tabs)` y las
rutas `card/*` en el Stack de `(app)`.

## Complexity Tracking

Sin violaciones de la constitución; no se requiere justificación.
