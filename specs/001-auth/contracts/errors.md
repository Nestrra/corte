# Contrato de errores

Todas las respuestas de error del API tienen la forma:

```json
{ "statusCode": 401, "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" }
```

En 400 de validación se añade `errors: [{ "field": "password", "code": "TOO_SHORT" }]`.
`message` es para depuración (inglés); la app muestra el texto en español de esta tabla según `code`.

| HTTP | `code` | Cuándo | Texto en la app |
| --- | --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Cuerpo inválido (formato de email, longitudes, zona horaria) | Mensaje por campo (ver abajo) |
| 401 | `INVALID_CREDENTIALS` | Login con email inexistente o contraseña equivocada | "Email o contraseña incorrectos" |
| 401 | `TOKEN_EXPIRED` | Access token vencido o inválido (la app renueva y reintenta) | — (no se muestra) |
| 401 | `SESSION_EXPIRED` | Refresh token inexistente o vencido | "Tu sesión expiró. Inicia sesión de nuevo." |
| 401 | `SESSION_REVOKED` | Sesión cerrada, revocada o reutilización detectada | "Tu sesión se cerró. Inicia sesión de nuevo." |
| 401 | `INVALID_PASSWORD` | Contraseña actual incorrecta al eliminar la cuenta o cambiar la contraseña | "La contraseña no es correcta" |
| 403 | `PASSWORD_CHANGE_REQUIRED` | Acción con una contraseña temporal sin cambiar | — (la app muestra la pantalla de cambio) |
| 409 | `EMAIL_TAKEN` | Registro con un email que ya tiene cuenta | "Ya existe una cuenta con ese email" |
| 409 | `SAME_PASSWORD` | La contraseña nueva es igual a la actual o a la temporal | "La contraseña nueva debe ser distinta de la actual" |
| 429 | `RATE_LIMITED` | Límite de intentos por IP o bloqueo por email | "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." |

Mensajes por campo (`VALIDATION_ERROR`):

| `field` / `code` | Texto |
| --- | --- |
| `name` / `REQUIRED`, `TOO_LONG` | "Escribe tu nombre" / "Máximo 80 caracteres" |
| `email` / `INVALID_FORMAT` | "Escribe un email válido" |
| `password`, `newPassword` / `TOO_SHORT`, `TOO_LONG` | "Mínimo 8 caracteres" / "Máximo 128 caracteres" |
| `timezone` / `INVALID_TIMEZONE` | "Zona horaria no válida" |

Errores de red en la app (sin respuesta del API): "No hay conexión con el servidor. Revisa tu
conexión e inténtalo de nuevo."
