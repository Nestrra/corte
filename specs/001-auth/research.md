# Research: Autenticación de Corte

Fase 0 de [plan.md](./plan.md). Las decisiones de stack vienen del usuario; aquí se concretan y
se registran los puntos delicados. Consultado el 2026-11-21: docs de Expo SDK 58
(`router/advanced/protected`, `sdk/securestore`), `facebook/hermes/doc/IntlAPIs.md` y el paquete
`argon2` 0.45.2 en npm.

## R1. Contraseñas (argon2id)

- **Decision**: paquete `argon2` con `type: argon2id` y los parámetros por defecto de la librería
  (memoria 64 MiB, 3 iteraciones). `PasswordService` expone `hash`, `verify` y
  `verifyAgainstDummy`: cuando el email no existe se verifica contra un hash señuelo calculado al
  arrancar, para que el tiempo de respuesta no revele si la cuenta existe (FR-007).
- **Docker / pnpm**: `argon2` 0.45.2 trae binarios precompilados para `linux-x64` y `linux-arm64`
  en glibc y musl (`prebuilds/*/argon2.*.musl.node`), así que funciona en `node:24-alpine` sin
  compilar, también con `--ignore-scripts`. Su script `install` (node-gyp-build) solo compila si no
  hay binario; se aprueba en `allowBuilds` de `pnpm-workspace.yaml`.
- **Alternatives considered**: `@node-rs/argon2` (también válido; el usuario eligió `argon2`);
  bcrypt (la constitución exige argon2).

## R2. Access token (JWT)

- **Decision**: `@nestjs/jwt`, HS256 con `JWT_SECRET`, expiración 15 min. Claims: `sub` (id del
  usuario) y `sid` (id de la familia de refresh tokens = sesión). Guard global `JwtAuthGuard`
  registrado con `APP_GUARD`; las rutas públicas se marcan con `@Public()` (health, register,
  login, refresh, docs).
- **Revocación inmediata**: un JWT sin estado seguiría siendo válido hasta 15 min después de
  cerrar sesión, eliminar la cuenta o restablecer la contraseña, lo que incumple FR-017, FR-021,
  FR-025 y SC-003. Por eso el guard, además de verificar la firma, hace **una consulta indexada**:
  que exista un refresh token activo de la familia `sid` para el usuario `sub`, y trae
  `must_change_password`. Si no hay sesión activa → 401 `SESSION_REVOKED`.
- **Contraseña pendiente de cambio (FR-026)**: si `must_change_password` es verdadero, el guard
  solo deja pasar rutas marcadas con `@AllowPendingPasswordChange()`: `GET /me`,
  `POST /auth/change-password` y `POST /auth/logout`. El resto → 403 `PASSWORD_CHANGE_REQUIRED`.
- **Alternatives considered**: JWT puro sin consulta (no cumple la revocación inmediata); lista
  negra de JTIs (más estado que la propia tabla de refresh tokens).

## R3. Refresh token (opaco, rotado, por familias)

- **Decision**: 32 bytes aleatorios (`crypto.randomBytes`) en base64url; en la base se guarda solo
  su hash SHA-256 (hex). Cada inicio de sesión o registro crea una **familia** (`family_id`, UUID)
  con su primer token. En `POST /auth/refresh`, dentro de una transacción:
  1. Buscar por hash. No existe → 401 `SESSION_EXPIRED`.
  2. Ya rotado o revocado → **reutilización**: revocar toda la familia → 401 `SESSION_REVOKED`
     (FR-010).
  3. Expirado → 401 `SESSION_EXPIRED`.
  4. Válido → marcar `rotated_at`, crear el siguiente token de la misma familia con
     `expires_at = ahora + 30 días` y devolver un nuevo par.
- **Inactividad de 30 días (FR-009)**: como cada rotación extiende `expires_at`, la sesión expira
  solo si pasan 30 días sin renovarla (ventana deslizante).
- **Revocaciones**: cierre de sesión → la familia `sid`; cambio voluntario de contraseña → todas
  las familias del usuario salvo `sid`; restablecimiento → todas; eliminación → cascada.
- **Alternatives considered**: refresh JWT (no revocable sin estado); tabla `sessions` aparte (el
  usuario fijó `refresh_tokens` con `family_id`, que cumple la misma función).

