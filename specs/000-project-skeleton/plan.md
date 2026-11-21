# Implementation Plan: Esqueleto del proyecto Corte

**Branch**: `000-project-skeleton` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/000-project-skeleton/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Crear la base del monorepo Corte sin lógica de negocio: un workspace pnpm con `packages/domain`
(TypeScript puro con Vitest y cobertura), `apps/api` (NestJS + Prisma 7 con `@prisma/adapter-pg`
sobre PostgreSQL 17, con `GET /api/v1/health` que reporta estado, versión y base de datos, con
HTTP 200 o 503) y `apps/mobile` (Expo + expo-router + TanStack Query, con tema y componentes `Text`
y `Button` del sistema de diseño y una pantalla temporal "Conectado" / "Sin conexión"). El API se
empaqueta en una imagen Docker multi-stage configurada solo por variables de entorno, y un workflow
de GitHub Actions ejecuta lint, typecheck, pruebas del dominio, e2e del API contra PostgreSQL real
y build de la imagen en cada PR. Detalle de decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript (strict) sobre Node.js 24 LTS; pnpm 10 (fijado con `packageManager`
y Corepack).

**Primary Dependencies**:
- Raíz: ESLint (flat config) + typescript-eslint, Prettier.
- `packages/domain`: sin dependencias de runtime; Vitest + `@vitest/coverage-v8` (dev).
- `apps/api`: NestJS (última estable), `@nestjs/config`, `@nestjs/terminus`, `@nestjs/swagger`,
  Prisma 7 (`prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`), zod, `dotenv` (solo para la
  CLI de Prisma, ver research R4).
- `apps/mobile`: Expo SDK (última estable), expo-router, `@tanstack/react-query`,
  `@expo-google-fonts/inter`, `@expo-google-fonts/plus-jakarta-sans`, `expo-font`,
  `expo-splash-screen`.

**Storage**: PostgreSQL 17. Esta spec no crea tablas: la base solo se usa para el chequeo de salud.

**Testing**: Vitest + v8 (dominio); Jest (unitarias) y Jest + supertest (e2e contra PostgreSQL
real) en el API. La app móvil no tiene pruebas automatizadas en esta spec (la constitución las exige
en dominio y API); se valida con la guía manual de [quickstart.md](./quickstart.md).

**Target Platform**: API en un contenedor Linux (`node:24-alpine`); app en simulador iOS y
emulador Android (Expo Go o development build); CI en runners `ubuntu-latest`.

**Project Type**: monorepo móvil + API (`apps/api`, `apps/mobile`, `packages/domain`).

**Performance Goals**: endpoint de salud en ≤ 3 s incluso con la base colgada (timeout de la base de
2 s); la app muestra el resultado en ≤ 6 s (timeout de 5 s).

**Constraints**: imagen final < 300 MB; usuario no root; configuración solo por variables de entorno;
sin secretos en el repositorio ni en la imagen; Swagger prohibido en producción.

**Scale/Scope**: 3 paquetes, 1 endpoint, 1 pantalla temporal, 2 componentes base, 1 workflow de CI.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo se cumple en esta spec | Estado |
| --- | --- | --- |
| I. Dominio puro | `packages/domain` sin dependencias de runtime; una regla de ESLint prohíbe importar módulos de Node (`fs`, `http`, etc.) y paquetes de I/O dentro del dominio. Aún no tiene reglas de negocio. | ✅ |
| II. Pruebas primero | Vitest con cobertura en el dominio; unitarias del esquema de entorno y del mapeo de salud en el API; e2e de `/api/v1/health` contra PostgreSQL real (base arriba, base caída, base colgada); CI obligatoria para merge. | ✅ |
| III. Aislamiento por usuario | No aplica: no hay usuarios ni datos de usuario. El único endpoint es público por diseño (FR-005). | ✅ N/A |
| IV. Dinero y fechas | No aplica: no hay montos ni fechas de negocio. Los tokens `amount` ya incluyen números tabulares para cuando lleguen. | ✅ N/A |
| V. Seguridad | `.env.example` sin secretos y `.env*` en `.gitignore`; la imagen no copia archivos `.env`; contenedor no root; Swagger solo con `SWAGGER_ENABLED=true`, y la validación de entorno rechaza `SWAGGER_ENABLED=true` con `APP_ENV=production`. argon2, JWT y rate limiting quedan para la spec de autenticación. | ✅ |
| VI. Simplicidad | Sin Turborepo; sin tablas ni migraciones; Zustand no se instala hasta que una spec necesite estado global (ver research R11). | ✅ |
| VII. Configuración por entorno | Toda la configuración del API sale de variables validadas con zod; la misma imagen corre en cualquier entorno. `GIT_SHA` se incrusta como build arg porque identifica la imagen, no al entorno, y se puede sobrescribir por variable. | ✅ |
| VIII. Convenciones | Código, nombres y commits en inglés; README, specs y textos de la UI en español. | ✅ |
| IX. Sistema de diseño | Tokens copiados exactos de `docs/design-system.md` en `apps/mobile/src/theme`; `Text` y `Button` usan solo tokens; botón de alto 44; el estado se muestra con texto; contraste AA con los colores del sistema. | ✅ |

