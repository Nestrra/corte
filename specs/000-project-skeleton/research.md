# Research: Esqueleto del proyecto Corte

Fase 0 de [plan.md](./plan.md). No quedaron `NEEDS CLARIFICATION` en el Technical Context: las
decisiones de stack vienen del usuario y de la constitución. Este documento registra cómo se
aplican y los puntos delicados que hay que resolver al implementar.

> Las versiones exactas ("última estable") se fijan en el lockfile al instalar. Los detalles de
> Prisma 7, pnpm 12 y Expo marcados con ⚠️ se verifican contra la documentación oficial vigente
> durante `/speckit-implement`.

## R1. Monorepo y herramientas raíz

- **Decision**: pnpm workspaces (`apps/*`, `packages/*`), sin Turborepo. Node 24 LTS fijado en
  `.nvmrc` y `engines`; pnpm 12 (≥ 12.2) fijado en `packageManager` (Corepack), con
  `engines.pnpm` `>=12.2.0`. `tsconfig.base.json` con
  `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` desactivado (choca con tipos de
  Nest y Expo). ESLint flat config único en la raíz con typescript-eslint y bloques por paquete
  (reglas de React/Expo solo en `apps/mobile`). Un único script `lint` en la raíz (`eslint .`);
  los paquetes no tienen script `lint` propio. Prettier en la raíz, con `format` y `format:check`.
- **Rationale**: tres paquetes no justifican un orquestador; `pnpm -r` ya ejecuta en orden
  topológico. Un solo ESLint evita configuraciones divergentes.
- **Alternatives considered**: Turborepo/Nx (caché y orquestación innecesarias hoy, van a v2 si la
  CI se vuelve lenta); ESLint por paquete (más archivos, mismo resultado).

## R2. Consumo de `packages/domain`

- **Decision**: el dominio compila con `tsc` a `dist/` en CommonJS con declaraciones `.d.ts`;
  `package.json` expone `exports` → `dist`. En esta spec solo el API lo declara como
  `"@corte/domain": "workspace:*"`; la app lo agregará cuando lo necesite (principio VI). El
  script raíz `build` compila el dominio antes que el API.
  - **Paquetes enlazados**: no se activa `inject-workspace-packages`. En desarrollo pnpm enlaza
    (symlink) `@corte/domain` dentro de `apps/api/node_modules`, así que `tsc --watch` en el
    dominio se refleja de inmediato en el API sin reinstalar. Con pnpm ≥ 12.2, `pnpm deploy`
    funciona sin inyección (ver R6).
- **Rationale**: Nest compila a CommonJS y Jest carga CommonJS sin configuración extra, y Metro
  también podrá consumirlo. Un único artefacto evita que los consumidores vean versiones distintas
  del código.
- **Alternatives considered**: consumir el código fuente TS directamente (requiere configurar
  path mapping en Nest, Jest y Metro por separado); emitir ESM (Jest de Nest necesita configuración
  experimental para ESM).
- **Pureza (principio I)**: regla `no-restricted-imports` en `packages/domain` que prohíbe
  `node:*`, `fs`, `http`, `pg`, `@prisma/*`, `react*` y `expo*`.

## R3. Configuración del API (zod)

- **Decision**: `ConfigModule.forRoot({ isGlobal: true, validate })`, donde `validate` ejecuta un
  esquema zod y lanza un error con los nombres de las variables inválidas. Variables en
  [contracts/environment.md](./contracts/environment.md). Regla cruzada: `SWAGGER_ENABLED=true` con
  `APP_ENV=production` es inválido.
- **Rationale**: falla temprano (FR-008) y obtenemos el tipo de la configuración a partir del
  esquema. `APP_ENV` es distinto de `NODE_ENV`, porque la imagen corre con `NODE_ENV=production`
  tanto en staging como en producción.
- **Alternatives considered**: Joi (el ejemplo de la documentación de Nest; zod da mejor
  inferencia de tipos y el usuario lo eligió); validar con class-validator (más código).

## R4. Prisma 7 con `@prisma/adapter-pg` ⚠️

