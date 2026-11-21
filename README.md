# Corte

App móvil multiusuario para controlar tarjetas de crédito por ciclo de corte, compras a cuotas,
extractos, alertas y pagos recurrentes. Uso personal y familiar.

Monorepo pnpm con tres paquetes:

| Paquete           | Descripción                                                 |
| ----------------- | ----------------------------------------------------------- |
| `apps/api`        | API NestJS + Prisma 7 + PostgreSQL 17                       |
| `apps/mobile`     | App Expo (React Native)                                     |
| `packages/domain` | Lógica de negocio pura en TypeScript (fechas, cuotas, etc.) |

La constitución del proyecto está en `.specify/memory/constitution.md` y las specs en `specs/`.

## Prerrequisitos

- Node.js 24 LTS (`.nvmrc`) con Corepack habilitado: `corepack enable`
- pnpm 12 (lo instala Corepack según `packageManager`)
- Docker Desktop (o un motor compatible con `docker compose`)
- Para la app: Xcode con simulador iOS (macOS) y/o Android Studio con un emulador

## Instalación

```bash
corepack enable
pnpm install
```

## API

API NestJS en `apps/api`. Toda su configuración sale de variables de entorno
(ver `specs/000-project-skeleton/contracts/environment.md`).

### Levantar en local

```bash
pnpm db:up                                  # PostgreSQL 17 en localhost:5434 (corte_dev y corte_test)
cp apps/api/.env.example apps/api/.env      # valores locales de ejemplo, sin secretos
pnpm --filter api dev                       # API en http://localhost:3000 con recarga automática
```

Comprobar la salud del servicio:

```bash
curl -i http://localhost:3000/api/v1/health
# HTTP 200 → {"status":"ok","version":"unknown","database":"up"}
# Con la base detenida (pnpm db:down) → HTTP 503 y {"status":"degraded",...,"database":"down"}
```

- `version` es el valor de `GIT_SHA`, o `unknown` si no está definido.
- Si falta o es inválida una variable obligatoria, el API no arranca y el mensaje nombra la
  variable.
- La documentación interactiva (Swagger) está en http://localhost:3000/api/docs cuando
  `SWAGGER_ENABLED=true`. En producción está prohibida: el API no arranca si se intenta activar.

### Pruebas

```bash
pnpm --filter api test        # unitarias
pnpm --filter api test:e2e    # e2e contra PostgreSQL real; requiere pnpm db:up (usa corte_test)
```

El cliente de Prisma se genera automáticamente antes de `dev`, `build`, `typecheck`, `test` y
`test:e2e` (script `prisma:generate`).

## Dominio

`packages/domain` es la única fuente de los cálculos de negocio (fechas de corte, fechas límite,
cuotas e intereses) para el API y la app. Es TypeScript puro, sin I/O: ESLint prohíbe importar
módulos de Node, de base de datos, de React o de Expo dentro del paquete (constitución,
principio I). En la spec 000 todavía no tiene reglas de negocio.

```bash
pnpm --filter @corte/domain test        # pruebas unitarias (Vitest)
pnpm --filter @corte/domain test:cov    # pruebas + reporte de cobertura (v8)
pnpm --filter @corte/domain dev         # recompila en modo watch; el API lo ve al instante
```

## App móvil

_Pendiente (spec 000, US4)._

## Imagen Docker

_Pendiente (spec 000, US5)._

## CI

GitHub Actions (`.github/workflows/ci.yml`) corre en cada PR y en cada push a `main`. Cada job
es un check con nombre fijo:

| Check            | Qué ejecuta                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| `lint-typecheck` | `pnpm lint`, `pnpm typecheck` y `pnpm format:check`                    |
| `domain-test`    | Pruebas del dominio con cobertura                                      |
| `api-e2e`        | Pruebas unitarias y e2e del API contra un PostgreSQL 17 real (service) |
| `docker-build`   | Construcción de la imagen del API sin publicarla _(se agrega en US5)_  |

### Protección de la rama `main`

Para que un PR con la CI en rojo no se pueda mergear, el dueño del repositorio debe activar la
protección de `main` en GitHub:

1. Settings → Branches → Add branch protection rule (o Settings → Rules → Rulesets).
2. Patrón de rama: `main`.
3. Activar **Require a pull request before merging**.
4. Activar **Require status checks to pass before merging** y marcar como requeridos
   `lint-typecheck`, `domain-test` y `api-e2e` (y `docker-build` cuando exista).
5. Guardar.

> GitHub solo permite proteger ramas en repositorios privados con un plan de pago (Pro, Team o
> Enterprise). En un repositorio privado con GitHub Free, la protección (y los rulesets) no
> están disponibles: hay que hacer público el repositorio o mejorar el plan.
