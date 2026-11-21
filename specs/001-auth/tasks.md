---

description: "Task list for spec 001 — Autenticación de Corte"
---

# Tasks: Autenticación de Corte

**Input**: Design documents from `/specs/001-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. La constitución exige pruebas primero en dominio y API (principio II), e2e de cada
endpoint y pruebas de aislamiento entre usuarios (principio III). En cada fase las pruebas se
escriben antes de implementar y deben fallar primero. La app se valida a mano (quickstart.md A9).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo (plan.md → Project Structure): `apps/api/`, `apps/mobile/`, `packages/domain/`. Las e2e
se reparten en un archivo por historia (ver plan.md) para poder trabajar las historias en paralelo.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencias, variables y scripts nuevos.

- [X] T001 Add `argon2`, `@nestjs/jwt` and `@nestjs/throttler` to `apps/api/package.json` and approve `argon2` in `allowBuilds` of `pnpm-workspace.yaml` (research.md R1); run `pnpm install`
- [ ] T002 [P] Add to `apps/mobile` with `pnpm exec expo install`: `zustand`, `expo-secure-store`, `react-hook-form`, `@hookform/resolvers`, `zod`; add `"@corte/domain": "workspace:*"` and a `prestart` script that runs `pnpm --filter @corte/domain build` in `apps/mobile/package.json` (research.md R9, R10)
- [X] T003 [P] Add `JWT_SECRET` (dev-only value of ≥ 32 characters) and `TRUST_PROXY=0` to `apps/api/.env.example` per `contracts/environment.md`
- [X] T004 Add API scripts in `apps/api/package.json`: `domain:build` (`pnpm --filter @corte/domain build`) chained before `prisma:generate` in the `predev`, `prebuild`, `pretypecheck`, `pretest` and `pretest:e2e` hooks; `db:migrate` (`prisma migrate dev`), `db:migrate:deploy` (`prisma migrate deploy`), `admin:reset-password` (`node dist/cli/reset-password.js`) with `preadmin:reset-password` running the build; `pretest:e2e` also runs `prisma migrate deploy` against the test database. In `.github/workflows/ci.yml`, job `api-e2e`, add `pnpm --filter @corte/domain build` before the API steps (research.md R5, R7, R9)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Reglas de cuenta, configuración, modelo, errores, tokens, guard global y la base de
navegación de la app. Todas las historias dependen de esta fase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational (write first, must FAIL) ⚠️

- [X] T005 [P] Write Vitest tests in `packages/domain/src/account-rules.test.ts`: `normalizeEmail` (trim + lowercase), email format validation and maximum length of 254 characters, `normalizeName` (trim) and name length 1–80, password length 8–128 (no trimming), exported constants (data-model.md `User.name`, `User.email`, `User.password_hash` for the original-password length)
- [X] T006 [P] Extend `apps/api/src/config/env.schema.spec.ts`: `JWT_SECRET` required and ≥ 32 characters; the `.env.example` value rejected when `APP_ENV=production`; `TRUST_PROXY` defaults to 0 and accepts integers ≥ 0 only (`contracts/environment.md`)
- [X] T007 [P] Write unit tests in `apps/api/src/auth/password.service.spec.ts`: hash uses argon2id (PHC string starts with `$argon2id$`), verify true/false, `verifyAgainstDummy` always returns false (research.md R1)
- [X] T008 [P] Write unit tests in `apps/api/src/auth/tokens.service.spec.ts` for the pure parts: access token carries `sub` and `sid` and expires in 15 min; refresh token is 32 random bytes in base64url; its stored hash is the SHA-256 hex of the token (data-model.md `RefreshToken.token_hash`)
- [X] T009 [P] Write unit tests in `apps/api/src/auth/jwt-auth.guard.spec.ts` with mocked dependencies: `@Public()` routes pass; missing/invalid/expired JWT → 401 `TOKEN_EXPIRED`; valid JWT without an active session → 401 `SESSION_REVOKED`; `must_change_password` → 403 `PASSWORD_CHANGE_REQUIRED` unless the route has `@AllowPendingPasswordChange()`; the resolved user is attached to the request (research.md R2)

### Implementation for Foundational

- [X] T010 [P] Implement `packages/domain/src/account-rules.ts` (including the 254-character email limit) and export it from `packages/domain/src/index.ts` per data-model.md `User.name`, `User.email` and the 8–128 rule of `User.password_hash` (makes T005 pass)
- [X] T011 [P] Add `JWT_SECRET` and `TRUST_PROXY` to `apps/api/src/config/env.schema.ts` (makes T006 pass)
- [X] T012 Define `User` and `RefreshToken` in `apps/api/prisma/schema.prisma` per data-model.md (`User.id`, `User.name`, `User.email`, `User.password_hash`, `User.timezone`, `User.must_change_password`, `User.created_at`, `User.updated_at`, `RefreshToken.id`, `RefreshToken.user_id` with `onDelete: Cascade`, `RefreshToken.family_id`, `RefreshToken.token_hash`, `RefreshToken.expires_at`, `RefreshToken.rotated_at`, `RefreshToken.revoked_at`, `RefreshToken.created_at`, with the unique constraints and indexes listed there; snake_case table/column names via `@@map`/`@map`) and create the first migration in `apps/api/prisma/migrations/` with `prisma migrate dev --create-only`, adding by hand to its SQL the constraint `CHECK (email = lower(email))` on `users` (data-model.md `User.email`; Prisma schema cannot express CHECK constraints), then apply it with `pnpm --filter api db:migrate`
- [X] T013 [P] Implement `apps/api/src/common/errors.ts` (`ErrorCode` union and `AppException`), `apps/api/src/common/http-exception.filter.ts` (uniform `{ statusCode, code, message, errors? }`, mapping the throttler exception to 429 `RATE_LIMITED`) and `apps/api/src/common/zod-validation.pipe.ts` (400 `VALIDATION_ERROR` with `errors[{ field, code }]`) per `contracts/errors.md`; register the filter in `apps/api/src/app.setup.ts`
- [X] T014 [P] Implement `apps/api/src/auth/password.service.ts` (argon2id hash/verify and a dummy hash computed at startup) (makes T007 pass)
- [X] T015 Implement `apps/api/src/auth/tokens.service.ts` per research.md R3: `signAccessToken(sub, sid)`, `createSession(userId)` (new family + first token), `rotate(refreshToken)` (transaction: not found → `SESSION_EXPIRED`; rotated/revoked → revoke family + `SESSION_REVOKED`; expired → `SESSION_EXPIRED`; else mark `rotated_at` and issue the next token), `revokeFamily(sid)`, `revokeAllForUser(userId, exceptSid?)` and `isSessionActive(sub, sid)` returning the user's `must_change_password` (data-model.md `RefreshToken.family_id`, `RefreshToken.token_hash`, `RefreshToken.expires_at` sliding 30 days, `RefreshToken.rotated_at`, `RefreshToken.revoked_at`, `User.must_change_password`) (makes T008 pass)
- [X] T016 Implement `apps/api/src/auth/decorators.ts` (`@Public()`, `@AllowPendingPasswordChange()`, `@CurrentUser()`) and `apps/api/src/auth/jwt-auth.guard.ts`; register it as `APP_GUARD`; mark `HealthController` as `@Public()`; add bearer auth to the Swagger document and `app.set('trust proxy', TRUST_PROXY)` in `apps/api/src/app.setup.ts` (makes T009 pass)
- [X] T017 Create `apps/api/src/auth/auth.module.ts` (with `JwtModule` using `JWT_SECRET`) and `apps/api/src/users/users.module.ts`, and import them plus `ThrottlerModule.forRoot` (in-memory storage) in `apps/api/src/app.module.ts`. Do NOT register `ThrottlerGuard` globally: it is applied only to login and register (T028, T037)
- [X] T018 Create `apps/api/test/helpers.ts`: `createTestApp(env)` (sets test `JWT_SECRET`, boots `AppModule.register()` with `configureApp`), `resetDatabase()` (truncate `users` cascade), `createUser({ name, email, password, mustChangePassword? })` writing directly with Prisma and argon2, and `login(app, email, password)`; update `apps/api/test/health.e2e-spec.ts` to use it and confirm `/api/v1/health` stays public
- [ ] T019 [P] Implement `apps/mobile/src/session/secure-storage.ts`: get/set/delete of `corte.refreshToken` and `corte.lastEmail` with `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` (research.md R10)
- [ ] T020 Implement `apps/mobile/src/session/session-store.ts` (Zustand): `status` (`restoring` | `signedOut` | `signedIn` | `offline`), in-memory `accessToken`, `user`, `lastEmail`, `notice` (expired/revoked) and actions `signIn(result)`, `signOut(notice?)`, `setUser(user)` that keep secure storage in sync
- [ ] T021 [P] Implement `apps/mobile/src/api/errors.ts`: `ApiError` (status, code, field errors), network error type, and Spanish texts per `contracts/errors.md`
- [ ] T022 Implement `apps/mobile/src/api/client.ts`: `apiFetch` adding `Authorization: Bearer`, parsing errors into `ApiError`; on 401 `TOKEN_EXPIRED` it refreshes once with a shared in-flight promise (`POST /auth/refresh` with the stored refresh token), stores the new pair and retries; if refreshing fails it calls `signOut` with the matching notice (research.md R10)
- [ ] T023 [P] Implement `apps/mobile/src/components/TextField.tsx` (label, input with min height 44, radius `control`, `border` color, error text in `danger`, secure and email variants) and add a `danger` variant to `apps/mobile/src/components/Button.tsx`, theme tokens only (`contracts/screens.md`)
- [ ] T024 Replace the spec 000 connection screen: delete `apps/mobile/src/app/index.tsx` and `apps/mobile/src/api/health.ts`; in `apps/mobile/src/app/_layout.tsx` keep fonts + `QueryClientProvider`, keep the splash while `status === 'restoring'`, and declare `Stack.Protected guard={status === 'signedOut'}` for `(auth)` and `Stack.Protected guard={status === 'signedIn'}` for `(app)`; create `apps/mobile/src/app/(auth)/_layout.tsx` and `apps/mobile/src/app/(app)/_layout.tsx` (plain stacks) and a temporary bootstrap that sets `signedOut` (research.md R10)
- [X] T025 Verify the foundation: `pnpm lint`, `pnpm typecheck`, domain tests, API unit tests and `pnpm --filter api test:e2e` (health) all pass

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Registrarse y quedar dentro de la app (Priority: P1) 🎯 MVP

**Goal**: crear una cuenta y entrar a la pantalla de inicio.

**Independent Test**: quickstart.md A1 y A9 paso 1.

### Tests for User Story 1 (write first, must FAIL) ⚠️

- [X] T026 [P] [US1] Write `apps/api/test/register.e2e-spec.ts`: 201 with `AuthResult` matching `contracts/auth.openapi.yaml`; email stored trimmed and lowercased and timezone `America/Bogota`; password stored as an argon2id hash; one refresh token row created; `EMAIL_TAKEN` for the same email with different casing; `VALIDATION_ERROR` per field for empty name, name > 80, invalid email, email longer than 254 characters, password < 8 and > 128; 6th registration from the same IP within an hour → 429 `RATE_LIMITED`

### Implementation for User Story 1

- [X] T027 [US1] Implement `AuthService.register` in `apps/api/src/auth/auth.service.ts` (normalize with `@corte/domain`, hash, create the user with data-model.md `User.email` uniqueness mapped to `EMAIL_TAKEN`, `User.timezone` default and `User.must_change_password` false, then `createSession`) and its zod schema in `apps/api/src/auth/auth.schemas.ts` using the `@corte/domain` validators (email ≤ 254)
- [X] T028 [US1] Add `POST /auth/register` (`@Public()`, `@UseGuards(ThrottlerGuard)`, `@Throttle` 5 per hour with `blockDuration` 15 min, 201) in `apps/api/src/auth/auth.controller.ts`; make T026 pass
- [ ] T029 [P] [US1] Implement `register()` in `apps/mobile/src/api/auth.ts`
- [ ] T030 [US1] Implement `apps/mobile/src/app/(auth)/register.tsx` per `contracts/screens.md` with react-hook-form + zod using `@corte/domain` limits; on success `signIn(result)`; API field errors mapped to fields; passwords cleared on error
- [ ] T031 [US1] Implement `apps/mobile/src/app/(app)/index.tsx`: greeting "Hola, {nombre}" and a note that the full home arrives later (`contracts/screens.md`)

**Checkpoint**: registration works end to end

---

## Phase 4: User Story 2 - Iniciar sesión y mantenerla (Priority: P1)

**Goal**: login, sesión persistente con renovación, mensajes genéricos y límites de intentos.

**Independent Test**: quickstart.md A2, A3 (pasos 1–2) y A9 pasos 1–2 y 8.

### Tests for User Story 2 (write first, must FAIL) ⚠️

- [X] T032 [P] [US2] Write `apps/api/test/login-session.e2e-spec.ts`: login with any email casing → 200; unknown email and wrong password → identical 401 `INVALID_CREDENTIALS` bodies; `POST /auth/refresh` rotates (new pair, old one rotated); reusing a rotated token → 401 `SESSION_REVOKED` and the newest token of that family also fails; each rotation sets the new token's `expires_at` about 30 days ahead (sliding window, FR-009); refresh token with `expires_at` in the past → 401 `SESSION_EXPIRED`; access token of a revoked family on `GET /me` → 401 `SESSION_REVOKED`; `GET /me` returns the `User` schema
- [X] T033 [P] [US2] Write `apps/api/test/rate-limit.e2e-spec.ts`: 5 failed logins for one email → 6th attempt with the correct password → 429 `RATE_LIMITED`; the 429 body is the same for an unknown email; 21st login request from the same IP within 15 min → 429; with `TRUST_PROXY=1`, requests with different `X-Forwarded-For` values are counted separately
- [X] T034 [P] [US2] Write unit tests in `apps/api/src/auth/login-attempts.service.spec.ts` with an injected clock: lock after 5 failures within 15 min, unlock after 15 min, failures older than the window ignored, success resets the counter (research.md R4); and in `apps/api/src/auth/auth.service.spec.ts`: login with an unknown email calls `PasswordService.verifyAgainstDummy` and returns `INVALID_CREDENTIALS` (FR-007)

### Implementation for User Story 2

- [X] T035 [US2] Implement `apps/api/src/auth/login-attempts.service.ts` (in-memory `Map`, injectable clock) (makes T034 pass)
- [X] T036 [US2] Implement `AuthService.login` (lockout check, `verifyAgainstDummy` for unknown emails, record failure/success, `createSession`) and `AuthService.refresh` (delegates to `TokensService.rotate`, returns the user) in `apps/api/src/auth/auth.service.ts`
- [X] T037 [US2] Add `POST /auth/login` (`@Public()`, `@UseGuards(ThrottlerGuard)`, `@Throttle` 20 requests per 15 min with `blockDuration` 15 min) and `POST /auth/refresh` (`@Public()`) in `apps/api/src/auth/auth.controller.ts`
- [X] T038 [US2] Implement `UsersService.getProfile` in `apps/api/src/users/users.service.ts` and `GET /me` (`@AllowPendingPasswordChange()`) in `apps/api/src/users/me.controller.ts`, mapping data-model.md `User.name`, `User.email`, `User.timezone`, `User.must_change_password` to the contract `User`; make T032 and T033 pass
- [ ] T039 [P] [US2] Implement `login()` and `refresh()` in `apps/mobile/src/api/auth.ts` and `getMe()` in `apps/mobile/src/api/me.ts`
- [ ] T040 [US2] Implement `apps/mobile/src/session/bootstrap.ts`: with a stored refresh token → refresh → `getMe` → `signedIn`; network error → `offline` (keep the token); 401 → delete the token and `signOut` with notice; no token → `signedOut`; wire it in `apps/mobile/src/app/_layout.tsx` replacing the temporary bootstrap
- [ ] T041 [US2] Implement `apps/mobile/src/app/(auth)/login.tsx` per `contracts/screens.md`: email prefilled from `lastEmail`, expired/revoked notice, generic error, rate-limit message, "Crear cuenta" link
- [ ] T042 [US2] Add the offline state screen ("No hay conexión con el servidor" + "Reintentar" that reruns bootstrap) in `apps/mobile/src/app/_layout.tsx`

**Checkpoint**: users stay signed in across restarts; brute force is limited

---

## Phase 5: User Story 3 - Cerrar sesión en este dispositivo (Priority: P2)

**Goal**: cerrar la sesión actual sin afectar otros dispositivos.

**Independent Test**: quickstart.md A3 paso 3 y A9 paso 5.

- [X] T043 [P] [US3] Write `apps/api/test/logout.e2e-spec.ts`: `POST /auth/logout` → 204; the same access token → 401 `SESSION_REVOKED`; its refresh token → 401; a second session of the same user keeps working
- [X] T044 [US3] Implement `AuthService.logout` (`revokeFamily(sid)`) and `POST /auth/logout` (`@AllowPendingPasswordChange()`, 204) in `apps/api/src/auth/auth.service.ts` and `apps/api/src/auth/auth.controller.ts`; make T043 pass
- [ ] T045 [US3] Implement `logout()` in `apps/mobile/src/api/auth.ts` (always clears local session, even if the request fails) and `apps/mobile/src/app/(app)/profile.tsx` with name, email, timezone and "Cerrar sesión"; add the "Perfil" button to `apps/mobile/src/app/(app)/index.tsx`

**Checkpoint**: logout works; profile screen exists

---

## Phase 6: User Story 4 - Ver y cambiar la zona horaria (Priority: P2)

**Goal**: ver y cambiar la zona horaria del usuario.

**Independent Test**: quickstart.md A4 y A9 paso 3.

- [X] T046 [P] [US4] Write unit tests in `apps/api/src/users/timezone.spec.ts`: valid IANA zones and `UTC` accepted; unknown or malformed values rejected
- [X] T047 [P] [US4] Write `apps/api/test/me-timezone.e2e-spec.ts`: `GET /me` shows `America/Bogota`; `PATCH /me` with a valid zone → 200 and persisted; invalid zone → 400 `VALIDATION_ERROR` (`timezone` / `INVALID_TIMEZONE`) and value unchanged; extra properties rejected
- [X] T048 [US4] Implement `apps/api/src/users/timezone.ts` (Node `Intl.supportedValuesOf('timeZone')` plus `UTC`) per data-model.md `User.timezone` (makes T046 pass)
- [X] T049 [US4] Implement `UsersService.updateTimezone` and `PATCH /me` in `apps/api/src/users/users.service.ts` and `apps/api/src/users/me.controller.ts`; make T047 pass
- [ ] T050 [P] [US4] Create the curated list in `apps/mobile/src/features/timezones.ts` (America zones plus `Europe/Madrid` and `Atlantic/Canary`, with Spanish labels; research.md R6)
- [ ] T051 [US4] Implement `updateTimezone()` in `apps/mobile/src/api/me.ts` and `apps/mobile/src/app/(app)/timezone.tsx` (search, current zone marked "Actual" even if not in the list, tap saves and returns); add the "Zona horaria" row to `apps/mobile/src/app/(app)/profile.tsx`

**Checkpoint**: timezone viewable and editable

---

## Phase 7: User Story 5 - Eliminar mi cuenta (Priority: P2)

**Goal**: borrado permanente de la cuenta confirmado con la contraseña.

**Independent Test**: quickstart.md A7 y A9 paso 7.

- [X] T052 [P] [US5] Write `apps/api/test/delete-account.e2e-spec.ts`: wrong password → 401 `INVALID_PASSWORD` and nothing deleted (and it counts toward the email lockout); with the email locked, even the correct password → 429 `RATE_LIMITED` and nothing deleted; correct password → 204, the user row and all its refresh tokens are gone (cascade), another session's access token → 401; login afterwards → 401 `INVALID_CREDENTIALS`; registering the same email again → 201
- [X] T053 [US5] Implement `UsersService.deleteAccount` (check the email lockout first → 429 `RATE_LIMITED`, then verify password, record failures in `LoginAttemptsService`, delete the user relying on data-model.md `RefreshToken.user_id` cascade) and `DELETE /me` (204) in `apps/api/src/users/users.service.ts` and `apps/api/src/users/me.controller.ts`; make T052 pass
- [ ] T054 [US5] Implement `deleteAccount()` in `apps/mobile/src/api/me.ts` and `apps/mobile/src/app/(app)/delete-account.tsx` per `contracts/screens.md` (warning, password field, `danger` button, cancel); on success `signOut()`; add the "Eliminar cuenta" entry to `apps/mobile/src/app/(app)/profile.tsx`

**Checkpoint**: account deletion works

---

## Phase 8: User Story 6 - Cambiar mi contraseña desde el perfil (Priority: P2)

**Goal**: cambio voluntario que conserva la sesión actual y revoca las demás.

**Independent Test**: quickstart.md A5 y A9 paso 4.

- [X] T055 [P] [US6] Write `apps/api/test/change-password.e2e-spec.ts` (voluntary mode): missing `currentPassword` → 400; wrong `currentPassword` → 401 `INVALID_PASSWORD` (counts toward the lockout); with the email locked, even the correct `currentPassword` → 429 `RATE_LIMITED` and nothing changes; new password equal to the current → 409 `SAME_PASSWORD`; new password < 8 → 400; success → 200, the current session keeps working, another session → 401 `SESSION_REVOKED`, login with the old password → 401 and with the new one → 200
- [X] T056 [US6] Implement `AuthService.changePassword` (voluntary path: check the email lockout first → 429 `RATE_LIMITED`, verify current, reject equal password, hash new, `revokeAllForUser(userId, exceptSid)`) and `POST /auth/change-password` (`@AllowPendingPasswordChange()`) with its zod schema in `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.controller.ts` and `apps/api/src/auth/auth.schemas.ts`; make T055 pass
- [ ] T057 [US6] Implement `changePassword()` in `apps/mobile/src/api/auth.ts` and `apps/mobile/src/app/(app)/change-password.tsx` in voluntary mode (current, new, confirmation; validation with `@corte/domain`); add "Cambiar contraseña" to `apps/mobile/src/app/(app)/profile.tsx`

**Checkpoint**: voluntary password change works

---

## Phase 9: User Story 7 - Restablecer una contraseña desde el servidor (Priority: P3)

**Goal**: comando de administrador y cambio obligatorio en el siguiente inicio de sesión.

**Independent Test**: quickstart.md A6 y A9 paso 6.

- [X] T058 [P] [US7] Write `apps/api/test/admin-reset.e2e-spec.ts`: `UsersService.resetPassword` (via the app context) returns a 16-character temporary password from the alphabet in `contracts/admin-cli.md`, sets `must_change_password`, revokes all sessions; login with it → 200 with `mustChangePassword: true`; `PATCH /me` and `DELETE /me` → 403 `PASSWORD_CHANGE_REQUIRED`; `GET /me` and `POST /auth/logout` allowed; `POST /auth/change-password` with only `newPassword` → 200 and the flag cleared; a new password equal to the temporary one → 409 `SAME_PASSWORD`; unknown email → not found error; the CLI `run(argv, io)` prints the password once and returns 0, prints usage without argument and returns 1 for an unknown email
- [X] T059 [US7] Implement `UsersService.resetPassword(email)` with a temporary-password generator (`crypto.randomInt`, alphabet from `contracts/admin-cli.md`) in `apps/api/src/users/users.service.ts`, setting data-model.md `User.password_hash` and `User.must_change_password` and calling `revokeAllForUser`
- [X] T060 [US7] Implement `apps/api/src/cli/reset-password.ts`: exported `run(argv, io)` that boots `NestFactory.createApplicationContext(AppModule.register())`, calls `resetPassword` and writes the output of `contracts/admin-cli.md`; a `main` that calls it with `process.argv`/stdout/stderr and sets the exit code; ensure it compiles to `dist/cli/reset-password.js`
- [X] T061 [US7] Complete the forced path of `AuthService.changePassword` (no `currentPassword` when `must_change_password` is true, reject equal to the temporary password, clear the flag) in `apps/api/src/auth/auth.service.ts`; make T058 pass
- [ ] T062 [US7] In `apps/mobile/src/app/(app)/_layout.tsx` add `Stack.Protected guard={!user.mustChangePassword}` around every screen except `change-password`; add the forced mode to `apps/mobile/src/app/(app)/change-password.tsx` (notice "Debes cambiar tu contraseña temporal", no current-password field, "Cerrar sesión" button); after saving, `setUser` with the returned user

**Checkpoint**: all user stories functional

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T063 Write `apps/api/test/isolation.e2e-spec.ts` (principle III, SC-004): with users A and B, A's token reads only A's profile; A's `PATCH /me` and `DELETE /me` never affect B; A's logout and password change do not revoke B's sessions; B's refresh token cannot be rotated into A's session; a JWT signed with the right secret but with `sub` changed to B and A's `sid` → 401; a token signed with another secret → 401
- [X] T064 Add a `migrate` target to `apps/api/Dockerfile` (from the build stage, `CMD ["pnpm","--filter","api","db:migrate:deploy"]`) keeping the API image as the default (last) stage; build both, check the API image is still < 300 MB and that `argon2` loads in Alpine by running the migrate container and then the API container with `APP_ENV`, `JWT_SECRET` and `DATABASE_URL`, and registering a user (quickstart.md A10)
- [X] T065 [P] Update `README.md`: the API compiles `@corte/domain` automatically before `dev`/`build`/`typecheck`/`test` (`domain:build`), migrations (`db:migrate`), new variables `JWT_SECRET` and `TRUST_PROXY`, the admin command (local and `docker exec`), the `migrate` image target, and the single-instance limitation of the rate limits (research.md R4)
- [X] T066 Security pass: confirm no password, temporary password or token is logged (FR-033) by grepping the code and running the e2e suite with logs enabled; confirm `JWT_SECRET` is never committed (only the dev value in `.env.example`)
- [X] T067 Run `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, domain tests, API unit and e2e tests; all green
- [ ] T068 Validate quickstart.md A1–A8 and A10; A9 (app on iOS simulator and Android emulator) is validated manually by the user

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → historias → **Polish (Phase 10)**.
- **US1 (P1)**: depende de Foundational.
- **US2 (P1)**: depende de Foundational; en la app usa la pantalla de inicio de US1 como destino.
- **US3–US6 (P2)**: dependen de Foundational y de `GET /me` + login de US2 (pruebas y perfil);
  US4–US6 agregan filas a la pantalla de perfil creada en US3.
