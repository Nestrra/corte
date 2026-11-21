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

App Expo (SDK 58) en `apps/mobile`, con expo-router y TanStack Query. Corre en **Expo Go**. Por
ahora muestra una pantalla temporal que consulta `/api/v1/health` e indica "Conectado" o
"Sin conexión".

### Configurar la URL del API

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Edita `EXPO_PUBLIC_API_URL` en `apps/mobile/.env` según dónde corre la app:

| Dónde                        | `EXPO_PUBLIC_API_URL`                               |
| ---------------------------- | --------------------------------------------------- |
| Simulador iOS                | `http://localhost:3000`                             |
| Emulador Android             | `http://10.0.2.2:3000` (el `localhost` de tu Mac)   |
| Dispositivo físico (Expo Go) | `http://<IP-de-tu-Mac>:3000`, en la misma red Wi-Fi |

La IP de tu Mac: `ipconfig getifaddr en0`. Las variables `EXPO_PUBLIC_*` quedan dentro del bundle:
nunca pongas secretos ahí. Después de cambiar `.env`, reinicia Metro con `--clear`.

### Ejecutar

```bash
pnpm --filter api dev            # en otra terminal: el API debe estar corriendo
pnpm --filter mobile start       # Metro; luego "i" (iOS), "a" (Android) o escanea el QR con Expo Go
pnpm --filter mobile start --clear   # si cambiaste .env o algo se ve desactualizado
```

La app usa los tokens de `docs/design-system.md` (`apps/mobile/src/theme`) y los componentes base
`Text` y `Button` (`apps/mobile/src/components`). No escribas colores, tamaños ni espaciados
sueltos en los componentes (constitución, principio IX).

## Imagen Docker

El API se empaqueta en una imagen multi-stage sobre `node:24-alpine` (`apps/api/Dockerfile`).
La misma imagen corre en cualquier entorno: toda la configuración entra por variables de entorno
(constitución, principio VII). Corre con el usuario `node` (no root) y no contiene archivos
`.env` ni secretos.

```bash
# Construir desde la raíz del repo; GIT_SHA queda como versión reportada por /api/v1/health
docker build -f apps/api/Dockerfile --build-arg GIT_SHA=$(git rev-parse HEAD) -t corte-api .

# Ejecutar contra la base local (pnpm db:up). host.docker.internal apunta a tu Mac desde el contenedor
docker run --rm -p 3001:3000 \
  -e APP_ENV=staging \
  -e DATABASE_URL=postgresql://corte:corte@host.docker.internal:5434/corte_dev \
  corte-api

curl -s http://localhost:3001/api/v1/health   # version = SHA del commit
```

- `GIT_SHA` se puede sobrescribir al ejecutar con `-e GIT_SHA=...`; vacío o ausente → `unknown`.
- Objetivo de tamaño: menos de 300 MB descomprimida (la CI lo verifica en el job `docker-build`).
  Para lograrlo, la imagen elimina los compiladores de consultas de Prisma para motores distintos
  de PostgreSQL, los source maps de las dependencias y los paquetes `@types/*`.

## CI

GitHub Actions (`.github/workflows/ci.yml`) corre en cada PR y en cada push a `main`. Cada job
es un check con nombre fijo:

| Check            | Qué ejecuta                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| `lint-typecheck` | `pnpm lint`, `pnpm typecheck` y `pnpm format:check`                    |
| `domain-test`    | Pruebas del dominio con cobertura                                      |
| `api-e2e`        | Pruebas unitarias y e2e del API contra un PostgreSQL 17 real (service) |
| `docker-build`   | Construcción de la imagen del API sin publicarla y control de tamaño   |

### Protección de la rama `main`

Para que un PR con la CI en rojo no se pueda mergear, el dueño del repositorio debe activar la
protección de `main` en GitHub:

1. Settings → Branches → Add branch protection rule (o Settings → Rules → Rulesets).
2. Patrón de rama: `main`.
3. Activar **Require a pull request before merging**.
4. Activar **Require status checks to pass before merging** y marcar como requeridos
   `lint-typecheck`, `domain-test`, `api-e2e` y `docker-build`.
5. Guardar.

> GitHub solo permite proteger ramas en repositorios privados con un plan de pago (Pro, Team o
> Enterprise). En un repositorio privado con GitHub Free, la protección (y los rulesets) no
> están disponibles: hay que hacer público el repositorio o mejorar el plan.