- **Decision**:
  - `prisma/schema.prisma` con `generator client { provider = "prisma-client", output =
    "../src/generated/prisma", moduleFormat = "cjs" }` y `datasource db { provider = "postgresql" }`,
    sin modelos.
  - `prisma.config.ts` define la ruta del schema y la URL desde `DATABASE_URL`. Prisma 7 no carga
    `.env` automáticamente, así que el archivo importa `dotenv/config` (dependencia de desarrollo;
    en contenedor y CI las variables ya existen).
  - **Valor de reserva para `generate`**: `prisma.config.ts` lee `process.env.DATABASE_URL` (no el
    helper estricto `env()`) con el valor de reserva no secreto
    `postgresql://placeholder@localhost:5432/placeholder`. `prisma generate` no se conecta a la
    base, así que funciona en el job `lint-typecheck` y en la etapa de build de Docker, donde no
    hay `DATABASE_URL`. El API en tiempo de ejecución no usa ese valor: su `DATABASE_URL` sale de
    la configuración validada con zod (R3), que es obligatoria.
  - `PrismaService extends PrismaClient`, construido con `adapter: new PrismaPg({
    connectionString, connectionTimeoutMillis: 2000 })`. Se conecta de forma perezosa: si la base
    está caída, el API arranca igual y la salud reporta `degraded`.
  - El cliente generado no se versiona (`.gitignore`). No hay `postinstall`: el API tiene un
    script explícito `prisma:generate` y los hooks `prebuild`, `pretypecheck`, `pretest`,
    `pretest:e2e` y `predev` lo ejecutan antes de cada uno de esos scripts. En el Dockerfile se
    genera en la etapa de build (R6). ⚠️ Los hooks `pre*` requieren que pnpm ejecute scripts
    pre/post (`enable-pre-post-scripts`); si la versión instalada no lo hace por defecto, se
    encadena `pnpm prisma:generate &&` dentro de cada script.
  - **Por qué no `postinstall`**: `pnpm deploy --prod` reinstala solo dependencias de producción;
    un `postinstall` que llama al CLI `prisma` (dependencia de desarrollo) rompería el build de la
    imagen.
- **Rationale**: sin motor binario se reduce la imagen y se evitan problemas de Alpine/musl.
  `moduleFormat = "cjs"` encaja con Nest + Jest. Conectar de forma perezosa cumple el escenario
  "API corriendo con base caída" (US1-3).
- **Alternatives considered**: el generador antiguo `prisma-client-js` (en desuso en Prisma 7);
  `pg` directo para el ping (se descarta porque Prisma es el ORM fijado por la constitución y la
  siguiente spec lo necesita).

## R5. Endpoint de salud

- **Decision**: `@nestjs/terminus` con `PrismaHealthIndicator.pingCheck('database', prisma, {
  timeout: 2000 })`. `HealthService` envuelve `HealthCheckService.check()`, captura el
  `ServiceUnavailableException` de terminus y lo traduce al contrato propio
  ([health.openapi.yaml](./contracts/health.openapi.yaml)): `{ status, version, database }`, con
  HTTP 200 o 503. La versión sale de `GIT_SHA` o `"unknown"`. Prefijo global con
  `app.setGlobalPrefix('api/v1')`.
- **Rationale**: terminus aporta el timeout y el ping probados; el formato nativo de terminus
  (`info` / `error` / `details`) no coincide con la spec, por eso se mapea.
- **Alternatives considered**: un controlador propio con `SELECT 1` y `Promise.race` (menos
  dependencias, pero el usuario eligió terminus y lo reutilizaremos para más chequeos).
- **Swagger**: `@nestjs/swagger` en `/api/docs`, montado solo si `SWAGGER_ENABLED=true`.

## R6. Imagen Docker ⚠️