## R4. Límites de intentos

- **Decision**:
  - **Por origen (IP)**: `@nestjs/throttler` 6.8 (compatible con Nest 12). `ThrottlerGuard` se
    aplica **solo** a `POST /auth/login` y `POST /auth/register` con `@UseGuards(ThrottlerGuard)`
    (no es un guard global), con `@Throttle`: login 20 solicitudes por 15 min y registro 5 por
    hora, ambos con `blockDuration` de 15 min (al superar el límite, el origen queda bloqueado 15
    min desde ese momento). Cuenta todas las solicitudes, no solo las fallidas (FR-013). Al
    superarlo → 429 `RATE_LIMITED`.
  - **Por email**: `LoginAttemptsService` en memoria (`Map` por email normalizado): 5 fallos en una
    ventana de 15 min bloquean ese email 15 min, incluso con la contraseña correcta (FR-013). Un
    inicio de sesión correcto reinicia el contador. Las confirmaciones con contraseña (eliminar
    cuenta, cambio de contraseña) suman fallos al email del usuario (FR-015) y **comprueban el
    bloqueo antes de verificar la contraseña**: si el email está bloqueado responden 429 sin
    verificar nada. Bloqueado → 429 `RATE_LIMITED`, con el mismo mensaje exista o no el email
    (FR-016).
- **Limitación documentada**: ambos contadores viven en memoria de **una sola instancia** del API.
  Se reinician al reiniciar el proceso y no se comparten si algún día hay varias réplicas; en ese
  caso habría que moverlos a un almacén compartido (Redis o PostgreSQL). Queda en la lista de v2.
- **Proxy**: detrás de un túnel o proxy inverso, la IP de origen llega en `X-Forwarded-For`. La
  variable `TRUST_PROXY` (número de saltos, por defecto 0) configura `trust proxy` de Express;
  sin ella todos los clientes compartirían el límite de la IP del proxy.
- **Pruebas**: cada e2e crea su propia app, así que el almacenamiento en memoria empieza vacío.

## R5. Modelo y migraciones

- **Decision**: `User` y `RefreshToken` en Prisma ([data-model.md](./data-model.md)), con
  `onDelete: Cascade` desde `RefreshToken.userId`. Primera migración con `prisma migrate dev`.
- **Aplicar migraciones**: el CLI de Prisma no está en la imagen de producción (spec 000). Se
  agrega un target `migrate` al Dockerfile (desde la etapa de build, con dependencias de
  desarrollo) cuyo comando es `prisma migrate deploy`; el target por defecto sigue siendo la imagen
  del API. Cómo y cuándo se ejecuta en el servidor es infraestructura (fuera de alcance).
- **Local y CI**: `pnpm --filter api db:migrate` (migrate dev) para desarrollo; `pretest:e2e`
  ejecuta `prisma migrate deploy` contra `corte_test`, también en el job `api-e2e`.

## R6. Zona horaria

- **API**: valida contra `Intl.supportedValuesOf('timeZone')` de Node 24 (ICU completo), más
  `UTC`. Cualquier otro valor → 400 `VALIDATION_ERROR` (FR-019).
- **App (Hermes)**: la documentación de Intl de Hermes no menciona `Intl.supportedValuesOf` (su
  base es ECMA-402 de 2020), así que **no se usa** en la app. El selector muestra una lista curada
  en `src/features/timezones.ts`: zonas de América (una por país o región habitual) y de España
  (`Europe/Madrid`, `Atlantic/Canary`). Si la zona guardada del usuario no está en la lista, se
  muestra igualmente como seleccionada.
- **Alternatives considered**: lista completa IANA embebida en la app (~600 zonas, poco usable
  para uso familiar).

## R7. Comando de administrador

- **Decision**: `apps/api/src/cli/reset-password.ts`, compilado a `dist/cli/reset-password.js`.
  Arranca un contexto de Nest sin HTTP (`NestFactory.createApplicationContext`) para reutilizar
  la configuración validada y `UsersService.resetPassword(email)`: genera una contraseña temporal
  de 16 caracteres alfanuméricos con `crypto.randomInt`, guarda su hash, marca
  `must_change_password` y revoca todas las sesiones. Imprime la contraseña una sola vez en
  stdout; no la registra en logs.
