# Contrato: comando de restablecimiento de contraseña

| | |
| --- | --- |
| Local | `pnpm --filter api admin:reset-password <email>` (usa el `dist` existente; no compila) |
| Servidor (contenedor) | `docker exec <contenedor-api> node dist/cli/reset-password.js <email>` |
| Entrada | Un argumento: el email (se normaliza: sin espacios externos, minúsculas) |
| Configuración | La misma del API (variables de entorno validadas); necesita `DATABASE_URL` |

**Uso local**: el comando ejecuta `apps/api/dist/cli/reset-password.js` tal como está, sin
compilar. Ese archivo lo generan `pnpm --filter api dev` (mientras corre) o
`pnpm --filter api build`. No compila a propósito: `nest build` vacía `dist` (`deleteOutDir`) y
tumbaría un `nest start --watch` que esté corriendo desde ahí. Si el archivo no existe, termina con
código 1 y muestra en stderr:

```text
No existe dist/cli/reset-password.js. Compila el API primero con "pnpm --filter api build"
(o deja corriendo "pnpm --filter api dev") y vuelve a ejecutar el comando.
```

**Salida si el usuario existe** (código de salida 0), en stdout:

```text
Contraseña restablecida para ana@ejemplo.com
Contraseña temporal (se muestra una sola vez): Xk7pQ2mZr9Lw4sTb
El usuario deberá cambiarla al iniciar sesión. Todas sus sesiones se cerraron.
```

**Efectos**: nuevo `password_hash` (de la temporal), `must_change_password = true`, todas las
familias de refresh tokens del usuario revocadas. La contraseña temporal no se guarda ni se
registra en ningún log.

**Si el email no existe** (código de salida 1), en stderr: `No existe una cuenta con el email
<email>`. No cambia nada.

**Errores** (código 1): sin argumento → muestra el uso; configuración inválida → mismo mensaje que
el API al arrancar.

**Contraseña temporal**: 16 caracteres alfanuméricos (`A–Z`, `a–z`, `2–9`, sin caracteres
ambiguos como `0`, `O`, `1`, `l`), generados con `crypto.randomInt` (FR-024).