- **Decision**: Dockerfile multi-stage en `apps/api/Dockerfile`, con el contexto de build en la
  raíz del repo:
  1. `base`: `node:24-alpine` + Corepack (pnpm).
  2. `build`: `pnpm fetch` → `pnpm install --frozen-lockfile --offline` →
     `pnpm --filter api prisma:generate` → build del dominio y del API (el cliente generado en
     `src/generated` se compila dentro de `dist`) →
     `pnpm --filter api deploy --prod --ignore-scripts /out`.
  3. `runtime`: `node:24-alpine`, copia `/out`, `ENV NODE_ENV=production`, `ARG GIT_SHA` →
     `ENV GIT_SHA=$GIT_SHA`, `USER node`, `EXPOSE 3000`, `CMD ["node", "dist/main.js"]`.
  - **pnpm 12 y deploy sin inyección**: según la documentación vigente de `pnpm deploy`
    (consultada el 2026-11-21), desde pnpm 12.2.0 `pnpm deploy` ya no exige
    `injectWorkspacePackages`. Por eso el proyecto fija pnpm ≥ 12.2 (R1) y usa el deploy normal,
    sin `--legacy` ni `forceLegacyDeploy`, manteniendo los paquetes enlazados en desarrollo (R2).
  - **Alternativa descartada**: quedarse en pnpm 10 y usar `deploy --legacy` (o
    `forceLegacyDeploy: true` en `pnpm-workspace.yaml`); obliga a usar una implementación antigua
    del deploy solo para la imagen.
  - `--ignore-scripts` evita ejecutar scripts de ciclo de vida durante el deploy (el cliente de
    Prisma ya va compilado en `dist`).
  - El deploy copia `@corte/domain` (su `dist`) dentro de `/out/node_modules`. ⚠️ Confirmarlo al
    construir la imagen.
  - `.dockerignore` excluye `node_modules`, `.env*`, `apps/mobile`, `.git` y `coverage`.
- **Rationale**: la imagen final solo lleva el código compilado y las dependencias de producción.
  Con Alpine y sin motor de Prisma, el objetivo de < 300 MB tiene margen.
- **Alternatives considered**: `node:24-slim` (más grande); distroless (sin shell, depurar es más
  difícil; puede ir a v2).
- **Verificación**: la CI comprueba el tamaño de la imagen y falla si supera 300 MB.

## R7. Bases de datos local y de pruebas

- **Decision**: `docker-compose.yml` con un único servicio `postgres:17-alpine` en el puerto
  `5434:5432`, volumen nombrado y healthcheck `pg_isready`; `docker/postgres/init.sql` crea
  `corte_test` además de `corte_dev`. Scripts raíz `pnpm db:up` y `pnpm db:down`.
- **Rationale**: un solo comando (FR-007). El puerto 5434 evita chocar con un PostgreSQL local. Usar
  bases separadas en el mismo contenedor evita que las e2e ensucien los datos de desarrollo.
- **Alternatives considered**: dos contenedores (más recursos); Testcontainers (más dependencias y
  arranque lento; no se necesita porque la CI usa service containers).

## R8. Pruebas e2e del API

- **Decision**: Jest + supertest levantando la app real con `Test.createTestingModule(AppModule)`
  y aplicando el mismo bootstrap que `main.ts` (prefijo global). Tres casos:
  1. **Base arriba**: `DATABASE_URL` → `corte_test` → 200 / `ok` / `up`.
  2. **Base caída**: `DATABASE_URL` → `127.0.0.1` en un puerto cerrado → 503 / `degraded` /
     `down`.
  3. **Base colgada**: un servidor TCP local que acepta conexiones y nunca responde → 503 en ≤ 3 s
     (SC-003).
  También se prueba que `GIT_SHA` ausente o vacío produce `"unknown"`, que `/api/docs` responde
  404 con `SWAGGER_ENABLED=false` y 200 con `SWAGGER_ENABLED=true`. El bootstrap compartido vive en
  una función `configureApp(app)` que usan `main.ts` y las e2e.
- **Base de pruebas por defecto**: el script `test:e2e` usa
  `DATABASE_URL=${DATABASE_URL:-postgresql://corte:corte@localhost:5434/corte_test}`; en local
  basta con `pnpm db:up`, y en CI la variable del job tiene prioridad.
- **Rationale**: los casos de base caída o colgada no se pueden simular deteniendo el servicio de
  la CI; apuntar a un puerto cerrado o a un socket mudo es determinista y no usa mocks de la base.
- **Alternatives considered**: detener el contenedor durante la prueba (frágil y lento).

