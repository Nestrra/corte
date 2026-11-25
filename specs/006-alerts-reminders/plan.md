# Implementation Plan: Alertas y recordatorios

**Branch**: `006-alerts-reminders` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-alerts-reminders/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Alertas de tope inmediatas, recordatorios diarios de corte, pago y pagos recurrentes, historial
de notificaciones y gestión de dispositivos (HU-06 y reglas "Cupo, tope y alertas" 3 y 5 de
`docs/mvp-spec.md`, más los recordatorios pendientes de la spec 005).

- **Dominio**: `packages/domain` gana `notifications.ts`, con funciones puras:
  - umbrales cruzados con una alerta por compra (`budgetAlert`);
  - fechas de recordatorio, incluido el ajuste al día siguiente al corte;
  - `remindersFor(hoy, …)`;
  - el push agrupado (`dailyDigest`);
  - textos y formatos (`formatCopText`, `shortDateEs`).

  `calendar.ts` suma `addDays`.
- **Base de datos**: una migración con cuatro tablas:
  - `devices`, ligada al usuario y a la sesión (`sid`);
  - `notifications` (historial de 30 días);
  - `notification_dispatches`, con clave única por usuario, tipo, referencia, fecha y umbral: el
    candado que impide repetir;
  - `push_tickets`.

  Además, la columna `recurring_payments.remind_days` (0–15, por defecto 2).
- **API**:
  - `POST /devices` (upsert por token), `DELETE /devices/current`, `GET /notifications` y `POST
    /notifications/test`;
  - las alertas se deciden después del commit de la compra y se envían en segundo plano
    (`BackgroundTasks`): un fallo nunca afecta la respuesta;
  - un job de `@nestjs/schedule` cada 15 minutos envía los recordatorios de quien ya pasó las
    7:00 locales (una vez por día), revisa los receipts y limpia;
  - el envío usa `expo-server-sdk` detrás de la interfaz `PushClient`, que las e2e reemplazan por
    un cliente falso;
  - revocar sesiones quita sus dispositivos.
- **App**:
  - explicación previa al permiso, una vez por dispositivo;
  - registro del token de Expo con el `projectId` de EAS;
  - listener que navega al destino comprobando que existe;
  - historial desde la campana del inicio;
  - estado del permiso y botón de prueba en Perfil;
  - campo de anticipación en el formulario de pagos recurrentes;
  - configuración del plugin `expo-notifications` (cambio nativo: `version` 0.1.0).

Dos dependencias nuevas en el API (`expo-server-sdk`, `@nestjs/schedule`) y ninguna en la app
(R16). Detalle en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict) sobre Node.js 24; Expo SDK 58 (React Native 0.88,
Hermes).

**Primary Dependencies**:
- **Nuevas en el API**:
  - `expo-server-sdk` ^8: envío, troceo, reintentos ante 429 y receipts (R5);
  - `@nestjs/schedule` ^12: cron (R7).
- **Ya instaladas**: NestJS 12, Prisma 7.10.1, zod, `expo-notifications` ~58.1, `expo-constants`,
  `expo-linking`, `expo-secure-store`, expo-router, TanStack Query y `@expo/vector-icons`.

**Storage**: PostgreSQL 17. Una migración nueva (`notifications`), detallada en
[data-model.md](./data-model.md):
- enums `device_platform` y `notification_kind`;
- tablas `devices`, `notifications`, `notification_dispatches` (`UNIQUE NULLS NOT DISTINCT`) y
  `push_tickets`;
- `recurring_payments.remind_days` con CHECK.

**Testing**:
- **Dominio**: Vitest con umbrales (65 → 95, 50 → 110, exactamente 70, ya avisados), fechas (N =
  0, día 31 en febrero, cambio de año, ajuste al día siguiente al corte), exclusiones y textos
  exactos. Umbral de cobertura 95%.
- **API**: Jest e2e contra PostgreSQL real con `FakePushClient`, `JOBS_ENABLED=false` y un reloj
  mutable; se llama `runOnce()` directamente. Suites:
  - dispositivos y sesiones;
  - alertas de tope (criterio de la spec, ciclos, fallos de Expo);
  - recordatorios (6:59 frente a 7:00, no repetición, zonas, agrupado);
  - receipts;
  - historial y prueba;
  - aislamiento con dos usuarios.
