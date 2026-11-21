# Contrato de variables de entorno

Principio VII: la misma imagen y el mismo código corren en cualquier entorno; solo cambian estas
variables. Ningún valor real se versiona; los `.env.example` solo traen valores locales de ejemplo.

## API (`apps/api`, contenedor)

| Variable | Obligatoria | Por defecto | Validación | Ejemplo local |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Sí | — | URL que empieza por `postgresql://` o `postgres://` | `postgresql://corte:corte@localhost:5434/corte_dev` |
| `APP_ENV` | Sí | — | `development` \| `test` \| `staging` \| `production` | `development` |
| `PORT` | No | `3000` | entero 1–65535 | `3000` |
| `GIT_SHA` | No | `unknown` | string no vacío | (vacío en local) |
| `SWAGGER_ENABLED` | No | `false` | `true` \| `false`; prohibido `true` si `APP_ENV=production` | `true` |

- Si la validación falla, el proceso termina con código ≠ 0 y un mensaje que lista cada variable
  inválida (sin imprimir sus valores, para no filtrar secretos).
- En la imagen, `GIT_SHA` entra como build arg (`--build-arg GIT_SHA=<sha>`) y queda como valor
  por defecto de la variable; `docker run -e GIT_SHA=...` lo sobrescribe.
- `NODE_ENV=production` lo fija la imagen; no se usa para decidir comportamiento de negocio
  (para eso está `APP_ENV`).
- Swagger, cuando está habilitado, se sirve en `/api/docs`.

## Pruebas e2e (local y CI)

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | `postgresql://corte:corte@localhost:5434/corte_test` (local) o el puerto del service container (CI) |
| `APP_ENV` | `test` |

## App móvil (`apps/mobile`)

| Variable | Obligatoria | Ejemplos |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Sí | Simulador iOS: `http://localhost:3000` · Emulador Android: `http://10.0.2.2:3000` · Dispositivo físico: `http://<IP-del-Mac>:3000` |

- Se lee en tiempo de build/arranque de Metro; tras cambiarla hay que reiniciar Metro.
- Las variables `EXPO_PUBLIC_*` quedan embebidas en el bundle: nunca deben contener secretos.
