# Quickstart / Guía de validación: spec 001

Cómo comprobar de punta a punta la autenticación. Contratos en [contracts/](./contracts/), modelo
en [data-model.md](./data-model.md).

## Preparación

```bash
pnpm install
pnpm db:up
cp apps/api/.env.example apps/api/.env     # incluye JWT_SECRET de desarrollo
pnpm --filter api db:migrate               # crea users y refresh_tokens en corte_dev
pnpm --filter api dev                      # terminal 1
```

Variables útiles para los ejemplos:

```bash
API=http://localhost:3000/api/v1
```

## A1. Registro (US1)

```bash
curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ana","email":" Ana@Ejemplo.com ","password":"clave-segura-1"}'
```

**Esperado**: 201 con `accessToken`, `refreshToken` y `user` (`email: "ana@ejemplo.com"`,
`timezone: "America/Bogota"`, `mustChangePassword: false`). Repetir con `ANA@ejemplo.com` → 409
`EMAIL_TAKEN`. Contraseña de 7 caracteres → 400 `VALIDATION_ERROR` en `password`.

## A2. Login y mensaje genérico (US2)

- Login correcto → 200.
- Email inexistente y contraseña equivocada → ambos 401 `INVALID_CREDENTIALS` con el mismo cuerpo.
- 6 intentos fallidos seguidos con el mismo email → el 6.º (aun con la contraseña correcta) → 429
  `RATE_LIMITED`.

## A3. Renovación, reutilización y cierre de sesión (US2, US3)

1. `POST /auth/refresh` con el refresh token → 200 con un par nuevo.
2. Repetir con el refresh token **anterior** → 401 `SESSION_REVOKED`; el par nuevo del paso 1
   también deja de servir (familia revocada).
3. Iniciar sesión de nuevo, `POST /auth/logout` con el access token → 204; el mismo access token en
   `GET /me` → 401 `SESSION_REVOKED`; su refresh token → 401.

## A4. Perfil y zona horaria (US4)

- `GET /me` → perfil. `PATCH /me {"timezone":"America/Mexico_City"}` → 200. `{"timezone":"Marte/Base"}`
  → 400 `VALIDATION_ERROR`.

## A5. Cambio voluntario de contraseña (US6)

- Con dos sesiones del mismo usuario (dos logins), `POST /auth/change-password` en la primera con
  `currentPassword` correcta → 200. La primera sigue funcionando; la segunda → 401
  `SESSION_REVOKED`. La contraseña anterior ya no inicia sesión. `currentPassword` incorrecta →
  401 `INVALID_PASSWORD`.

## A6. Restablecimiento por el administrador (US7)

```bash
pnpm --filter api admin:reset-password ana@ejemplo.com
```

**Esperado**: imprime la contraseña temporal una vez. Las sesiones de Ana dejan de servir. Login
con la temporal → 200 con `mustChangePassword: true`; `PATCH /me` → 403
`PASSWORD_CHANGE_REQUIRED`; `POST /auth/change-password` con solo `newPassword` → 200; después
`PATCH /me` funciona. Email inexistente → código de salida 1 y mensaje en stderr.

## A7. Eliminación de la cuenta (US5)

- `DELETE /me {"password":"incorrecta"}` → 401 `INVALID_PASSWORD`, nada se borra.
- `DELETE /me` con la contraseña correcta → 204; login → 401 `INVALID_CREDENTIALS`; registrarse otra
  vez con el mismo email → 201.

## A8. Pruebas automáticas

```bash
pnpm --filter @corte/domain test                 # reglas de cuenta
pnpm --filter api test                           # unitarias
pnpm --filter api test:e2e                       # e2e (aplica migraciones a corte_test)
```

**Esperado**: todo en verde, incluido `isolation.e2e-spec.ts` (dos usuarios: ninguno lee ni
modifica al otro; cerrar sesión, cambiar contraseña o eliminar la cuenta de uno no afecta al otro;
un JWT con `sub` alterado se rechaza).

## A9. App (iOS y Android, Expo Go)

`EXPO_PUBLIC_API_URL` como en la spec 000. `pnpm --filter mobile start`.

1. Sin sesión → pantalla de inicio de sesión. "Crear cuenta" → registro → inicio "Hola, {nombre}".
2. Cerrar la app por completo y abrirla → sigue en el inicio (SC-002).
3. Perfil → Zona horaria → elegir otra → se muestra en el perfil y se conserva al reabrir.
4. Perfil → Cambiar contraseña (modo voluntario) → funciona y la sesión sigue.
5. Perfil → Cerrar sesión → inicio de sesión; reabrir la app no entra sola.
6. Con sesión abierta, ejecutar `admin:reset-password` para ese email y tocar cualquier acción →
   vuelve al inicio de sesión con el email escrito y el aviso. Entrar con la temporal → solo se
   ve "Cambiar contraseña" (modo obligatorio) hasta guardarla.
7. Perfil → Eliminar cuenta → advertencia → contraseña → vuelve al inicio de sesión; esa cuenta ya
   no entra.
8. Con el API detenido, abrir la app con sesión guardada → "Sin conexión con el servidor" +
   "Reintentar"; al levantar el API y reintentar → entra sin pedir credenciales.

## A10. Imagen y migraciones

```bash
docker build -f apps/api/Dockerfile --target migrate -t corte-api-migrate .
docker run --rm -e DATABASE_URL=postgresql://corte:corte@host.docker.internal:5434/corte_dev corte-api-migrate
docker build -f apps/api/Dockerfile -t corte-api .        # imagen del API, sigue < 300 MB
docker exec <contenedor> node dist/cli/reset-password.js ana@ejemplo.com
```