- **App**: a mano con [quickstart.md](./quickstart.md) B9, en un development build nuevo.

**Target Platform**: API en contenedor Linux (`node:24-alpine`), **una sola instancia** (R7).
App en development builds de EAS para iOS y Android: los push remotos no funcionan en Expo Go.

**Project Type**: monorepo móvil + API.

**Performance Goals**:
- Una alerta llega en menos de 1 minuto (SC-005): se envía apenas termina la transacción, sin
  cola.
- El job recorre los usuarios cada 15 minutos. A la escala del MVP (una familia) son pocas filas;
  cada usuario se procesa en su propia transacción y con un número fijo de consultas (tarjetas,
  extractos, ocurrencias).
- `GET /notifications` usa el índice `(user_id, created_at DESC)` con tope de 200.

**Constraints**:
- Nunca repetir un aviso: lo garantiza la clave única de `notification_dispatches` en la base,
  no solo la lógica (FR-009, FR-019).
- La compra nunca falla por el envío (FR-012).
- Solo dispositivos con sesión activa (FR-005).
- "Hoy" y la hora local se calculan con el `Clock` en la zona del usuario.
- El `data` del push no lleva el `userId`.
- Los secretos (`EXPO_ACCESS_TOKEN`) solo vienen del entorno y no se registran en logs.

**Scale/Scope**:
- **API**: 4 tablas, 1 columna, 1 migración, 4 endpoints nuevos, 2 endpoints de `/recurring`
  ampliados y 1 job con 3 tareas.
- **Dominio**: ~12 funciones puras.
- **App**: 2 pantallas nuevas (explicación e historial), Perfil, el inicio y RecurringForm
  ampliados, 4 componentes nuevos y 1 módulo `notifications/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo se cumple en esta spec | Estado |
| --- | --- | --- |
| I. Dominio puro | Umbrales cruzados, fechas de recordatorio (con el ajuste al día siguiente al corte), qué recordatorios tocan hoy, agrupado, textos y montos en `packages/domain/src/notifications.ts`, sin reloj ni I/O: "hoy" y la hora local entran como parámetros. El API reúne datos, guarda claves y envía; la app solo muestra. | ✅ |
| II. Pruebas primero | Pruebas del dominio con los criterios de la spec (65 → 95 → alerta del 90; corte 8 − 2 = 6; extracto pagado sin recordatorio) y los bordes (N = 0, día 31 en febrero, cambio de año) antes de implementar. E2e de cada endpoint y del job contra PostgreSQL real. | ✅ |
| III. Aislamiento | Dispositivos ligados a `sub` y `sid` del token; historial por `user_id`; la prueba y `DELETE /devices/current` solo actúan sobre la sesión del token; los avisos se generan con datos de un solo usuario y se envían solo a sus dispositivos activos; el push no lleva el `userId` y los destinos ajenos responden 404. `notifications-isolation.e2e-spec.ts` con dos usuarios. **Excepción justificada** (Complexity Tracking): `POST /devices` con un token que ya era de otro usuario reasigna esa fila. | ✅ con excepción |
| IV. Dinero y fechas | Montos `BIGINT` leídos del ledger y formateados como enteros; `reference_date` como `DATE`; "hoy" y la hora local en la zona del usuario. Las alertas usan el "A pagar" con intereses estimados de la spec 003, sin presentar intereses nuevos. | ✅ |
| V. Seguridad | Todas las rutas nuevas con el guard global y la contraseña temporal. `EXPO_ACCESS_TOKEN` solo del entorno. Los tokens de push no se registran en logs. La prueba tiene límite de intentos (1 cada 30 s). Revocar sesiones quita sus destinos. | ✅ |
| VI. Simplicidad | Solo lo de la spec: sin preferencias por tipo, horario configurable, correo, SMS, contador de no leídas ni cola persistente (v2). Job dentro del API, sin worker aparte. Dos dependencias justificadas (R16). | ✅ |
| VII. Configuración por entorno | `JOBS_ENABLED` (por defecto `true`) y `EXPO_ACCESS_TOKEN` (opcional) validadas en `env.schema.ts`. La misma imagen en staging y producción; ningún condicional por entorno salvo esas variables. | ✅ |
| VIII. Convenciones | Tablas, columnas, enums (`budget_alert`, `cutoff_reminder`…), rutas y códigos (`DEVICE_NOT_REGISTERED`, `TEST_RATE_LIMITED`, `PUSH_FAILED`) en inglés; textos de los push y de la app en español. | ✅ |
| IX. Sistema de diseño | NotificationRow, BellButton, PermissionIntro y NotificationStatusRow con tokens existentes; estados escritos ("Activadas", "Desactivadas", "Sin activar"); pares de contraste ya medidos (`warning` sobre `surface` 5,43); áreas de 44 o más; lectura accesible de cada fila. Los componentes nuevos se documentan en `docs/design-system.md`. | ✅ |

**Resultado (pre-Phase 0)**: PASA. Después de `/speckit-analyze` queda una excepción justificada
al principio III (Complexity Tracking).
**Re-evaluación (post-Phase 1)**: PASA.
- El contrato ([contracts/notifications.openapi.yaml](./contracts/notifications.openapi.yaml)) no
  recibe ids de usuario ni de sesión.
- El modelo guarda las fechas de referencia en `DATE` y la idempotencia en una clave única de la
  base.
- Hay dos dependencias nuevas, pedidas por el usuario y justificadas en R16.
- La reasignación de un token entre usuarios es una excepción al principio III, justificada en
  Complexity Tracking y cubierta por una prueba (T052). Salió de `/speckit-analyze` (C1).
- El requisito de una sola instancia ya existía (límites de intentos de la spec 001) y se
  documenta en el README.

## Project Structure

### Documentation (this feature)

```text
specs/006-alerts-reminders/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── notifications.openapi.yaml  # /devices, /devices/current, /notifications, /notifications/test, /recurring + remindDays
│   ├── push-messages.md            # títulos, textos, agrupado, data del push
│   └── screens.md                  # explicación, historial, Perfil, campana, RecurringForm
├── checklists/requirements.md
└── tasks.md                        # /speckit-tasks
```

### Source Code (repository root)

```text
packages/domain/src/
├── notifications.ts            # budgetAlert, fechas de recordatorio, remindersFor, dailyDigest, textos, isDailyDispatchDue
├── notifications.test.ts
├── calendar.ts                 # + addDays, maxIsoDate
├── calendar.test.ts            # + addDays
└── index.ts                    # + export

