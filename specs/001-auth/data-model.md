# Data Model: Autenticación de Corte

Primeras tablas del proyecto (Prisma 7 + PostgreSQL 17). Visión de conjunto en
`docs/mvp-spec.md` → "Modelo de datos"; aquí está lo que define la spec 001.

## User → tabla `users`

| Campo | Tipo (PostgreSQL) | Reglas |
| --- | --- | --- |
| `id` | `uuid`, PK | Generado por la base (`gen_random_uuid()`) |
| `name` | `varchar(80)` | Obligatorio; se guarda sin espacios externos; 1–80 caracteres (FR-002) |
| `email` | `varchar(254)`, **único** | Obligatorio; se guarda sin espacios externos y en minúsculas, así que la unicidad no distingue mayúsculas (FR-003); formato de email válido; máximo 254 caracteres (lo valida el dominio). La migración agrega `CHECK (email = lower(email))` para que la base rechace emails sin normalizar |
| `password_hash` | `text` | Hash argon2id en formato PHC; nunca texto plano (FR-032). La contraseña original tiene 8–128 caracteres (FR-004) |
| `timezone` | `varchar(64)` | Obligatorio; por defecto `America/Bogota`; identificador IANA válido o `UTC` (FR-019) |
| `must_change_password` | `boolean` | Por defecto `false`; `true` tras un restablecimiento del administrador hasta que el usuario cambie la contraseña (FR-026) |
| `created_at` | `timestamptz` | Por defecto `now()` |
| `updated_at` | `timestamptz` | Se actualiza en cada cambio |

Las reglas de longitud y normalización viven en `packages/domain/src/account-rules.ts` y las usan
API y app.

**Borrado**: eliminar un `User` borra en cascada sus `refresh_tokens` y, en specs futuras, todas
las tablas que dependan de `users` (FR-021). Tras borrar, el email queda libre (FR-022).

## RefreshToken → tabla `refresh_tokens`

Cada fila es un refresh token emitido. Los tokens de una misma **familia** (`family_id`) forman una
sesión: el primero se crea al registrarse o iniciar sesión y cada renovación agrega el siguiente.

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `id` | `uuid`, PK | |
| `user_id` | `uuid`, FK → `users.id` | `ON DELETE CASCADE`; índice |
| `family_id` | `uuid` | Igual para todos los tokens de la sesión; es el claim `sid` del access token; índice |
| `token_hash` | `char(64)`, **único** | SHA-256 en hex del token opaco; el token en claro nunca se guarda |
| `expires_at` | `timestamptz` | `created_at + 30 días` (FR-009) |
| `rotated_at` | `timestamptz`, nulo | Momento en que se usó para renovar; ya no sirve |
| `revoked_at` | `timestamptz`, nulo | Momento en que se revocó (cierre de sesión, reutilización, cambio o restablecimiento de contraseña) |
| `created_at` | `timestamptz` | Por defecto `now()` |

**Sesión activa** (la consulta del guard): existe un token con `family_id = sid`,
`user_id = sub`, `rotated_at IS NULL`, `revoked_at IS NULL` y `expires_at > now()`.

**Estados de un token**:

```text
activo ──(refresh)──▶ rotado            (se crea el siguiente de la familia)
activo ──(logout / cambio / reset)──▶ revocado
rotado ──(se presenta otra vez)──▶ reutilización ⇒ revocar toda la familia (FR-010)
activo ──(pasan 30 días sin renovar)──▶ expirado
```

## Intentos fallidos (en memoria, no persistido)

`LoginAttemptsService` guarda por email normalizado: lista de momentos de los fallos de los
últimos 15 min y `lockedUntil`. 5 fallos → bloqueo de 15 min; un login correcto reinicia el
contador. El límite por IP lo lleva `@nestjs/throttler` también en memoria. Ver
[research.md](./research.md) R4 (limitación de una sola instancia).

## Access token (no persistido)

JWT HS256, 15 min. Claims: `sub` (`users.id`), `sid` (`refresh_tokens.family_id`), `iat`, `exp`.
