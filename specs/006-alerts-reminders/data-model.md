# Data Model: Alertas y recordatorios

Fase 1 de [plan.md](./plan.md). Una migración (`notifications`) con:

- cuatro tablas nuevas: `devices`, `notifications`, `notification_dispatches` y `push_tickets`;
- dos enums nuevos;
- una columna nueva en `recurring_payments`;
- las estructuras que calcula el dominio ([research.md](./research.md) R1, R2 y R6).

Las fechas de negocio son `DATE` en la zona del usuario; los instantes, `TIMESTAMPTZ`. Los montos
solo aparecen en los textos ya armados (principio IV).

## Device → `devices`

Destino de push de un usuario en una sesión (R4).

| Campo | Columna | Tipo | Regla |
| --- | --- | --- | --- |
| `id` | `id` | `UUID` | `gen_random_uuid()` |
| `userId` | `user_id` | `UUID` FK → `users` | `ON DELETE CASCADE` (borrar la cuenta quita sus dispositivos, FR-005) |
| `sessionId` | `session_id` | `UUID` | `sid` del JWT = `refresh_tokens.family_id`. Sin FK: las sesiones no tienen tabla |
| `token` | `token` | `VARCHAR(255)` **único** | `ExponentPushToken[...]` validado con `Expo.isExpoPushToken`. El upsert por token cambia `user_id` y `session_id` |
| `platform` | `platform` | enum `device_platform` (`ios`, `android`) | Informativo |
| `lastSeenAt` | `last_seen_at` | `TIMESTAMPTZ` | Hora del último `POST /devices` |
| `lastTestAt` | `last_test_at` | `TIMESTAMPTZ` null | Última prueba (límite de 30 s, R11) |
| `createdAt` | `created_at` | `TIMESTAMPTZ` | — |

Índices: `(user_id)` y `(session_id)`.

**Dispositivo activo** (el único que recibe push): existe un `refresh_tokens` con `family_id =
session_id`, `user_id = devices.user_id`, `rotated_at IS NULL`, `revoked_at IS NULL` y
`expires_at > now()`. Es la condición de `TokensService.findActiveSession`.

**Cuándo se borra un dispositivo**:
- `DELETE /devices/current` (permiso revocado);
- `revokeFamily` (cierre de sesión o reutilización de un token);
- `revokeAllForUser` (cambio o restablecimiento de contraseña);
- borrar la cuenta (cascada);
- un ticket o un receipt con `DeviceNotRegistered`;
- la limpieza del job, si la sesión ya no está activa.

## Notification → `notifications`

Una entrada del historial (R9).

| Campo | Columna | Tipo | Regla |
| --- | --- | --- | --- |
| `id` | `id` | `UUID` | `gen_random_uuid()` |
| `userId` | `user_id` | `UUID` FK → `users` | `ON DELETE CASCADE` |
| `kind` | `kind` | enum `notification_kind` | `budget_alert`, `cutoff_reminder`, `payment_reminder`, `recurring_reminder` (sin `daily_digest` ni prueba: no se guardan) |
| `title` | `title` | `VARCHAR(80)` | Nombre de la tarjeta o del pago (40 como máximo, specs 002 y 005) |
| `body` | `body` | `VARCHAR(300)` | Texto armado por el dominio ([contracts/push-messages.md](./contracts/push-messages.md)) |
| `targetType` | `target_type` | `VARCHAR(16)` | `card`, `statement` u `occurrence`; CHECK |
| `targetId` | `target_id` | `UUID` | Sin FK: lo avisado puede archivarse o borrarse (FR-022) |
| `createdAt` | `created_at` | `TIMESTAMPTZ` | Cuándo se generó; el historial muestra fecha y hora en la zona del usuario |

Índice: `(user_id, created_at DESC)`. Se borran después de 30 días (`HISTORY_DAYS`, FR-024).

## NotificationDispatch → `notification_dispatches`

La tabla de envíos: la clave que impide repetir (R6).