- **Ejecución**:
  - Local: `pnpm --filter api admin:reset-password <email>`. Usa el `dist` existente (de `dev` o
    `build`) y no compila: `nest build` vacía `dist` y tumbaría un `nest start --watch`.
  - Servidor: `docker exec <contenedor-api> node dist/cli/reset-password.js <email>`. Dentro de la
    imagen no hay pnpm ni workspace, por eso no se puede usar `pnpm --filter` en el contenedor.
- **Salidas**: código 0 si restableció; 1 si el email no existe (mensaje claro) o hubo error.

## R8. Errores del API

- **Decision**: cuerpo uniforme `{ statusCode, code, message }` (y `errors` por campo en 400),
  producido por un filtro global. `code` es estable y en inglés; la app traduce cada código a un
  texto en español ([contracts/errors.md](./contracts/errors.md)). Los cuerpos se validan con zod
  mediante un pipe.

## R9. Reglas de cuenta compartidas

- **Decision**: `packages/domain/src/account-rules.ts` con `NAME_MAX_LENGTH = 80`,
  `PASSWORD_MIN_LENGTH = 8`, `PASSWORD_MAX_LENGTH = 128`, `normalizeEmail` (trim + minúsculas),
  `normalizeName` (trim) y validadores puros, con pruebas Vitest. API y app los importan; así los
  límites no se duplican. El validador de email también limita la longitud a 254 caracteres
  (data-model.md `User.email`). La app pasa a depender de `@corte/domain` (consume su `dist`; el
  script `prestart` de la app compila el dominio).
- **Compilar el dominio antes del API**: `dist` está en `.gitignore`, así que en un clon limpio o en
  la CI no existe. El API tiene un script `domain:build` (`pnpm --filter @corte/domain build`)
  encadenado en sus hooks `predev`, `prebuild`, `pretypecheck`, `pretest` y `pretest:e2e`, junto a
  `prisma:generate`. En la CI, el job `api-e2e` compila el dominio antes de los pasos del API.

## R10. Sesión en la app

- **Decision**:
  - `session-store.ts` (Zustand): `status` (`restoring` | `signedOut` | `signedIn` | `offline`),
    `accessToken` (solo en memoria), `user`, `lastEmail`.
  - `secure-storage.ts` (`expo-secure-store`, incluido en Expo Go): claves `corte.refreshToken` y
    `corte.lastEmail`, con `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` en iOS. El último
    email se persiste para cumplir FR-011 aunque la app se haya cerrado.
  - `bootstrap.ts`: al abrir, si hay refresh token → `POST /auth/refresh` → `GET /me`. Error de red
    → estado `offline` (no se borra la sesión; pantalla con "Reintentar"). 401 → borrar el refresh
    token y pasar a `signedOut` con el email prellenado.
  - `client.ts`: `fetch` con `Authorization: Bearer`; ante 401 `TOKEN_EXPIRED` renueva **una sola
    vez a la vez** (promesa compartida) y reintenta la solicitud original; si la renovación falla,
    cierra la sesión local y vuelve al inicio de sesión con el email.
- **Navegación**: `Stack.Protected` de expo-router (SDK 58) en el layout raíz: el grupo `(auth)`
  con `guard={status === 'signedOut'}` y el grupo `(app)` con `guard={status === 'signedIn'}`.
  Cuando el estado cambia, expo-router redirige solo. Dentro de `(app)`, otro `Stack.Protected`
  con `guard={!user.mustChangePassword}` deja accesible únicamente `change-password` mientras el
  cambio sea obligatorio.
- **Formularios**: `react-hook-form` + `zod` (`@hookform/resolvers`), con los límites de
  `@corte/domain`.

## R11. Pantallas

- **Decision**: siete pantallas ([contracts/screens.md](./contracts/screens.md)) con los tokens de
  `docs/design-system.md`. Componente nuevo `TextField` (etiqueta, campo de radio 12 y alto ≥ 44,
  borde `border`, mensaje de error en `danger` con texto). La pantalla de conexión de la spec 000 y
  `api/health.ts` se eliminan (FR-035); el endpoint de salud del API se mantiene.
