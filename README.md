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

- **Node.js 24 LTS** (versión en `.nvmrc`; se recomienda ≥ 24.15, que es lo que piden las
  herramientas de NestJS).
- **Corepack** (viene con Node) para usar la versión de pnpm fijada en `package.json` (pnpm 12).
- **Docker Desktop** (o un motor compatible con `docker compose`).
- **Para la app**: Xcode con simulador iOS (macOS) y/o Android Studio con un emulador; o Expo Go
  en un teléfono.

## Inicio rápido

Desde un clon limpio, en este orden:

```bash
# 1. Instalar dependencias
git clone https://github.com/Nestrra/corte.git && cd corte
corepack enable                     # ver "Solución de problemas" si falla por permisos
pnpm install

# 2. Base de datos local (PostgreSQL 17 en localhost:5434, bases corte_dev y corte_test)
pnpm db:up

# 3. Variables de entorno locales (valores de ejemplo, sin secretos)
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env

# 4. API (terminal 1) → http://localhost:3000
pnpm --filter api dev
curl -i http://localhost:3000/api/v1/health      # HTTP 200 {"status":"ok",...}

# 5. App (terminal 2) → pulsa "i" (iOS) o "a" (Android; antes cambia la URL, ver "App móvil")
pnpm --filter mobile start
```

La app debe mostrar **"Conectado"**. Para detener la base: `pnpm db:down`.

## Comandos

| Comando                                | Qué hace                                                 |
| -------------------------------------- | -------------------------------------------------------- |
| `pnpm install`                         | Instala las dependencias de los tres paquetes            |
| `pnpm db:up` / `pnpm db:down`          | Levanta / detiene el PostgreSQL local (Docker)           |
| `pnpm build`                           | Compila el dominio y el API                              |
| `pnpm lint`                            | ESLint en todo el monorepo (`eslint .`)                  |
| `pnpm typecheck`                       | Verificación de tipos de los tres paquetes               |
| `pnpm format` / `pnpm format:check`    | Formatea / verifica el formato con Prettier              |
| `pnpm --filter api dev`                | API con recarga automática                               |
| `pnpm --filter api test`               | Pruebas unitarias del API                                |
| `pnpm --filter api test:e2e`           | Pruebas e2e del API contra PostgreSQL (requiere `db:up`) |
| `pnpm --filter @corte/domain test:cov` | Pruebas del dominio con cobertura                        |
| `pnpm --filter mobile start`           | Metro para la app (Expo Go, simulador o emulador)        |
| `pnpm --filter mobile typecheck`       | Verificación de tipos de la app                          |

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

## Solución de problemas

- **`corepack enable` falla con `EACCES` / permiso denegado**: Corepack intenta crear enlaces en
  `/usr/local/bin`. Usa `sudo corepack enable`, o instala los enlaces en una carpeta tuya que
  esté en el `PATH`: `corepack enable --install-directory ~/.local/bin`. Mientras tanto puedes
  anteponer `corepack` a cada comando (`corepack pnpm install`), aunque los scripts que llaman a
  `pnpm` internamente necesitan el enlace.
- **El puerto 5434 está ocupado**: otro proceso usa ese puerto (`lsof -nP -iTCP:5434`). Detenlo o
  cambia el puerto en `docker-compose.yml` y en `DATABASE_URL` de `apps/api/.env`.
- **El puerto 3000 está ocupado** (por ejemplo, otro API corriendo): cambia `PORT` en
  `apps/api/.env` y usa el mismo puerto en `EXPO_PUBLIC_API_URL` de `apps/mobile/.env`.
- **`container name "/corte-postgres" is already in use`**: ya existe el contenedor de otro clon
  del repo. Detenlo con `docker rm -f corte-postgres` (los datos quedan en su volumen).
- **`pnpm install` falla con `ERR_PNPM_IGNORED_BUILDS`**: una dependencia nueva quiere ejecutar
  scripts de instalación. Revísala y apruébala (o niégala) con `pnpm approve-builds <paquete>`;
  queda registrada en `allowBuilds` de `pnpm-workspace.yaml`.
- **La app muestra "Sin conexión" con el API corriendo**: revisa `EXPO_PUBLIC_API_URL` en
  `apps/mobile/.env` (en el emulador Android es `http://10.0.2.2:3000`, no `localhost`) y
  reinicia Metro con `pnpm --filter mobile start --clear`.
- **Metro no encuentra un módulo o muestra código viejo**: `pnpm --filter mobile start --clear`.
  Si persiste en el monorepo, borra `node_modules` y repite `pnpm install`.
- **"Project is incompatible with this version of Expo Go"**: actualiza Expo Go (la app usa el
  SDK 58). En el simulador, Expo lo actualiza al pulsar `i`.