| Campo | Columna | Tipo | Regla |
| --- | --- | --- | --- |
| `id` | `id` | `UUID` | — |
| `userId` | `user_id` | `UUID` FK → `users` | `ON DELETE CASCADE` |
| `kind` | `kind` | enum `notification_kind` + `daily_digest` | Ver la tabla de abajo |
| `referenceId` | `reference_id` | `UUID` | Tarjeta, extracto, ocurrencia o usuario |
| `referenceDate` | `reference_date` | `DATE` | Fecha que identifica el aviso |
| `threshold` | `threshold` | `SMALLINT` null | 70, 90 o 100 solo en `budget_alert`; CHECK |
| `notificationId` | `notification_id` | `UUID` FK → `notifications` null | `ON DELETE SET NULL`; null en umbrales marcados sin alerta propia y en `daily_digest` |
| `createdAt` | `created_at` | `TIMESTAMPTZ` | — |

Clave única: `UNIQUE NULLS NOT DISTINCT (user_id, kind, reference_id, reference_date,
threshold)`. Se borran después de 90 días (`DISPATCH_RETENTION_DAYS`).

| `kind` | `reference_id` | `reference_date` | `threshold` |
| --- | --- | --- | --- |
| `budget_alert` | `cards.id` | corte del ciclo abierto | 70, 90, 100 |
| `cutoff_reminder` | `cards.id` | fecha de corte | null |
| `payment_reminder` | `statements.id` | fecha límite | null |
| `recurring_reminder` | `recurring_occurrences.id` | vencimiento | null |
| `daily_digest` | `users.id` | día local del envío | null |

`kind` usa el enum `notification_kind`, al que se agrega el valor `daily_digest`. Ese valor no se
admite en `notifications` (CHECK `kind <> 'daily_digest'`).

## PushTicket → `push_tickets`

Tickets de Expo pendientes de revisar su receipt (R8).

| Campo | Columna | Tipo | Regla |
| --- | --- | --- | --- |
| `id` | `id` | `VARCHAR(64)` | Id del ticket de Expo (`ticket.id`) |
| `token` | `token` | `VARCHAR(255)` | Token al que se envió; sin FK, el dispositivo puede no existir ya |
| `createdAt` | `created_at` | `TIMESTAMPTZ` | Se revisa después de 15 minutos |

Se borra al revisarse, o a las 24 horas aunque no se haya revisado.

## RecurringPayment (spec 005) → `recurring_payments` + `remind_days`

| Campo | Columna | Tipo | Regla |
| --- | --- | --- | --- |
| `remindDays` | `remind_days` | `SMALLINT` | `NOT NULL DEFAULT 2`, `CHECK (remind_days BETWEEN 0 AND 15)` (`validateReminderDays`, FR-016). Los pagos existentes toman 2 |

## Card (spec 002), sin cambios

`remind_cutoff_days` y `remind_due_days` (0–15, por defecto 2 y 3) ya existen. Una tarjeta
archivada (`archived_at`) no genera avisos.

## Estructuras del dominio (derivadas, no se guardan)

```text
BudgetAlertDecision  { alert: 70 | 90 | 100 | null, mark: number[] }

Reminder {
  kind: 'cutoff_reminder' | 'payment_reminder' | 'recurring_reminder'
  referenceId: string
  referenceDate: IsoDate        // corte, fecha límite o vencimiento
  title: string                 // nombre de la tarjeta o del pago
  body: string
  target: { type: 'card' | 'statement' | 'occurrence', id: string }
}

PushContent {
  title: string
  body: string
  target: Reminder['target'] | { type: 'history' }
}
```

## Ciclo de vida de un aviso

```text
alerta de tope   compra guardada ─commit─► budgetAlert(before, after, avisados)
                                              │ alert ≠ null
                                              ▼
                 tx: dispatches (todos los umbrales de `mark`) + notification (el de `alert`)
                                              │ solo lo insertado
                                              ▼
                 push a los dispositivos activos ─► tickets ─15 min─► receipts

recordatorios    job (cada 15 min) ─ hora local ≥ 07:00 ─► tx: dispatch daily_digest
                                              │ insertado (si existía: nada)
                                              ▼
                 materializar ocurrencias hasta hoy + 15 ─► remindersFor(hoy)
                                              ▼
                 dispatches + notifications de los nuevos ─commit─► dailyDigest ─► push
```
