---

description: "Task list for spec 000 — Esqueleto del proyecto Corte"
---

# Tasks: Esqueleto del proyecto Corte

**Input**: Design documents from `/specs/000-project-skeleton/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ se incluyen. La constitución (principio II) exige pruebas primero en dominio y API, y
la spec las pide explícitamente (FR-004, FR-011). Las pruebas de cada historia se escriben antes de
la implementación y deben fallar primero. La app móvil se valida a mano (plan.md → Testing).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo pnpm (ver plan.md → Project Structure): `apps/api/`, `apps/mobile/`, `packages/domain/`,
y archivos compartidos en la raíz. Código y nombres en inglés; README y textos de UI en español.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializar el workspace y las herramientas raíz.

- [X] T001 Create root `package.json` (name `corte`, `private: true`, `packageManager` pnpm 12.x (≥ 12.2), `engines.node` `>=24`, `engines.pnpm` `>=12.2.0`) with devDependencies `typescript`, `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`, and scripts `build` (`pnpm -r build`), `lint` (`eslint .`, the only lint script in the repo), `typecheck` (`pnpm -r typecheck`), `format`, `format:check`, `db:up` (`docker compose up -d --wait`), `db:down` (`docker compose down`) per research.md R1/R7
- [X] T002 Create `pnpm-workspace.yaml` with packages `apps/*` and `packages/*`; do NOT enable `inject-workspace-packages` so workspace packages stay linked in development (research.md R2/R6)
- [X] T003 [P] Create `.nvmrc` (`24`) and root `.gitignore` (node_modules, dist, coverage, `.env`, `.env.*` except `.env.example`, `apps/api/src/generated/`, `.expo/`, `apps/mobile/ios/`, `apps/mobile/android/`)
- [X] T004 [P] Create `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `forceConsistentCasingInFileNames`, `skipLibCheck` (research.md R1)
- [X] T005 [P] Create `.prettierrc` and `.prettierignore` (ignore dist, coverage, generated, pnpm-lock.yaml)
- [X] T006 Create root `eslint.config.mjs` (flat config) with typescript-eslint recommended for all packages, Prettier compatibility, ignores for dist/coverage/generated, and a `packages/domain/**` block with `no-restricted-imports` forbidding `node:*`, `fs`, `http`, `https`, `pg`, `@prisma/*`, `react*`, `expo*` (research.md R2, principio I)
- [X] T007 [P] Create `README.md` skeleton in Spanish: descripción del proyecto, sección "Prerrequisitos" (Node 24 + Corepack, Docker, Xcode/Android Studio) and empty sections for API, dominio, app móvil, imagen Docker y CI
- [X] T008 Run `corepack enable && pnpm install` at the root and commit the generated `pnpm-lock.yaml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Paquete de dominio compilable, del que dependen API y app como workspace.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T009 Create `packages/domain/package.json` (name `@corte/domain`, `main`/`types`/`exports` → `dist/index.js` and `dist/index.d.ts`, no runtime dependencies, scripts `build` (`tsc -p tsconfig.json`), `dev` (`tsc -w`), `typecheck`; no `lint` script, linting is done from the root) and `packages/domain/tsconfig.json` extending `../../tsconfig.base.json` with `module: commonjs`, `declaration: true`, `outDir: dist`, `rootDir: src`, excluding `**/*.test.ts` (research.md R2)
- [X] T010 Create `packages/domain/src/index.ts` exporting a single placeholder constant `DOMAIN_PACKAGE_NAME = '@corte/domain'` (no business rules in this spec)
- [X] T011 Verify from the root that `pnpm install && pnpm build && pnpm lint && pnpm typecheck` succeed

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Levantar el API local y consultar su salud (Priority: P1) 🎯 MVP

**Goal**: API NestJS que arranca en local con una base PostgreSQL levantada con un solo comando y
expone `GET /api/v1/health` con el contrato de `contracts/health.openapi.yaml`.

**Independent Test**: quickstart.md V1–V4: con la base arriba → 200 `ok`/`up`; con la base caída →
503 `degraded`/`down` en ≤ 3 s; sin `DATABASE_URL` → el proceso no arranca.

### Infraestructura local para User Story 1

- [X] T012 [P] [US1] Create `docker-compose.yml` with a single `postgres:17-alpine` service on `5434:5432`, user/password `corte`/`corte`, database `corte_dev`, named volume, `pg_isready` healthcheck, and `./docker/postgres/init.sql` mounted in `/docker-entrypoint-initdb.d/` (research.md R7)
- [X] T013 [P] [US1] Create `docker/postgres/init.sql` that creates database `corte_test` owned by `corte`
- [X] T014 [US1] Scaffold `apps/api` manually (no interactive `nest new`): `package.json` (name `api`, dependencies `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/terminus`, `@nestjs/swagger`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `zod`, `reflect-metadata`, `rxjs`, `@corte/domain: workspace:*`; devDependencies `@nestjs/cli`, `@nestjs/testing`, `prisma`, `dotenv`, `jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`, `@types/pg`, `@types/node`; scripts `prisma:generate` (`prisma generate`), `dev`, `build`, `start` (`node dist/main.js`), `typecheck`, `test`, `test:e2e` (sets `DATABASE_URL=${DATABASE_URL:-postgresql://corte:corte@localhost:5434/corte_test}`), and hooks `predev`, `prebuild`, `pretypecheck`, `pretest`, `pretest:e2e` that run `prisma:generate`; no `postinstall` and no `lint` script; verify the `pre*` hooks actually run with the installed pnpm version, and if they do not, chain `pnpm prisma:generate &&` inside each script instead (research.md R4 ⚠️, R8)), `tsconfig.json` (extends base, `module: commonjs`, decorators enabled), `tsconfig.build.json`, `nest-cli.json`, and Jest config for unit tests (`*.spec.ts` under `src/`)
- [X] T015 [P] [US1] Create `apps/api/.env.example` with every API variable from `contracts/environment.md` using local example values (data-model.md `EnvironmentConfig.DATABASE_URL`, `EnvironmentConfig.APP_ENV`, `EnvironmentConfig.PORT`, `EnvironmentConfig.GIT_SHA`, `EnvironmentConfig.SWAGGER_ENABLED`)
- [X] T016 [P] [US1] Create `apps/api/prisma/schema.prisma` (generator `prisma-client`, `output = "../src/generated/prisma"`, `moduleFormat = "cjs"`, datasource `postgresql`, no models) and `apps/api/prisma.config.ts` (schema path, `import 'dotenv/config'`, datasource URL from `process.env.DATABASE_URL` with the non-secret fallback `postgresql://placeholder@localhost:5432/placeholder` used only so `prisma generate` works without a database; do not use the strict `env()` helper); verify the Prisma 7 config format against the current official docs (research.md R4 ⚠️)

### Tests for User Story 1 (write first, must FAIL) ⚠️

- [X] T017 [P] [US1] Write unit tests in `apps/api/src/config/env.schema.spec.ts`: missing or invalid `DATABASE_URL` rejected (data-model.md `EnvironmentConfig.DATABASE_URL`); `APP_ENV` outside the enum rejected (`EnvironmentConfig.APP_ENV`); `PORT` defaults to 3000 and rejects out-of-range values (`EnvironmentConfig.PORT`); `GIT_SHA` empty or absent → `unknown` (`EnvironmentConfig.GIT_SHA`); `SWAGGER_ENABLED` defaults to false, and `true` with `APP_ENV=production` rejected (`EnvironmentConfig.SWAGGER_ENABLED`); error message lists the invalid variable names without printing their values
- [X] T018 [P] [US1] Write unit tests in `apps/api/src/health/health.service.spec.ts` with a mocked `HealthCheckService`: healthy result → `{ status: 'ok', database: 'up' }`; `ServiceUnavailableException` → `{ status: 'degraded', database: 'down' }`; version from config or `unknown` (data-model.md `HealthReport.status`, `HealthReport.version`, `HealthReport.database`)
- [X] T019 [P] [US1] Write e2e tests in `apps/api/test/health.e2e-spec.ts` with `apps/api/test/jest-e2e.json`, booting `AppModule` through the shared `configureApp` (research.md R8): (1) `DATABASE_URL` → `corte_test` → 200 and body exactly matching `HealthReport` in `contracts/health.openapi.yaml` (no extra properties); (2) closed port → 503 `degraded`/`down`; (3) local TCP server that accepts and never responds → 503 in ≤ 3000 ms; (4) `GIT_SHA` absent or empty → `version: "unknown"` (data-model.md `EnvironmentConfig.GIT_SHA`); (5) no auth header required; (6) `GET /api/docs` → 404 when `SWAGGER_ENABLED=false`; (7) `GET /api/docs` → 200 when `SWAGGER_ENABLED=true` and `APP_ENV=test`

### Implementation for User Story 1

- [X] T020 [US1] Implement the zod schema and `validate` function in `apps/api/src/config/env.schema.ts` per data-model.md `EnvironmentConfig.DATABASE_URL`, `EnvironmentConfig.APP_ENV`, `EnvironmentConfig.PORT`, `EnvironmentConfig.GIT_SHA`, `EnvironmentConfig.SWAGGER_ENABLED` (including the cross rule), exporting the inferred `Env` type (makes T017 pass)
- [X] T021 [US1] Implement `apps/api/src/prisma/prisma.service.ts` (extends generated `PrismaClient` with `new PrismaPg({ connectionString, connectionTimeoutMillis: 2000 })`, lazy connection so the API starts with the database down, `$disconnect` on module destroy) and `apps/api/src/prisma/prisma.module.ts` (global) (research.md R4)
- [X] T022 [US1] Implement `apps/api/src/health/health.service.ts`: `PrismaHealthIndicator.pingCheck('database', prisma, { timeout: 2000 })` via `HealthCheckService`, mapped to data-model.md `HealthReport.status`, `HealthReport.version`, `HealthReport.database` (makes T018 pass)
- [X] T023 [US1] Implement `apps/api/src/health/health.controller.ts` (`GET health`, public, responds 200 when `status = ok` and 503 when `degraded`, body = `HealthReport`) and `apps/api/src/health/health.module.ts` importing `TerminusModule`
- [X] T024 [US1] Implement `apps/api/src/app.module.ts` (`ConfigModule.forRoot({ isGlobal: true, validate })`, `PrismaModule`, `HealthModule`), `apps/api/src/app.setup.ts` with `configureApp(app)` (global prefix `api/v1`; Swagger at `/api/docs` only when `SWAGGER_ENABLED=true`) and `apps/api/src/main.ts` (bootstrap + `configureApp` + listen on `PORT`)
- [X] T025 [US1] Make `pnpm --filter api test` and `pnpm --filter api test:e2e` pass (with `pnpm db:up`) and validate quickstart.md V1–V4 manually
- [X] T026 [US1] Fill the README "API" section in `README.md`: `pnpm db:up`, copy `.env.example`, `pnpm --filter api dev`, `curl` to health, Swagger, unit and e2e tests

**Checkpoint**: User Story 1 fully functional and testable independently (MVP)

---

## Phase 4: User Story 2 - Integración continua que bloquea merges rotos (Priority: P2)

**Goal**: workflow de GitHub Actions que corre en cada PR y en push a `main`, con jobs de nombre
estable que se marcan como obligatorios para hacer merge.

**Independent Test**: quickstart.md V10: un PR con una prueba rota deja la CI en rojo y el merge
bloqueado; al corregirla queda en verde. Depende de US1 (necesita pruebas reales que ejecutar);
los jobs `domain-test` y `docker-build` se agregan en US3 y US5.

- [ ] T027 [US2] Create `.github/workflows/ci.yml`: triggers `pull_request` and `push` to `main`, `concurrency` per ref with `cancel-in-progress`, `permissions: contents: read`, shared setup (`actions/checkout`, `pnpm/action-setup`, `actions/setup-node` with Node 24 and `cache: pnpm`, `pnpm install --frozen-lockfile`), job `lint-typecheck` (`pnpm --filter @corte/domain build`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`) and job `api-e2e` with service `postgres:17-alpine` (`POSTGRES_DB=corte_test`, healthcheck `pg_isready`, port mapped) running `pnpm --filter api test` and `pnpm --filter api test:e2e` with `APP_ENV=test` and `DATABASE_URL` from `contracts/environment.md` (research.md R10)
- [ ] T028 [US2] Fill the README "CI" section in `README.md`: what each job runs, and step-by-step instructions to enable protection of `main` in GitHub (require PR and checks `lint-typecheck`, `domain-test`, `api-e2e`, `docker-build`)
- [ ] T029 [US2] Push the branch, confirm both jobs run green on the PR for this spec, then enable protection of `main` in GitHub (manual, by the repo owner) requiring a PR and the existing checks `lint-typecheck` and `api-e2e`; validate quickstart.md V10 with a throwaway PR that breaks an API unit test (CI red, merge blocked), then close it and delete its branch

**Checkpoint**: CI runs on every PR

---

## Phase 5: User Story 3 - Paquete de dominio listo para pruebas (Priority: P3)

**Goal**: un comando en `packages/domain` que corre pruebas unitarias y reporta cobertura.

**Independent Test**: quickstart.md V5: `pnpm --filter @corte/domain test:cov` pasa y muestra la
tabla de cobertura; al romper la prueba sale con código ≠ 0.

### Tests for User Story 3 (write first) ⚠️

- [ ] T030 [P] [US3] Write smoke test `packages/domain/src/index.test.ts` asserting the exported `DOMAIN_PACKAGE_NAME`

### Implementation for User Story 3

- [ ] T031 [US3] Add devDependencies `vitest` and `@vitest/coverage-v8` to `packages/domain/package.json`, scripts `test` (`vitest run`) and `test:cov` (`vitest run --coverage`), and create `packages/domain/vitest.config.ts` (coverage provider `v8`, reporters `text` and `lcov`, include `src/**`, no minimum threshold per spec.md Assumptions)
- [ ] T032 [US3] Add job `domain-test` to `.github/workflows/ci.yml` running `pnpm --filter @corte/domain test:cov`, and add the `domain-test` check to the protection of `main` (manual, by the repo owner)
- [ ] T033 [US3] Fill the README "Dominio" section in `README.md` (purpose per principio I, test and coverage commands) and validate quickstart.md V5

**Checkpoint**: Domain package test-ready

---

## Phase 6: User Story 4 - App móvil que muestra la conexión con el API (Priority: P4)

**Goal**: app Expo en iOS y Android con fuentes, tokens y componentes `Text`/`Button` del sistema
de diseño, y pantalla temporal "Conectado" / "Sin conexión" según `contracts/health-screen.md`.

**Independent Test**: quickstart.md V9 en simulador iOS y emulador Android.

- [ ] T034 [US4] Scaffold `apps/mobile` with `create-expo-app` (latest stable SDK, blank TypeScript template, no git), then add `expo-router`, `expo-font`, `expo-splash-screen`, `@tanstack/react-query`, `@expo-google-fonts/inter`, `@expo-google-fonts/plus-jakarta-sans` with `npx expo install`; set `main: "expo-router/entry"`, package name `mobile`, scripts `start`, `ios`, `android`, `typecheck` (`tsc --noEmit`) (no `lint` script); configure `apps/mobile/app.json` (name "Corte", slug `corte`, scheme `corte`, plugins `expo-router`, `expo-font`, `expo-splash-screen`) and `apps/mobile/tsconfig.json` extending `expo/tsconfig.base` with `strict: true`; routes root in `apps/mobile/src/app` (research.md R9)
- [ ] T035 [US4] Verify Metro resolves the pnpm workspace (`pnpm --filter mobile start`); only if it fails, add `node-linker=hoisted` in root `.npmrc` and note it in `README.md` (research.md R9 ⚠️)
- [ ] T036 [P] [US4] Create `apps/mobile/.env.example` with `EXPO_PUBLIC_API_URL=http://localhost:3000` and comments for Android emulator and physical device (data-model.md `MobileConfig.EXPO_PUBLIC_API_URL`, `contracts/environment.md`)
- [ ] T037 [P] [US4] Create theme in `apps/mobile/src/theme/colors.ts`, `apps/mobile/src/theme/typography.ts`, `apps/mobile/src/theme/spacing.ts` (spacing scale, screen margin 20, section gap 28, radii 8/12/16/24/full) and `apps/mobile/src/theme/index.ts`, copying values exactly from `docs/design-system.md`; typography maps each token to the loaded font family per weight (e.g. `Inter_400Regular`, `PlusJakartaSans_700Bold`) and `amount` includes `fontVariant: ['tabular-nums']` (principio IX)
- [ ] T038 [US4] Implement `apps/mobile/src/components/Text.tsx`: wraps RN `Text`, prop `variant` restricted to typography token names (default `body`) and `color` restricted to color token names; no literal style values
- [ ] T039 [US4] Implement `apps/mobile/src/components/Button.tsx`: variants `primary` (`primary` background, white text) and `secondary` (`primarySoft` background, `primaryStrong` text), `minHeight: 44`, radius 12, `disabled` and `loading` states (ActivityIndicator), `accessibilityRole="button"`, label via `Text`; only theme tokens
- [ ] T040 [P] [US4] Implement `apps/mobile/src/api/config.ts`: read `process.env.EXPO_PUBLIC_API_URL`, accept only `http(s)://` and strip a trailing `/`, return `null` when missing or invalid (data-model.md `MobileConfig.EXPO_PUBLIC_API_URL`)
- [ ] T041 [US4] Implement `apps/mobile/src/api/health.ts`: `fetchHealth(baseUrl)` calling `GET {baseUrl}/api/v1/health` with a 5000 ms timeout via `AbortController` + `setTimeout` (do not rely on `AbortSignal.timeout` in Hermes), accepting 200 or 503 only when the body is a valid report (data-model.md `HealthReport.status`, `HealthReport.version`, `HealthReport.database`), plus `useHealthQuery()` with TanStack Query (`retry: false`) returning the derived data-model.md `ConnectionStatus`
- [ ] T042 [US4] Implement `apps/mobile/src/app/_layout.tsx`: `SplashScreen.preventAutoHideAsync()`, `useFonts` for Inter 400/500/600 and Plus Jakarta Sans 600/700, hide splash when fonts load or fail (fall back to system font), wrap in `QueryClientProvider`, `Stack` without header
- [ ] T043 [US4] Implement `apps/mobile/src/app/index.tsx` following `contracts/health-screen.md` (title, status text "Comprobando conexión…" / "Conectado" / "Sin conexión", detail line with the URL or the missing-config warning, "Reintentar" button calling `refetch`, status color only as reinforcement, `accessibilityLiveRegion="polite"`) using data-model.md `ConnectionStatus`, `MobileConfig.EXPO_PUBLIC_API_URL`
- [ ] T044 [US4] Add an `apps/mobile/**` block to `eslint.config.mjs` using Expo's flat config (`eslint-config-expo`) and confirm the root `pnpm lint` (`eslint .`) and `pnpm typecheck` pass including the mobile package
- [ ] T045 [US4] Fill the README "App móvil" section in `README.md`: copy `.env.example`, `pnpm --filter mobile start`, URLs for iOS simulator (`localhost`), Android emulator (`10.0.2.2`) and physical device (Mac IP), restart Metro after changing env
- [ ] T046 [US4] Validate quickstart.md V9 on iOS simulator and Android emulator (connected, disconnected, degraded API, missing URL, fonts) and verify WCAG AA contrast (≥ 4.5:1) of every status text color against its background using the token values in `docs/design-system.md`

**Checkpoint**: Mobile app shows connection status on both platforms

---

## Phase 7: User Story 5 - API empaquetado como imagen de contenedor (Priority: P5)

**Goal**: imagen Docker multi-stage del API, < 300 MB, no root, configurada solo por variables de
entorno, construida en CI sin publicarse.

**Independent Test**: quickstart.md V8: build, `docker run` con variables → health 200 con el SHA;
usuario `node`; sin `.env` en la imagen; misma imagen con `APP_ENV=staging` y `production`.

- [ ] T047 [P] [US5] Create root `.dockerignore` excluding `**/node_modules`, `**/dist`, `**/coverage`, `**/.env*` (keep none), `.git`, `apps/mobile`, `specs`, `docs`
- [ ] T048 [US5] Create `apps/api/Dockerfile` (build context = repo root) with stages `base` (`node:24-alpine` + Corepack), `build` (`pnpm fetch`, `pnpm install --frozen-lockfile --offline`, `pnpm --filter api prisma:generate`, build domain and api, `pnpm --filter api deploy --prod --ignore-scripts /out`) and `runtime` (`node:24-alpine`, copy `/out`, `ENV NODE_ENV=production`, `ARG GIT_SHA` → `ENV GIT_SHA`, `USER node`, `EXPOSE 3000`, `CMD ["node", "dist/main.js"]`); confirm the generated Prisma client is compiled into `dist`, that `@corte/domain` lands in `/out/node_modules`, and that the deploy works without `inject-workspace-packages` on pnpm ≥ 12.2 (research.md R6 ⚠️, data-model.md `EnvironmentConfig.GIT_SHA`)
- [ ] T049 [US5] Add job `docker-build` to `.github/workflows/ci.yml`: `docker/setup-buildx-action` + `docker/build-push-action` with `file: apps/api/Dockerfile`, `push: false`, `load: true`, `build-args: GIT_SHA=${{ github.sha }}`, GitHub Actions cache, followed by a step failing if `docker image inspect --format '{{.Size}}'` exceeds 300 MB; then add the `docker-build` check to the protection of `main` (manual, by the repo owner)
- [ ] T050 [US5] Fill the README "Imagen Docker" section in `README.md` (build, run with env vars, `host.docker.internal`) and validate quickstart.md V8

**Checkpoint**: All user stories independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: cierre de la spec, verificación de criterios de éxito y protección de rama.

- [ ] T051 Complete and proofread `README.md` (Spanish, principio VIII): prerrequisitos, instalación en orden, tabla de comandos por paquete, solución de problemas comunes (puerto 5434 ocupado, Metro, emulador Android)
- [ ] T052 Verify no secrets are tracked (SC-007): `git ls-files | grep -E '\.env($|\.)'` only lists `.env.example` files, and the `.env.example` files contain only local example values
- [ ] T053 Run `pnpm format` and confirm `pnpm lint`, `pnpm typecheck`, `pnpm build`, domain tests and API unit/e2e tests all pass locally
- [ ] T054 Verify (no changes) that the protection of `main` in GitHub requires a PR and the four checks `lint-typecheck`, `domain-test`, `api-e2e`, `docker-build`
- [ ] T055 Validate merge blocking (quickstart.md V10, SC-005): open a throwaway PR breaking `packages/domain/src/index.test.ts`, confirm `domain-test` fails and merge is blocked, then close the PR and delete its branch
- [ ] T056 Time a fresh clone following only `README.md` through quickstart.md V1, V2 and V9 and confirm it takes under 15 minutes (SC-001); fix the README where steps were unclear

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; bloquea todas las historias.
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de US1 (el job `api-e2e` necesita las pruebas del API). Activa la protección de `main` con `lint-typecheck` y `api-e2e` (T029).
- **US3 (Phase 5)**: depende de Foundational; T032 depende de T027 (mismo archivo `ci.yml`) y de T029 (protección ya activa).
- **US4 (Phase 6)**: depende de Foundational; para la validación T046 necesita el API de US1 corriendo.
- **US5 (Phase 7)**: depende de US1 (empaqueta el API); T049 depende de T027 y T029.
- **Polish (Phase 8)**: depende de todas las historias.

### User Story Dependencies

```text
Setup → Foundational ─┬─ US1 (API) ─┬─ US2 (CI) ─┬─ US3·T032 (job domain-test)
                      │             │            └─ US5·T049 (job docker-build)
                      │             └─ US5 (imagen)
                      ├─ US3 (dominio: T030–T031 independientes)
                      └─ US4 (app; T046 valida contra US1)
                                                   → Polish
```

### Within Each User Story

- Las pruebas (T017–T019, T030) se escriben primero y deben fallar antes de implementar.
- Configuración → Prisma → servicio → controlador → bootstrap (US1).
- Tema → componentes → cliente del API → layout → pantalla (US4).
- Las tareas que editan `README.md`, `ci.yml` o `eslint.config.mjs` son secuenciales entre sí.

### Parallel Opportunities

- Setup: T003, T004, T005, T007 en paralelo.
- US1: T012, T013, T015, T016 en paralelo (tras T014 para T015/T016); T017, T018, T019 en paralelo.
- US3 (T030–T031) y US4 (T034–T043) pueden avanzar en paralelo con US1 tras Foundational.
- US4: T036, T037, T040 en paralelo.
- US5: T047 en paralelo con T048.

---

## Parallel Example: User Story 1

```bash
# Infraestructura local en paralelo:
Task: "Create docker-compose.yml with postgres:17-alpine on 5434"
Task: "Create docker/postgres/init.sql that creates corte_test"

# Pruebas primero, en paralelo:
Task: "Write unit tests in apps/api/src/config/env.schema.spec.ts"
Task: "Write unit tests in apps/api/src/health/health.service.spec.ts"
Task: "Write e2e tests in apps/api/test/health.e2e-spec.ts"
```

## Parallel Example: User Story 4

```bash
Task: "Create apps/mobile/.env.example"
Task: "Create theme in apps/mobile/src/theme/*"
Task: "Implement apps/mobile/src/api/config.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: US1 → API con salud corriendo en local
4. **STOP and VALIDATE**: quickstart.md V1–V4

### Incremental Delivery

1. Setup + Foundational → workspace listo
2. US1 → API + salud (MVP)
3. US2 → CI con `lint-typecheck` y `api-e2e`, y protección de `main` con esos dos checks
4. US3 → dominio con pruebas y job `domain-test`
5. US4 → app móvil con pantalla de conexión
6. US5 → imagen Docker y job `docker-build`
7. Polish → verificación de la protección de `main` y de SC-001/SC-005/SC-007

Sugerencia de commits (Conventional Commits, en inglés): uno por fase o grupo lógico, p. ej.
`chore: set up pnpm workspace and tooling`, `feat(api): add health endpoint`,
`ci: add pull request workflow`, `feat(mobile): add theme and health screen`,
`build(api): add multi-stage Dockerfile`.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Las tareas marcadas con ⚠️ requieren verificar la documentación oficial vigente (Prisma 7, pnpm 12, Expo) antes de implementarlas
- Zustand no se instala en esta spec (research.md R11)
- Verify tests fail before implementing
- Stop at any checkpoint to validate story independently