## R9. App móvil ⚠️

- **Decision**:
  - Proyecto Expo con la plantilla en blanco de TypeScript + expo-router, con `src/app` como
    directorio de rutas.
  - Monorepo: Expo detecta automáticamente los workspaces pnpm desde el SDK 52. Si aparecen
    problemas de resolución de Metro con el layout aislado de pnpm, se usa `node-linker=hoisted`
    en `.npmrc` (se documenta si llega a aplicarse).
  - Fuentes: `useFonts` con Inter 400/500/600 y Plus Jakarta Sans 600/700; la splash screen se
    mantiene hasta que cargan o fallan (si fallan, se continúa con la fuente del sistema).
  - Tema: `colors`, `typography`, `spacing` y `radii` copiados exactos de
    `docs/design-system.md`; `typography.amount` incluye `fontVariant: ['tabular-nums']`.
  - `Text`: prop `variant` limitada a los tokens tipográficos y `color` limitada a tokens de
    color. `Button`: variantes `primary` y `secondary`, `minHeight: 44`, radio 12, estados
    deshabilitado y cargando, y `accessibilityRole="button"`.
  - Salud: `fetch(`${API_URL}/api/v1/health`, { signal: AbortSignal.timeout(5000) })` dentro de
    un `useQuery` con `retry: false`. Muestra "Conectado" si la respuesta cumple el contrato
    (200 o 503), y "Sin conexión" en cualquier otro caso. "Reintentar" llama a `refetch()`.
  - `EXPO_PUBLIC_API_URL` se lee en `src/api/config.ts`; si falta, se muestra "Sin conexión" con
    el aviso "Falta configurar EXPO_PUBLIC_API_URL".
- **Rationale**: cumple FR-014…FR-019 con lo mínimo. TanStack Query aporta estado de carga y error
  y la base para las siguientes pantallas.
- **Alternatives considered**: `fetch` en un `useEffect` (se reharía en la siguiente spec);
  `react-native-config` (Expo ya soporta `EXPO_PUBLIC_*`).
- **Android/dispositivo físico**: el README explica `http://10.0.2.2:3000` para el emulador
  Android y `http://<IP-del-Mac>:3000` para dispositivos físicos en la misma red.

## R10. CI (GitHub Actions)

- **Decision**: `.github/workflows/ci.yml` con disparadores `pull_request` y `push` a `main`, y
  `concurrency` que cancela ejecuciones viejas del mismo PR. Jobs con nombres estables (son los
  que se marcan como requeridos en la protección de rama):
  1. `lint-typecheck`: `pnpm lint` (un solo `eslint .`), `pnpm typecheck` (los tres paquetes) y
     `pnpm format:check` (Prettier).
  2. `domain-test`: `pnpm --filter @corte/domain test:cov`.
  3. `api-e2e`: service `postgres:17-alpine` con healthcheck y `POSTGRES_DB=corte_test`; ejecuta
     las pruebas unitarias y e2e del API (los hooks `pretest` generan el cliente de Prisma).
  4. `docker-build`: `docker/build-push-action` con `push: false`, `build-args:
     GIT_SHA=${{ github.sha }}`, caché de GitHub Actions y verificación de tamaño < 300 MB.
  - Setup común: `pnpm/action-setup` + `actions/setup-node` (Node 24, `cache: pnpm`).
- **Rationale**: los jobs paralelos dan feedback rápido, y los nombres estables permiten
  configurar los checks requeridos una sola vez.
- **Alternatives considered**: un solo job secuencial (más lento y con fallos menos claros).
- **Bloqueo de merge**: requiere activar a mano la protección de `main` (paso documentado en el
  README). Se activa de forma incremental: en US2 con los checks que ya existen (`lint-typecheck`,
  `api-e2e`), y `domain-test` y `docker-build` se agregan como requeridos cuando se crean sus
  jobs (US3 y US5).

## R11. Zustand

- **Decision**: no se instala en esta spec.
- **Rationale**: ningún requisito de la spec 000 necesita estado global en el cliente (el estado
  del servidor lo maneja TanStack Query). El principio VI pide construir solo lo de la spec
  vigente. Sigue siendo el estándar fijado por la constitución y se agregará en la primera spec que
  lo use (probablemente la de autenticación, para la sesión).