- **US7 (P3)**: depende de US6 (`POST /auth/change-password`) y de US2.
- **Polish**: T063 necesita todas las historias de API; T064–T068 al final.

### User Story Dependencies

```text
Foundational ─┬─ US1 ─┐
              └─ US2 ─┴─ US3 ─┬─ US4
                              ├─ US5
                              └─ US6 ── US7
                                          └─ Polish
```

### Within Each User Story

- Pruebas primero (deben fallar), luego servicio → controlador → cliente de la app → pantalla.
- Tareas que tocan `auth.service.ts`, `auth.controller.ts`, `users.service.ts`, `me.controller.ts`,
  `profile.tsx` o `change-password.tsx` son secuenciales entre sí.

### Parallel Opportunities

- Setup: T002 y T003 en paralelo con T001.
- Foundational: pruebas T005–T009 en paralelo; luego T010, T011, T013, T014 en paralelo; en la app
  T019, T021 y T023 en paralelo.
- Las e2e de cada historia (T026, T032–T034, T043, T046–T047, T052, T055, T058) pueden escribirse en
  paralelo porque son archivos distintos.
- Tras US3, US4, US5 y US6 pueden avanzar en paralelo en el API (archivos distintos salvo
  `users.service.ts` / `me.controller.ts` entre US4 y US5).