apps/api/
├── package.json                # + expo-server-sdk, @nestjs/schedule
├── prisma/schema.prisma        # + DevicePlatform, NotificationKind, Device, Notification, NotificationDispatch, PushTicket; RecurringPayment.remindDays
├── prisma/migrations/<ts>_notifications/migration.sql   # + CHECKs y UNIQUE NULLS NOT DISTINCT a mano
├── src/app.module.ts           # + NotificationsModule; ScheduleModule.forRoot() si JOBS_ENABLED
├── src/main.ts                 # + enableShutdownHooks (drena BackgroundTasks)
├── src/config/env.schema.ts    # + JOBS_ENABLED, EXPO_ACCESS_TOKEN
├── src/common/errors.ts        # + DEVICE_NOT_REGISTERED, TEST_RATE_LIMITED, PUSH_FAILED, INVALID_PUSH_TOKEN
├── src/common/today.ts         # + localDateTimeIn(timezone, now) → { date, time }
├── src/common/background-tasks.ts   # track(promise), drain(); registra errores
├── src/auth/tokens.service.ts  # revokeFamily / revokeAllForUser también borran devices
├── src/purchases/purchases.service.ts  # before/after del extracto abierto en la tx → alerts.onBudgetChange tras el commit
├── src/recurring/              # remindDays en schemas, mapper y servicio; materializeThrough expuesto al job
├── src/notifications/
│   ├── notifications.module.ts
│   ├── push-client.ts          # interfaz PushClient + token PUSH_CLIENT
│   ├── expo-push-client.ts     # implementación con expo-server-sdk
│   ├── push-sender.ts          # dispositivos activos, envío, tickets, DeviceNotRegistered
│   ├── devices.controller.ts   # POST /devices, DELETE /devices/current
│   ├── devices.service.ts
│   ├── notifications.controller.ts  # GET /notifications, POST /notifications/test
│   ├── notifications.service.ts     # historial, prueba
│   ├── budget-alerts.service.ts     # onBudgetChange (R3)
│   ├── reminders.service.ts         # por usuario: daily_digest, materializar, remindersFor, guardar, enviar
│   ├── notifications.jobs.ts        # @Cron cada 15 min → runOnce(): recordatorios, receipts, limpieza
│   └── notifications.schemas.ts
└── test/
    ├── helpers.ts                   # + reloj mutable, FakePushClient, JOBS_ENABLED=false, drain()
    ├── fake-push-client.ts
    ├── devices.e2e-spec.ts
    ├── budget-alerts.e2e-spec.ts
    ├── reminders.e2e-spec.ts
    ├── push-receipts.e2e-spec.ts
    ├── notifications.e2e-spec.ts
    ├── notifications-isolation.e2e-spec.ts
    └── recurring.e2e-spec.ts        # + remindDays

