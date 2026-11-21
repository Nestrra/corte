# Implementation Plan: Autenticación de Corte

**Branch**: `001-auth` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-auth/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Cuentas de usuario y sesiones para Corte (HU-01 de `docs/mvp-spec.md`). El API agrega registro,
inicio de sesión, renovación y cierre de sesión, perfil con zona horaria, cambio de contraseña
(voluntario y obligatorio), eliminación de la cuenta y un comando de administrador para restablecer
contraseñas. Las contraseñas se guardan con argon2id; el acceso usa un JWT de 15 minutos y un
refresh token opaco, rotado en cada uso y agrupado por familia (una familia = una sesión de un
dispositivo) para detectar reutilización. Un guard global exige autenticación, comprueba que la
sesión siga activa y aplica la restricción de "debe cambiar la contraseña". La app reemplaza la
pantalla de conexión de la spec 000 por grupos de rutas `(auth)` y `(app)` protegidos con
`Stack.Protected`, guarda el refresh token en `expo-secure-store`, el access token en memoria
(Zustand), y renueva la sesión automáticamente ante un 401. Detalle en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict) sobre Node.js 24; Expo SDK 58 (React Native 0.88,
Hermes).

**Primary Dependencies** (nuevas en esta spec):
- `apps/api`: `argon2` (argon2id), `@nestjs/jwt`, `@nestjs/throttler`.
- `apps/mobile`: `zustand`, `expo-secure-store`, `react-hook-form`, `@hookform/resolvers`, `zod`,
  `@corte/domain` (workspace).
- Sin cambios: NestJS 12, Prisma 7 + `@prisma/adapter-pg`, PostgreSQL 17, expo-router, TanStack
  Query.

**Storage**: PostgreSQL 17 con las primeras tablas del proyecto: `users` y `refresh_tokens`
(migraciones de Prisma). Los contadores de intentos fallidos por email viven en memoria del API.

**Testing**: Vitest en `packages/domain` (reglas de cuenta); Jest unitarias y Jest + supertest e2e
contra PostgreSQL real en el API, con un archivo e2e por área, incluidas las pruebas de aislamiento
entre dos usuarios (principio III). La app se valida a mano con [quickstart.md](./quickstart.md).

**Target Platform**: API en contenedor Linux (`node:24-alpine`); app en Expo Go (iOS y Android).

**Project Type**: monorepo móvil + API (sin paquetes nuevos).

**Performance Goals**: el guard hace una consulta indexada por solicitud autenticada para validar la
sesión; registro e inicio de sesión dominados por argon2 (~50–100 ms por hash), aceptable para uso
familiar.

**Constraints**: una sola instancia del API (los límites de intentos viven en memoria); access token
de 15 min; sesión de 30 días por inactividad; sin secretos en el repo; mensajes de login que no
revelan si el email existe, incluido el tiempo de respuesta.

**Scale/Scope**: decenas de usuarios; 9 endpoints, 1 comando de administrador, 7 pantallas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo se cumple en esta spec | Estado |
| --- | --- | --- |
| I. Dominio puro | No hay cálculos de fechas, cuotas ni intereses. Las reglas de cuenta compartidas por API y app (longitudes de nombre y contraseña, normalización del email) se ponen en `packages/domain` como funciones puras con pruebas, para no duplicarlas. | ✅ |
| II. Pruebas primero | Unitarias del dominio y de los servicios de auth; e2e de cada endpoint contra PostgreSQL real; e2e del comando de administrador. Se escriben antes de implementar. | ✅ |
| III. Aislamiento por usuario | El `userId` sale siempre del token (`sub`); ningún endpoint recibe ids de usuario. E2e dedicadas con dos usuarios: perfil, zona horaria, cierre de sesión, cambio de contraseña y eliminación no afectan al otro; un token manipulado se rechaza. | ✅ |
| IV. Dinero y fechas | Zona horaria por usuario con valor por defecto `America/Bogota` y validación IANA en el API. Sin montos en esta spec. | ✅ |
| V. Seguridad | argon2id; JWT de 15 min con refresh rotado y detección de reutilización; límites de intentos en login y registro; `JWT_SECRET` solo por entorno (rechazado si es el valor de ejemplo en producción); Swagger sigue prohibido en producción; sin secretos en logs. | ✅ |
| VI. Simplicidad | Una sola instancia: límites en memoria en vez de Redis (limitación documentada). Sin gestión de sesiones multi-dispositivo. Cambio de nombre/email en v2. | ✅ |
| VII. Configuración por entorno | Variables nuevas `JWT_SECRET` y `TRUST_PROXY`; la imagen no cambia entre entornos. Las migraciones se aplican con un target `migrate` de la misma imagen. | ✅ |
| VIII. Convenciones | Código y códigos de error en inglés (`INVALID_CREDENTIALS`…); textos de UI en español, mapeados en la app. | ✅ |
| IX. Sistema de diseño | Pantallas con `Text`, `Button` y un nuevo `TextField` basado en tokens (radio 12, alto ≥ 44); errores con texto; contraste AA. | ✅ |

