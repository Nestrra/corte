# Data Model: Esqueleto del proyecto Corte

Esta spec **no crea tablas ni migraciones**: el schema de Prisma no tiene modelos. Las únicas
"entidades" son estructuras en memoria y de configuración.

## HealthReport (respuesta de `GET /api/v1/health`, no se persiste)

| Campo | Tipo | Valores | Regla |
| --- | --- | --- | --- |
| `status` | string (enum) | `ok` \| `degraded` | `ok` si `database = up`; `degraded` en otro caso |
| `version` | string | SHA del commit o `unknown` | Valor de `GIT_SHA`; `unknown` si está ausente o vacío |
| `database` | string (enum) | `up` \| `down` | `up` si el ping a la base responde en ≤ 2000 ms |

**Transiciones** (por solicitud, sin estado guardado):

```text
ping a la base OK en ≤ 2 s        → status=ok,       database=up,   HTTP 200
ping falla, rechaza o pasa de 2 s → status=degraded, database=down, HTTP 503
```

Contrato formal: [contracts/health.openapi.yaml](./contracts/health.openapi.yaml).

## EnvironmentConfig (API)

Se valida con zod al arrancar; si es inválida, el proceso termina con código distinto de cero y
nombra las variables con problema. Definición completa en
[contracts/environment.md](./contracts/environment.md).

| Campo | Tipo | Obligatoria | Por defecto |
| --- | --- | --- | --- |
| `DATABASE_URL` | URL `postgresql://` o `postgres://` | Sí | — |
| `APP_ENV` | `development` \| `test` \| `staging` \| `production` | Sí | — |
| `PORT` | entero 1–65535 | No | `3000` |
| `GIT_SHA` | string opcional; vacío o ausente → `unknown` | No | `unknown` |
| `SWAGGER_ENABLED` | booleano (`true`/`false`) | No | `false` |

Regla cruzada: `SWAGGER_ENABLED=true` con `APP_ENV=production` → inválido.

## MobileConfig (app)

| Campo | Tipo | Obligatoria | Comportamiento si falta |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | URL `http(s)://`; se normaliza quitando la `/` final | Sí | "Sin conexión" + aviso de configuración |

## ConnectionStatus (estado de la pantalla temporal, derivado)

```text
loading      → "Comprobando conexión…"
HealthReport válido (200 o 503) → "Conectado"
error de red / timeout 5 s / respuesta inválida / URL faltante → "Sin conexión"
```

Detalle de la UI en [contracts/health-screen.md](./contracts/health-screen.md).

## Theme tokens (app)

Fuente única: `docs/design-system.md` (colores, tipografía, espaciado y radios). El tema de
`apps/mobile/src/theme` copia esos valores exactos; no se redefinen aquí para no duplicarlos.