**Resultado (pre-Phase 0)**: PASA sin violaciones.
**Re-evaluación (post-Phase 1)**: PASA. El diseño de [contracts/](./contracts/) y
[data-model.md](./data-model.md) no introduce entidades persistidas, endpoints autenticados ni
configuración fuera de variables de entorno.

## Project Structure

### Documentation (this feature)

```text
specs/000-project-skeleton/
├── plan.md                      # Este archivo
├── research.md                  # Phase 0
├── data-model.md                # Phase 1
├── quickstart.md                # Phase 1
├── contracts/
│   ├── health.openapi.yaml      # Contrato HTTP de /api/v1/health
│   ├── environment.md           # Variables de entorno de API, imagen y app
│   └── health-screen.md         # Contrato de UI de la pantalla temporal
├── checklists/requirements.md   # Generado por /speckit-specify
└── tasks.md                     # Phase 2 (/speckit-tasks; no lo crea este comando)
```

### Source Code (repository root)

```text
.
├── package.json                 # scripts raíz: lint, typecheck, format, test, db:up, db:down
├── pnpm-workspace.yaml          # apps/*, packages/* (paquetes enlazados; research R2/R6)
├── tsconfig.base.json           # strict compartido
├── eslint.config.mjs            # flat config único; `pnpm lint` = `eslint .` en la raíz
├── .prettierrc / .prettierignore
├── .nvmrc                       # 24
├── .gitignore / .dockerignore
├── docker-compose.yml           # postgres:17-alpine en 5434, bases corte_dev y corte_test
├── docker/postgres/init.sql     # crea corte_test
├── README.md                    # en español
├── .github/workflows/ci.yml
├── packages/domain/
│   ├── package.json             # exports → dist; scripts build, test, test:cov
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── index.ts
│       └── index.test.ts        # prueba de humo
├── apps/api/
│   ├── package.json
│   ├── tsconfig.json / tsconfig.build.json
│   ├── nest-cli.json
│   ├── prisma.config.ts         # Prisma 7: ruta del schema y DATABASE_URL
│   ├── prisma/schema.prisma     # generator prisma-client (cjs), sin modelos
│   ├── Dockerfile
│   ├── .env.example
│   ├── src/
│   │   ├── main.ts              # prefijo api/v1, Swagger condicional
│   │   ├── app.module.ts
│   │   ├── config/
│   │   │   ├── env.schema.ts    # zod
│   │   │   └── env.schema.spec.ts
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   └── health/
│   │       ├── health.module.ts
│   │       ├── health.controller.ts
│   │       ├── health.service.ts
│   │       └── health.service.spec.ts
│   └── test/
│       ├── jest-e2e.json
│       └── health.e2e-spec.ts
└── apps/mobile/
    ├── package.json
    ├── app.json
    ├── tsconfig.json
    ├── metro.config.js          # solo si la detección automática de monorepo no basta
    ├── .env.example             # EXPO_PUBLIC_API_URL
    └── src/
        ├── app/
        │   ├── _layout.tsx      # fuentes, splash, QueryClientProvider
        │   └── index.tsx        # pantalla temporal de salud
        ├── theme/
        │   ├── colors.ts
        │   ├── typography.ts
        │   ├── spacing.ts       # espaciado y radios
        │   └── index.ts
        ├── components/
        │   ├── Text.tsx
        │   └── Button.tsx
        └── api/
            ├── config.ts        # lectura de EXPO_PUBLIC_API_URL
            └── health.ts        # fetch con timeout de 5 s + hook de TanStack Query
```

**Structure Decision**: monorepo pnpm con los tres paquetes que fija la constitución. Las rutas de
expo-router viven en `apps/mobile/src/app` para separar rutas de tema, componentes y cliente del
API. No hay carpeta `infra/` porque la infraestructura del servidor está fuera de alcance.

## Complexity Tracking

Sin violaciones de la constitución; no se requiere justificación.
