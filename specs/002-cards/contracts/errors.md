# Contrato de errores: tarjetas

Mismo cuerpo que la spec 001 (`{ statusCode, code, message, errors? }`, ver
`specs/001-auth/contracts/errors.md`). Códigos nuevos o usados de forma nueva:

| HTTP | `code` | Cuándo | Texto en la app |
| --- | --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Cuerpo o query inválidos | Mensaje por campo (abajo) |
| 404 | `NOT_FOUND` | Tarjeta inexistente, de otro usuario o id que no es UUID (mismo cuerpo en los tres casos) | "No encontramos esa tarjeta" |
| 409 | `CARD_ARCHIVED` | `PATCH` sobre una tarjeta archivada | "Restaura la tarjeta para editarla" |

Mensajes por campo (`VALIDATION_ERROR`):

| `field` / `code` | Texto |
| --- | --- |
| `name` / `REQUIRED`, `TOO_LONG` | "Escribe un nombre" / "Máximo 40 caracteres" |
| `color` / `INVALID` | "Elige un color" |
| `last4` / `INVALID_FORMAT` | "Deben ser 4 dígitos" |
| `cutoffDay`, `dueDay` / `OUT_OF_RANGE` | "Elige un día del 1 al 31" |
| `creditLimit` / `OUT_OF_RANGE` | "Escribe un cupo mayor que 0" |
| `cycleBudget` / `OUT_OF_RANGE` | "Escribe un tope mayor que 0" |
| `cycleBudget` / `EXCEEDS_CREDIT_LIMIT` | "El tope no puede superar el cupo" (solo se compara si ambos montos son válidos) |
| `remindCutoffDays`, `remindDueDays` / `OUT_OF_RANGE` | "Entre 0 y 15 días" |
| cualquier campo obligatorio ausente / `REQUIRED` | El texto del campo (por ejemplo "Escribe un nombre"); la app valida antes de enviar |
| `(body)` / `REQUIRED` | (solo depuración: `PATCH` sin campos) |
| `archived` / `INVALID` | (solo depuración: query `archived` distinta de `true` o `false`) |
| cualquier campo / `UNKNOWN_FIELD` | (solo depuración: campo no permitido) |