apps/mobile/
├── app.config.ts               # version 0.1.0; plugin expo-notifications con icon y color (R14)
└── src/
    ├── notifications/
    │   ├── permission.ts       # estado, pedir, abrir ajustes, canal de Android
    │   ├── registration.ts     # token de Expo → POST /devices; listener de cambio; DELETE al revocar
    │   ├── navigation.ts       # data del push → ruta, comprobando el recurso (R10)
    │   ├── intro-flag.ts       # notificationsIntroSeen en secure-store
    │   └── use-notifications.ts  # handler en primer plano, listeners, respuesta al arrancar
    ├── api/notifications.ts    # devices, history, test; notificationKeys
    ├── api/recurring.ts        # + remindDays
    ├── app/_layout.tsx         # + setNotificationHandler y listeners (useNotifications)
    ├── app/(app)/_layout.tsx   # + notifications-intro (modal), notifications; redirección a la explicación
    ├── app/(app)/notifications-intro.tsx
    ├── app/(app)/notifications.tsx
    ├── app/(app)/(tabs)/home.tsx    # + BellButton
    ├── app/(app)/(tabs)/profile.tsx # + NotificationStatusRow y botón de prueba
    ├── components/
    │   ├── NotificationRow.tsx
    │   ├── BellButton.tsx
    │   ├── PermissionIntro.tsx
    │   ├── NotificationStatusRow.tsx
    │   └── RecurringForm.tsx   # + "Recordar con anticipación"
    └── features/
        ├── recurring-schema.ts # + remindDays (validateReminderDays)
        └── dates.ts            # + "Hoy, 7:00" / "Ayer, 15:42" / "23 nov, 7:00"

docs/design-system.md           # NotificationRow, BellButton, PermissionIntro, NotificationStatusRow
docs/mvp-spec.md                # modelo de datos (devices, notifications, notification_dispatches, push_tickets) y tabla del API; 006 cerrada al final
README.md                       # variables JOBS_ENABLED y EXPO_ACCESS_TOKEN, una sola instancia, job y receipts
specs/000-project-skeleton/contracts/environment.md   # + variables nuevas
```

**Structure Decision**: misma estructura de monorepo.
- **Dominio**: agrega `notifications.ts`.
- **API**: crea el módulo `notifications`, que concentra dispositivos, historial, alertas, job y
  envío.
  - Lo importa `PurchasesModule` (alertas).
  - Usa `RecurringService` y `LedgerService` para reunir los datos.
  - `TokensService` borra los dispositivos con Prisma, igual que hace con los refresh tokens, sin
    depender de `NotificationsModule`. Así no hay ciclo entre módulos.
- **App**: concentra permiso, registro y navegación en `src/notifications/`; las pantallas solo
  los usan.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principio III: `POST /devices` reasigna al usuario B la fila de un token de push que era del usuario A (research.md R4) | El token de Expo identifica el teléfono, no un dato de A. Solo se obtiene en el propio dispositivo, así que quien lo envía tiene el teléfono en la mano. Es el cambio de usuario en el mismo teléfono (spec historia 9, escenario 4) y también cubre una sesión de A que expiró sin cerrarse. B no lee nada de A: la respuesta es 204 sin cuerpo y los demás dispositivos y datos de A no cambian. Lo prueba T052 | Rechazar con 409 si el token es de otro usuario con sesión activa deja sin push a B en un teléfono reinstalado o heredado cuando la sesión vieja de A sigue viva en el servidor, y B no tiene forma de liberarlo. Crear una fila nueva por usuario sin reasignar enviaría los avisos de A y de B al mismo teléfono, una fuga peor |