**Resultado (pre-Phase 0)**: PASA sin violaciones.
**Re-evaluación (post-Phase 1)**: PASA. El contrato ([contracts/auth.openapi.yaml](./contracts/auth.openapi.yaml))
no expone ids de usuario; el modelo ([data-model.md](./data-model.md)) borra en cascada.

## Project Structure

### Documentation (this feature)

```text
specs/001-auth/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── auth.openapi.yaml        # Endpoints /auth/* y /me
│   ├── errors.md                # Códigos de error y su texto en la app
│   ├── environment.md           # Variables nuevas del API
│   ├── admin-cli.md             # Comando de restablecimiento
│   └── screens.md               # Pantallas y navegación de la app
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks
```

### Source Code (repository root)

```text
packages/domain/src/
├── account-rules.ts             # NAME_MAX, PASSWORD_MIN/MAX, normalizeEmail, validadores puros
└── account-rules.test.ts

apps/api/
├── prisma/
│   ├── schema.prisma            # User, RefreshToken
│   └── migrations/              # primera migración
├── Dockerfile                   # + target `migrate`
├── src/
│   ├── app.module.ts            # + ThrottlerModule, JwtModule, AuthModule, UsersModule, guard global
│   ├── app.setup.ts             # + trust proxy
│   ├── config/env.schema.ts     # + JWT_SECRET, TRUST_PROXY
│   ├── common/
│   │   ├── errors.ts            # ErrorCode + AppException
│   │   ├── http-exception.filter.ts
│   │   └── zod-validation.pipe.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts           # register, login, refresh, logout, change-password
│   │   ├── auth.service.ts
│   │   ├── password.service.ts          # argon2id + hash señuelo
│   │   ├── tokens.service.ts            # JWT + refresh tokens (rotación, familias)
│   │   ├── login-attempts.service.ts    # bloqueo por email en memoria
│   │   ├── jwt-auth.guard.ts            # global: JWT + sesión activa + must_change
│   │   ├── decorators.ts                # @Public, @AllowPendingPasswordChange, @CurrentUser
│   │   ├── auth.schemas.ts              # zod de los cuerpos
│   │   └── *.spec.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── me.controller.ts             # GET/PATCH/DELETE /me
│   │   ├── users.service.ts             # perfil, zona horaria, eliminación, resetPassword
│   │   ├── timezone.ts                  # validación IANA
│   │   └── *.spec.ts
│   └── cli/reset-password.ts            # comando de administrador
└── test/
    ├── helpers.ts                       # app de prueba, limpieza de tablas, usuarios de prueba
    ├── auth.e2e-spec.ts
    ├── me.e2e-spec.ts
    ├── isolation.e2e-spec.ts
    ├── rate-limit.e2e-spec.ts
    └── admin-reset.e2e-spec.ts

apps/mobile/src/
├── app/
│   ├── _layout.tsx              # fuentes, QueryClient, arranque de sesión, Stack.Protected
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (app)/
│       ├── _layout.tsx          # obliga a change-password si mustChangePassword
│       ├── index.tsx            # inicio temporal
│       ├── profile.tsx
│       ├── timezone.tsx
│       ├── change-password.tsx  # obligatorio y voluntario
│       └── delete-account.tsx
├── session/
│   ├── session-store.ts         # Zustand: estado, accessToken, user, lastEmail
│   ├── secure-storage.ts        # refresh token y último email
│   └── bootstrap.ts             # restaurar sesión al abrir
├── api/
│   ├── config.ts                # (existente)
│   ├── client.ts                # fetch + renovación única ante 401
│   ├── errors.ts                # ApiError y textos en español por código
│   ├── auth.ts
│   └── me.ts
├── components/
│   ├── Text.tsx, Button.tsx     # (existentes)
│   └── TextField.tsx            # nuevo
└── features/timezones.ts        # lista curada
```

Se eliminan `apps/mobile/src/app/index.tsx` (pantalla de conexión) y `apps/mobile/src/api/health.ts`.

**Structure Decision**: misma estructura de monorepo; el API se organiza por módulos de Nest
(`auth`, `users`, `common`) y la app por grupos de rutas de expo-router y una carpeta `session`.

## Complexity Tracking

Sin violaciones de la constitución; no se requiere justificación.