- **Alternatives considered**: instalarlo ahora sin uso (dependencia muerta).

## R12. Pruebas unitarias mínimas del API

- **Decision**: `env.schema.spec.ts` (variable faltante, valores por defecto, Swagger en
  producción rechazado) y `health.service.spec.ts` (mapeo de los resultados de terminus a
  `ok`/`degraded`, versión `unknown`).
- **Rationale**: son las únicas reglas propias del API en esta spec (principio II).

## R13. Desviaciones encontradas al implementar (2026-11-21)

Decisiones tomadas durante `/speckit-implement` (T001–T026) al chocar con las versiones reales.

1. **NestJS 12 es solo ESM.** Todos los paquetes `@nestjs/*` 12 se publican con
   `"type": "module"`. Se sigue la plantilla oficial `ts` de Nest 12: la app sigue siendo
   CommonJS (`module`/`moduleResolution: nodenext` sin `"type": "module"`), Node 24 carga los
   paquetes ESM con `require(esm)`, y Jest corre con
   `node --experimental-vm-modules ./node_modules/jest/bin/jest.js`. Efecto: Jest imprime un
   `ExperimentalWarning` en cada ejecución. Alternativa descartada por ahora: la plantilla
   `ts-esm` de Nest 12 (app ESM + Vitest), que cambia el runner de pruebas fijado en el plan.
2. **TypeScript 6.0.x, no 7.** TypeScript 7.0.2 es la última, pero `typescript-eslint` soporta
   `<6.1` y `ts-jest` `<7`. TypeScript 6 depreca `moduleResolution: node10` y `baseUrl`, así que
   dominio y API usan `nodenext` (emite CommonJS), el API fija `rootDir: "."` y mantiene
   `isolatedModules: true` (ts-jest lo exige con `nodenext`). Revisar al subir de versión cuando
   las herramientas soporten TypeScript 7.
3. **Prisma fijado exactamente en 7.10.1.** En npm, `prisma@latest` apunta a `8.0.0-rc.34` (una
   RC). La constitución fija Prisma 7, así que `prisma`, `@prisma/client` y `@prisma/adapter-pg`
   se fijan en `7.10.1` sin rango.
4. **`AppModule.register()`.** El módulo raíz es dinámico: `ConfigModule.forRoot` con la
   validación zod se evalúa al llamar `register()` y no al importar el archivo. Así el proceso
   sigue fallando al arrancar con configuración inválida (FR-008) y las e2e pueden arrancar la
   app con distintos entornos (base caída, colgada, Swagger on/off).
5. **pnpm 12 bloquea los scripts de instalación por defecto.** `pnpm install` falla con
   `ERR_PNPM_IGNORED_BUILDS` hasta aprobar cada paquete. En `pnpm-workspace.yaml` → `allowBuilds`
   se aprueban `prisma` y `@prisma/engines` (CLI de Prisma) y se niegan `@scarf/scarf`
   (telemetría) y `@parcel/watcher` (no se necesita).
6. **Imagen < 300 MB requiere recortar dependencias (US5).** Con el Dockerfile de R6 la imagen
   descomprimida pesaba 322 MB, sobre todo por `@prisma/client` (71 MB: el compilador de
   consultas WASM para cinco motores, en CJS y ESM). En la etapa de build, sobre `/out`, se
   borran los compiladores de motores distintos de PostgreSQL, los `.map` de las dependencias y
   los paquetes `@types/*`, y queda en 244 MB. Depende de los nombres internos de los archivos de
   Prisma (`query_compiler_*_bg.<motor>.*`): revisar al actualizar Prisma. La CI mide la suma de
   capas descomprimidas con `docker history`, porque `docker image inspect .Size` devuelve el
   tamaño comprimido con el almacén de imágenes de containerd (Docker Desktop) y el descomprimido
   con el almacén clásico. Además, `apps/api/package.json` declara `"files": ["dist"]`, porque
   `pnpm deploy` empaqueta el proyecto como un paquete y `dist` está en `.gitignore`.
