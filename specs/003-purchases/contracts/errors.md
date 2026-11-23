# Contrato de errores: compras y extractos

Mismo cuerpo que la spec 001 (`{ statusCode, code, message, errors? }`, ver
`specs/001-auth/contracts/errors.md`) y los códigos de tarjetas de
`specs/002-cards/contracts/errors.md`. Códigos nuevos o usados de forma nueva:

| HTTP | `code` | Cuándo | Texto en la app |
| --- | --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Cuerpo inválido | Mensaje por campo (abajo) |
| 404 | `NOT_FOUND` | Tarjeta, compra o extracto inexistente, de otro usuario o con id que no es UUID (mismo cuerpo) | "No encontramos esa compra" / "No encontramos ese extracto" / "No encontramos esa tarjeta" |
| 409 | `CARD_ARCHIVED` | Registrar, editar o borrar una compra de una tarjeta archivada | "Restaura la tarjeta para cambiar sus compras" |
| 409 | `STATEMENT_OPEN` | Marcar pagado un extracto Abierto | "Este extracto aún no corta; podrás pagarlo después del corte" |

Mensajes por campo (`VALIDATION_ERROR`):

| `field` / `code` | Texto |
| --- | --- |
| `amount` / `OUT_OF_RANGE` | "Escribe un valor mayor que 0" |
| `concept` / `REQUIRED`, `TOO_LONG` | "Escribe un concepto" / "Máximo 60 caracteres" |
| `purchaseDate` / `INVALID` | "Elige una fecha válida" |
| `purchaseDate` / `IN_FUTURE` | "La fecha no puede ser posterior a hoy" |
| `purchaseDate` / `TOO_OLD` | "La fecha no puede ser de hace más de 6 años" |
| `installmentCount` / `OUT_OF_RANGE` | "Elige de 1 a 72 cuotas" |
| `annualRate` / `OUT_OF_RANGE` | "Escribe una tasa entre 0 y 100" (formulario de tarjeta) |
| `annualRate` / `TOO_MANY_DECIMALS` | "Máximo 2 decimales" (formulario de tarjeta) |
| `noInterest` / `INVALID` | (solo depuración: no es booleano) |
| cualquier campo obligatorio ausente / `REQUIRED` | El texto del campo; la app valida antes de enviar |
| `(body)` / `REQUIRED` | (solo depuración: `PATCH` sin campos) |
| cualquier campo / `UNKNOWN_FIELD` | (solo depuración: campo no permitido) |

El aviso de cupo (FR-012) no es un error del API: lo muestra la app antes de enviar
([screens.md](./screens.md)).
