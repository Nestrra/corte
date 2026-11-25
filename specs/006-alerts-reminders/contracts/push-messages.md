# Contrato de mensajes push

Los textos los arma `packages/domain/src/notifications.ts` ([research.md](../research.md) R1).
El push y el historial usan el mismo título y el mismo texto. La spec los escribe como una sola
línea, "`<título>: <texto>`" con el texto empezando en minúscula; el push los separa en título y
texto.

Formatos:
- **Montos**: `formatCopText`, es decir, "$" + miles con punto, sin decimales ("$1.950.000").
- **Fechas**: `shortDateEs`, es decir, día + mes abreviado en minúscula ("8 dic").
- **Días**: `daysPhrase`, que da "hoy", "mañana" o "en N días".
- **Porcentajes**: entero redondeado hacia abajo (`budgetUsagePercent`).

## Alertas de tope (inmediatas)

| Umbral | Título | Texto |
| --- | --- | --- |
| 70 o 90 | `<tarjeta>` | `Llevas el <p>% del tope de este ciclo.` |
| 100 | `<tarjeta>` | `Superaste el tope de este ciclo (<p>%).` |

Ejemplos:
- de 65% a 95% → "Visa principal" / "Llevas el 95% del tope de este ciclo." (umbral 90);
- de 95% a 102% → "Visa principal" / "Superaste el tope de este ciclo (102%)."

Destino: `{ type: 'card', id: <tarjeta> }`.

## Recordatorios (a las 7:00 locales)

| Tipo | Título | Texto | Destino |
| --- | --- | --- | --- |
| Corte, N ≥ 2 | `<tarjeta>` | `El corte es en <N> días (<fecha>). Llevas <monto> en este ciclo.` | `card` |
| Corte, N = 1 | `<tarjeta>` | `El corte es mañana (<fecha>). Llevas <monto> en este ciclo.` | `card` |
| Corte, N = 0 | `<tarjeta>` | `El corte es hoy (<fecha>). Llevas <monto> en este ciclo.` | `card` |
| Pago | `<tarjeta>` | `Paga <monto> hasta el <fecha> (<faltan>).` | `statement` |
| Pago recurrente | `<pago>` | `<monto> vence <cuándo>.` | `occurrence` |

- `<faltan>` cuenta los días desde hoy hasta la fecha límite, así que sirve también cuando el
  recordatorio se movió al día siguiente al corte: "faltan 3 días", "falta 1 día" o "es hoy".
- `<cuándo>` en el pago recurrente: "el 28 dic (en 2 días)", "mañana (28 dic)" o "hoy (28 dic)".

Ejemplos de la spec:
- "Visa principal" / "El corte es en 2 días (8 dic). Llevas $1.900.000 en este ciclo."
- "Visa principal" / "Paga $1.950.000 hasta el 25 dic (faltan 3 días)."
- "Celular" / "$65.000 vence el 28 dic (en 2 días)."

## Push agrupado (2 o más recordatorios el mismo día)

- **Título**: `Tienes <n> recordatorios hoy`
- **Texto**: hasta 3 líneas `<título>: <texto>` en este orden: pagos de tarjeta, cortes y pagos
  recurrentes; dentro de cada grupo, por fecha y luego por nombre. Si hay más de 3, una última
  línea `y <k> más`.
- **Destino**: `{ type: 'history' }`.

No se guarda en el historial: cada recordatorio queda por separado.

## Prueba

- **Título**: `Corte`. **Texto**: `Las notificaciones funcionan.`
- **Destino**: ninguno (abre la app donde estaba). No se guarda.

## Mensaje de Expo

```json
{
  "to": "ExponentPushToken[...]",
  "title": "Visa principal",
  "body": "Llevas el 95% del tope de este ciclo.",
  "sound": "default",
  "channelId": "default",
  "data": {
    "notificationId": "8b3c…",
    "target": { "type": "card", "id": "1f0e…" }
  }
}
```

`data` nunca lleva el `userId` ni montos sueltos. Lo que viaja ya está en el título y el texto.