---

## Parallel Example: Foundational tests

```bash
Task: "Write Vitest tests in packages/domain/src/account-rules.test.ts"
Task: "Extend apps/api/src/config/env.schema.spec.ts"
Task: "Write unit tests in apps/api/src/auth/password.service.spec.ts"
Task: "Write unit tests in apps/api/src/auth/tokens.service.spec.ts"
Task: "Write unit tests in apps/api/src/auth/jwt-auth.guard.spec.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Write apps/api/test/login-session.e2e-spec.ts"
Task: "Write apps/api/test/rate-limit.e2e-spec.ts"
Task: "Write unit tests in apps/api/src/auth/login-attempts.service.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Setup + Foundational.
2. US1 (registro) y US2 (login y sesión persistente): con esto la app ya tiene cuentas reales.
3. **STOP and VALIDATE**: quickstart.md A1–A3 y A9 pasos 1–2, 8.

### Incremental Delivery

1. Setup + Foundational
2. US1 + US2 → MVP de cuentas
3. US3 (cerrar sesión + perfil)
4. US4 (zona horaria), US5 (eliminar cuenta), US6 (cambio voluntario)
5. US7 (restablecimiento por el administrador)
6. Polish → aislamiento, imagen con migraciones, README, seguridad

Commits sugeridos: `feat(api): add auth foundation`, `feat(api): add register and login`,
`feat(mobile): add auth screens and session`, `feat(api): add account deletion`,
`feat(api): add admin password reset`, `build(api): add migrate image target`.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Los e2e de cada historia crean su propia app (almacenamiento en memoria de los límites limpio) y
  limpian la base con `resetDatabase()`
- Verify tests fail before implementing
- Stop at any checkpoint to validate story independently
