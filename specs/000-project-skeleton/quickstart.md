# Quickstart / Guía de validación: spec 000

Pasos para comprobar de punta a punta que la spec 000 funciona. Es una guía de validación, no el
README final (que debe cubrir lo mismo para el día a día). Los contratos están en
[contracts/](./contracts/) y las variables en
[contracts/environment.md](./contracts/environment.md).

## Prerrequisitos (fuera del tiempo de 15 min de SC-001)

- Node.js 24 LTS y Corepack habilitado (`corepack enable`)
- Docker Desktop (o motor compatible con `docker compose`)
- Para la app: Xcode con simulador iOS (macOS) y/o Android Studio con un emulador; o Expo Go en un
  dispositivo físico

## V1. Instalación y base de datos (US1, FR-001, FR-007)

```bash
git clone <repo> corte && cd corte
pnpm install                 # instala los tres paquetes y genera el cliente de Prisma
pnpm db:up                   # postgres:17-alpine en localhost:5434 (corte_dev y corte_test)
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

**Esperado**: instalación sin errores; `docker compose ps` muestra postgres `healthy`.

## V2. API y salud (US1, FR-005, FR-006)

```bash
pnpm --filter api dev
curl -i http://localhost:3000/api/v1/health
```

**Esperado**: `HTTP/1.1 200` y `{"status":"ok","version":"unknown","database":"up"}`.

```bash
pnpm db:down
curl -i http://localhost:3000/api/v1/health
```

**Esperado**: `HTTP/1.1 503` y `{"status":"degraded","version":"unknown","database":"down"}`, en
≤ 3 s. Volver a levantar la base con `pnpm db:up` → vuelve a 200 sin reiniciar el API.

## V3. Configuración inválida (FR-008)

```bash
DATABASE_URL= pnpm --filter api start
```

**Esperado**: el proceso termina con código ≠ 0 y el mensaje nombra `DATABASE_URL`.
Con `APP_ENV=production SWAGGER_ENABLED=true` también se niega a arrancar.

## V4. Swagger fuera de producción (FR-010)

Con `SWAGGER_ENABLED=true` en `.env`: `http://localhost:3000/api/docs` carga. Con `false`: 404.

## V5. Dominio (US3, FR-004)

```bash
pnpm --filter @corte/domain test:cov
```

**Esperado**: la prueba de humo pasa y se imprime la tabla de cobertura. Si se rompe la prueba,
el comando sale con código ≠ 0.

## V6. Pruebas del API (FR-011)

```bash
pnpm --filter api test        # unitarias
pnpm --filter api test:e2e    # requiere pnpm db:up (usa corte_test)
```

**Esperado**: pasan los casos base arriba (200), base caída (503) y base colgada (503 en ≤ 3 s).

## V7. Lint y tipos (FR-003)

```bash
pnpm lint && pnpm typecheck
```

**Esperado**: sin errores en los tres paquetes.

## V8. Imagen de contenedor (US5, FR-012, FR-013)

```bash
docker build -f apps/api/Dockerfile --build-arg GIT_SHA=$(git rev-parse HEAD) -t corte-api .
docker image ls corte-api                       # tamaño < 300 MB
docker run --rm -p 3001:3000 \
  -e APP_ENV=staging \
  -e DATABASE_URL=postgresql://corte:corte@host.docker.internal:5434/corte_dev \
  corte-api
curl -s http://localhost:3001/api/v1/health     # version = SHA del commit
docker run --rm corte-api whoami                # node (no root)
docker run --rm corte-api sh -c 'ls -a | grep -c "^.env" || true'   # 0
```

**Esperado**: build sin errores; respuesta 200 con el SHA; usuario `node`; sin archivos `.env`.
Repetir el `docker run` con `APP_ENV=production` y la misma imagen → también arranca (SC-006).

## V9. App móvil (US4, FR-014…FR-019)

```bash
# apps/mobile/.env → EXPO_PUBLIC_API_URL=http://localhost:3000 (iOS) o http://10.0.2.2:3000 (Android)
pnpm --filter mobile start      # luego "i" para iOS o "a" para Android
```

**Esperado**:

1. Splash hasta cargar las fuentes; título "Corte" en Plus Jakarta Sans, resto en Inter.
2. Con el API corriendo → "Conectado".
3. Detener el API, pulsar "Reintentar" → "Sin conexión" en ≤ 6 s.
4. Con la base caída pero el API arriba → "Conectado".
5. Sin `EXPO_PUBLIC_API_URL` (reiniciando Metro) → "Sin conexión" + aviso de configuración.
6. Mismo resultado en iOS y Android.

## V10. CI y bloqueo de merge (US2, FR-020, FR-021)

1. Activar la protección de `main` en GitHub (Settings → Branches/Rules): exigir PR y los checks
   `lint-typecheck`, `domain-test`, `api-e2e` y `docker-build`.
2. Abrir un PR con una prueba del dominio rota a propósito.

**Esperado**: `domain-test` falla y GitHub bloquea el merge. Al corregirla, los 4 checks pasan en
verde y el merge se habilita.

## Criterio global (SC-001)

Desde un clon limpio, V1 + V2 + V9 se completan en menos de 15 minutos siguiendo solo el README.
