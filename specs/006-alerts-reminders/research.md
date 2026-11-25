# Research: Alertas y recordatorios

Fase 0 de [plan.md](./plan.md). Parte de:

- las decisiones técnicas que el usuario dio en `/speckit-plan`, marcadas **(usuario)**;
- las 8 decisiones de producto que el usuario aceptó en la spec ("Assumptions");
- la constitución;
- el código de las specs 001 a 005 en `main` (`2884b99`).

## R1. Reglas de alertas y recordatorios en el dominio (FR-008 a FR-020, FR-026)

- **Decision**: `packages/domain/src/notifications.ts`, con funciones puras sin reloj: "hoy" y la
  hora local entran como parámetros.

  ```text
  BUDGET_THRESHOLDS = [70, 90, 100]
  budgetAlert(beforePercent, afterPercent, alreadyNotified: number[])
      → { alert: 70 | 90 | 100 | null, mark: number[] }
      // cruzados = umbrales t con before < t ≤ after que no están en alreadyNotified
      // alert = el mayor de los cruzados (o null); mark = todos los cruzados

  cutoffReminderDate(cutoffDate, days)            = cutoffDate − days
  paymentReminderDate(cutoffDate, dueDate, days)  = max(dueDate − days, cutoffDate + 1)
  recurringReminderDate(dueDate, days)            = dueDate − days

  remindersFor(today, { cards, statements, occurrences }) → Reminder[]
      cards:       activas, con { id, name, cutoffDay, dueDay, remindCutoffDays, openAmount }
                   // openAmount = "A pagar" del extracto del próximo corte
      statements:  no pagados, con corte < hoy, con { id, cardId, cardName, cutoffDate, dueDate,
                   total, remindDueDays }
      occurrences: no pagadas, con { id, name, dueDate, expectedAmount, remindDays }
      // corte: nextCutoff(today, card).cutoffDate − N = today y openAmount > 0
      // pago: paymentReminderDate(...) = today, total > 0 y today ≤ dueDate
      // recurrente: dueDate − N = today
      // Reminder = { kind, referenceId, referenceDate, title, body, target }

  dailyDigest(reminders) → PushContent | null
      // 0 → null; 1 → ese recordatorio; ≥ 2 → "Tienes <n> recordatorios hoy", con las 3
      //   primeras líneas "<título>: <texto>" y "y <k> más"; destino: historial
  budgetAlertContent(cardName, threshold, percent) → PushContent
  isDailyDispatchDue(localTime: 'HH:mm') → localTime ≥ '07:00'
  ```

  Funciones nuevas en `calendar.ts`:
  - `addDays(date, days)`, con cambio de mes y de año;
  - `maxIsoDate(a, b)`.

  Textos (FR-010, FR-028):
  - `formatCopText` agrupa los miles con punto sin usar `Intl`, para que el resultado no
    dependa del ICU del servidor;
  - `shortDateEs` da "8 dic";
  - `daysPhrase` da "hoy", "mañana" o "en 2 días".

  Los días de anticipación se validan con `validateReminderDays` (0–15), que ya existe en
  `card-rules.ts`. `DEFAULT_RECURRING_REMIND_DAYS = 2`.
- **Rationale**: los umbrales, las fechas y los montos de los avisos son reglas de negocio de la
  spec y de los criterios de aceptación, así que se prueban en el dominio (principio I). Un
  ejemplo: de 65% a 95% avisa una sola vez, la del 90%, y deja marcados 70 y 90. El API solo
  reúne datos, guarda y envía. Con los textos en el dominio, las e2e comparan cadenas exactas y
  el push y el historial dicen lo mismo.
- **Alternatives considered**:
  - Calcular las fechas en SQL: saca reglas del dominio y no sirve para la regla de "día
    siguiente al corte".
  - Armar los textos en la app: el push se arma en el servidor, así que habría dos lugares con
    el mismo texto.
  - Usar `Intl.NumberFormat` en el dominio: el resultado depende del ICU de cada entorno; la
    app lo sigue usando para mostrar montos (`formatCop`).

## R2. Agrupar umbrales: una alerta por compra **(decisión aceptada en la spec)**

- **Decision**: una compra o una edición genera como máximo una alerta, la del umbral más alto
  que cruzó. Todos los umbrales cruzados quedan registrados como avisados en ese ciclo. Una
  compra **cruza** un umbral si el uso antes está por debajo y después queda en el umbral o por
  encima. El uso se calcula con `budgetUsagePercent`, que redondea hacia abajo (spec 003).
- **Rationale**: es el criterio de la spec: con $1.300.000 de $2.000.000 (65%), una compra de
  $600.000 deja 95% y genera una sola alerta del 90%. Si el uso ya estaba sobre un umbral sin
  aviso (por ejemplo, porque se bajó el tope de la tarjeta), la siguiente compra no lo "cruza":
  FR-011 dice que editar el tope no genera alertas.
- **Alternatives considered**:
  - Un push por umbral: contradice el criterio de aceptación.
  - Avisar cualquier umbral no avisado que esté por debajo del uso nuevo: avisaría por cambios
    de tope, en contra de FR-011.

## R3. Momento de la alerta: después del commit y fuera de la respuesta **(usuario)**

- **Decision**: en `PurchasesService.create` y `update`, dentro de la transacción que ya
  bloquea la tarjeta (`lockOwnedCard`):
  1. se lee el "A pagar" del extracto del próximo corte antes de `writePlan` (`before`) y
     después (`after`), con `LedgerService.totalForCutoff(..., tx)`;
  2. la transacción devuelve
     `budgetChange = { userId, cardId, cardName, cutoffDate, cycleBudget, before, after }`.

  Después del commit, el servicio llama `alerts.onBudgetChange(budgetChange)` sin esperar el
  resultado. La llamada se registra en `BackgroundTasks`, que lleva la cuenta de las promesas
  pendientes, atrapa y registra los errores (`Logger.error`, sin token ni montos) y ofrece
  `drain()`.

  `onBudgetChange` hace esto:
  1. convierte los montos a porcentajes;
  2. lee los umbrales ya avisados del ciclo;
  3. llama a `budgetAlert`;
  4. en una transacción, inserta las claves de envío (R6) y la notificación del historial;
  5. envía el push (R8).

  Borrar compras no llama nada (FR-011).
- **Rationale**: el bloqueo de la tarjeta serializa las compras de una misma tarjeta, así que
  el `before` y el `after` leídos dentro de la transacción son exactos. Como todo lo demás pasa
  después del commit, la respuesta no espera a Expo y un fallo no deshace la compra (FR-012,
  SC-006). `drain()` permite que las e2e esperen a que terminen las alertas sin `sleep`, y el
  apagado ordenado (`enableShutdownHooks`) también lo usa.
- **Alternatives considered**:
  - Enviar dentro de la transacción: alarga el bloqueo de la tarjeta y una falla de Expo
    tumbaría la compra.
  - Recalcular `before` después del commit: ya no se puede saber cuánto había antes.
  - Una cola persistente (outbox): más piezas de las que necesita una sola instancia; si el
    proceso muere entre el commit y el envío se pierde un push, pero el siguiente cruce sigue
    funcionando. Se anota como mejora de la v2.

## R4. Dispositivos ligados a la sesión **(usuario)**

- **Decision**: tabla `devices` (detalle en [data-model.md](./data-model.md)):
  - `token` único (`ExponentPushToken[...]`, validado con `Expo.isExpoPushToken`);
  - `user_id` (FK `ON DELETE CASCADE`), `session_id` (el `sid` del JWT, que es el `family_id`
    de los refresh tokens) y `platform`;
  - `last_seen_at` y `last_test_at`.

  Operaciones:
  - `POST /devices` hace upsert por `token`: si el token ya existía (de otra sesión o de otro
    usuario), pasa al usuario y a la sesión del JWT. Es el cambio de usuario en el mismo
    teléfono (historia 9, escenario 4).
  - `DELETE /devices/current` borra los dispositivos de la sesión actual. La app lo llama
    cuando ve que el permiso del sistema se revocó (edge case).

  Las sesiones no tienen tabla propia, así que no hay FK a la sesión. Se cubre por dos lados:
  1. `TokensService.revokeFamily` y `revokeAllForUser` borran también los dispositivos de las
     sesiones que revocan. Esto cubre el cierre de sesión, la reutilización de un token, el
     cambio de contraseña (que conserva la sesión actual) y el restablecimiento por el
     administrador. Borrar la cuenta borra los dispositivos en cascada.
  2. Al enviar, solo se usan dispositivos cuya sesión sigue activa: existe un refresh token de
     esa familia sin `rotated_at` ni `revoked_at` y sin expirar, la misma condición que
     `findActiveSession`. Esto cubre las sesiones que expiran solas (30 días sin uso). La
     limpieza diaria (R7) borra esos dispositivos.
- **Rationale**: FR-005 pide que un dispositivo reciba solo mientras tenga una sesión válida. El
  `sid` ya está en cada request (`RequestUser.sessionId`). El token de Expo solo se puede obtener
  en el propio teléfono, así que tenerlo equivale a tener el dispositivo: el upsert no permite
  que otro usuario lea nada de A, y quitar o probar dispositivos solo actúa sobre la sesión del
  JWT (historia 10).
- **Alternatives considered**:
  - Crear una tabla `sessions` para poder usar una FK con cascada: es un refactor de la spec
    001 fuera de alcance.
  - Que la app borre su token al cerrar sesión: no cubre las sesiones revocadas ni el cierre
    de sesión sin conexión.

## R5. Envío con `expo-server-sdk` detrás de una interfaz inyectable **(usuario)**

- **Decision**: `PushClient` es una interfaz propia con un token de inyección `PUSH_CLIENT`:

  ```text
  send(messages: PushMessage[]) → PushTicket[]   // un ticket por mensaje, en el mismo orden
  receipts(ids: string[]) → Map<id, PushReceipt>
  ```

  - **Producción**: `ExpoPushClient` usa `expo-server-sdk` (v8, ESM):
    `chunkPushNotifications` / `sendPushNotificationsAsync`, y
    `chunkPushNotificationReceiptIds` / `getPushNotificationReceiptsAsync`. El SDK reintenta
    solo ante HTTP 429. `accessToken` sale de `EXPO_ACCESS_TOKEN`, opcional; solo hace falta si
    se activa la seguridad reforzada de push en Expo.
  - **E2e**: `FakePushClient` (en `test/`) guarda los mensajes y deja programar tickets y
    receipts con error.

  Mensaje: `{ to, title, body, sound: 'default', channelId: 'default', data }`. `data` lleva el
  destino (R10) y nunca el `userId`.
- **Rationale**: las e2e prueban qué se envía y a quién sin red ni cuenta de Expo (pedido del
  usuario). La constitución fija Expo Push. El API ya consume paquetes ESM (NestJS 12) desde su
  salida CommonJS en Node 24, así que el SDK entra igual.
- **Alternatives considered**: llamar al endpoint HTTP de Expo con `fetch`. Implica reescribir
  el troceo de mensajes, los reintentos ante 429 y la validación de tokens que el SDK ya trae.

## R6. Idempotencia: tabla de envíos con clave única **(usuario)**

- **Decision**: tabla `notification_dispatches` con
  `UNIQUE NULLS NOT DISTINCT (user_id, kind, reference_id, reference_date, threshold)`.

  | `kind` | `reference_id` | `reference_date` | `threshold` |
  | --- | --- | --- | --- |
  | `budget_alert` | tarjeta | corte del ciclo | 70, 90 o 100 |
  | `cutoff_reminder` | tarjeta | fecha de corte | — |
  | `payment_reminder` | extracto | fecha límite | — |
  | `recurring_reminder` | ocurrencia | fecha de vencimiento | — |
  | `daily_digest` | usuario | día local del envío | — |

  Insertar la clave con `ON CONFLICT DO NOTHING` (`createMany skipDuplicates`) es el candado:
  solo se notifica lo que se insertó en esa llamada. La fila guarda `notification_id` (FK
  `ON DELETE SET NULL`). Los umbrales marcados sin alerta propia quedan con `null`.
- **Rationale**:
  - El recordatorio de corte se identifica por la fecha de corte, no por la fecha en que se
    envía. Así, cambiar los días de anticipación no lo repite (historia 5, escenario 5), y
    cambiar la fecha del corte crea otro (edge case).
  - Las claves viven más que el historial: se borran a los 90 días (R7), más que cualquier
    ciclo y cualquier anticipación, así que borrar el historial a los 30 días no permite
    repetir un aviso.
  - Las fechas van en `DATE` (principio IV), no dentro de un texto.
- **Alternatives considered**:
  - Usar la propia tabla `notifications` como candado: los umbrales marcados sin alerta
    necesitarían notificaciones fantasma y su vida útil (30 días) sería la del candado.
  - Una clave de texto libre: mezcla fechas y umbrales en un `VARCHAR`.

## R7. Job cada 15 minutos con `@nestjs/schedule` **(usuario)**

- **Decision**: `NotificationsJobs` corre con `@Cron('0 */15 * * * *')` y llama `runOnce()`.
  Un candado en memoria (`running`) evita que dos ejecuciones se pisen si una tarda más de 15
  minutos. `runOnce()` hace cuatro cosas:

  1. **Recordatorios diarios**: lee todos los usuarios con su zona horaria, calcula con el
     `Clock` su fecha y su hora local (`localDateTimeIn(timezone, now)`, junto a
     `todayInTimeZone`) y se queda con los que cumplen `isDailyDispatchDue`. Por cada uno, en
     su propia transacción:
     1. inserta la clave `daily_digest` del día local; si ya existe, sigue con el siguiente
        usuario;
     2. materializa las ocurrencias de sus pagos recurrentes hasta hoy + 15 días, reutilizando
        `RecurringService.materializeThrough` (spec 005 R4);
     3. reúne tarjetas activas, extractos y ocurrencias, y llama `remindersFor`;
     4. inserta las claves y las notificaciones de los recordatorios nuevos.

     Después del commit envía `dailyDigest(...)` (R8).
  2. **Receipts**: revisa los tickets con más de 15 minutos sin revisar, borra los
     dispositivos con `DeviceNotRegistered` y borra los tickets revisados o con más de 24 horas
     (Expo guarda los receipts un día).
  3. **Limpieza**: borra las notificaciones de más de 30 días, las claves de envío de más de 90
     días y los dispositivos cuya sesión ya no está activa.
  4. **Errores**: cada paso y cada usuario atrapan sus errores y los registran; uno que falla
     no detiene a los demás.

  El cron solo se registra si `JOBS_ENABLED=true` (por defecto `true`). Las e2e lo ponen en
  `false` y llaman `runOnce()` directamente con un reloj mutable. El API debe correr como **una
  sola instancia**: los candados en memoria y los límites de intentos de la spec 001 ya lo
  exigen. Se documenta en el README.
- **Rationale**:
  - Correr cada 15 minutos cubre todas las zonas horarias, incluidas las de media hora; en la
    práctica un recordatorio llega entre las 7:00 y las 7:15 (SC-002).
  - Si el servidor estuvo caído, la primera ejecución del día después de las 7:00 envía ese
    mismo día (FR-017).
  - `remindersFor` solo devuelve recordatorios con fecha igual a hoy, así que nunca se envían
    los de días pasados (FR-020).
  - La clave `daily_digest` garantiza un solo push agrupado por día (FR-018, SC-004). Si el
    proceso se cae después del commit y antes de enviar, ese día no se reintenta: se prefiere
    no repetir a arriesgar un duplicado.
- **Alternatives considered**:
  - Un cron por zona horaria: complejo y frágil.
  - Calcular las 7:00 locales de cada usuario y programar un temporizador: se pierde al
    reiniciar.
  - Un worker o contenedor aparte: más infraestructura (principio VI); queda como v2 si hiciera
    falta escalar a varias instancias.

## R8. Envío y tickets

- **Decision**: `PushSender.sendToUser(userId, content)` resuelve los dispositivos activos del
  usuario (R4) y llama `PushClient.send`. Con cada ticket:
  - `ok` → se guarda en `push_tickets` para revisar el receipt;
  - error `DeviceNotRegistered` → se borra el dispositivo enseguida (FR-007);
  - otro error → se registra en el log.

  Sin dispositivos no se envía nada, pero la notificación ya está en el historial (FR-024).
  `sendToSession(sessionId, content)` sirve para la prueba (R11).
- **Rationale**: Expo informa algunos errores en el ticket y otros en el receipt. Revisar los dos
  cumple FR-007 sin esperar al receipt cuando el error es inmediato.
- **Alternatives considered**: no revisar receipts. Así no se detectan las desinstalaciones que
  Expo solo informa después.

## R9. Historial **(usuario)**

- **Decision**: tabla `notifications` con `user_id`, `kind`, `title`, `body`, `target_type`
  (`card`, `statement`, `occurrence`; null para el push agrupado), `target_id` (sin FK: lo
  avisado puede desaparecer) y `created_at`.

  `GET /notifications` devuelve las del usuario de los últimos 30 días, de la más reciente a la
  más antigua, como máximo 200. Los datos se borran en el job (R7). El push agrupado no se
  guarda: cada recordatorio queda por separado. La prueba tampoco se guarda (FR-025).
- **Rationale**: el historial lee de la misma tabla sin importar si el push salió, así que
  funciona sin permiso (historia 7, escenario 3). El tope de 200 mantiene la respuesta acotada;
  un usuario normal genera pocas decenas al mes.
- **Alternatives considered**: guardar el historial en el teléfono. Se pierde al reinstalar y
  no incluye lo que se generó sin permiso.

## R10. Destino al tocar

- **Decision**: el `data` del push lleva `{ notificationId?, target: { type, id } | { type:
  'history' } }`. La app traduce el destino a una ruta:

  | Destino | Ruta |
  | --- | --- |
  | `card` | `card/[id]` |
  | `statement` | `statement/[id]` |
  | `occurrence` | `occurrence/[id]` |
  | `history` | `notifications` |

  Antes de navegar, la app pide el recurso (`GET /cards/:id`, `/statements/:id` u
  `/occurrences/:id`). Si responde 404 (ya no existe, está archivado o es de otro usuario),
  abre `notifications` con el aviso "Esto ya no está disponible" (FR-022). Sin sesión,
  `Stack.Protected` manda al login y el destino se descarta.

  Lo que escucha la app:
  - `Notifications.addNotificationResponseReceivedListener` para la app abierta o en segundo
    plano;
  - `getLastNotificationResponseAsync` al arrancar, para la app cerrada;
  - `addNotificationReceivedListener` para refrescar `['notifications']` cuando llega un push
    con la app abierta.
- **Rationale**: la respuesta 404 del API ya es igual para lo inexistente y lo ajeno (principio
  III), así que la app no necesita saber de quién era la notificación y el push no lleva el
  `userId`.
- **Alternatives considered**:
  - Deep links con URL (`corte://...`): agregan un esquema público que cualquiera puede abrir,
    sin ganar nada.
  - Navegar sin comprobar el recurso: la pantalla destino mostraría un error genérico.

## R11. Notificación de prueba **(usuario)**

- **Decision**: `POST /notifications/test` envía "Corte" / "Las notificaciones funcionan." solo
  a los dispositivos de la sesión del JWT. Responde:

  | Caso | Respuesta |
  | --- | --- |
  | Enviada | 202 `{ sent: n }` |
  | La sesión no tiene dispositivo | 409 `DEVICE_NOT_REGISTERED` |
  | Hubo una prueba hace menos de 30 s | 429 `TEST_RATE_LIMITED` con `retryAfterSeconds` (desde `devices.last_test_at`, con el `Clock`) |
  | Expo rechaza el envío | 502 `PUSH_FAILED` |

  No se guarda en el historial.
- **Rationale**: guardar el límite en la fila del dispositivo lo hace persistente y
  comprobable en las e2e con el reloj fijo. Responder 409 permite a Perfil explicar cómo
  activar las notificaciones.
- **Alternatives considered**: `@nestjs/throttler` por IP, que no es "por dispositivo" y se
  reinicia con el proceso.

## R12. Pagos recurrentes: días de anticipación (FR-016)

- **Decision**: columna `recurring_payments.remind_days SMALLINT NOT NULL DEFAULT 2` con
  `CHECK (remind_days BETWEEN 0 AND 15)`; los pagos existentes toman 2.
  - API: `remindDays` opcional en `POST /recurring` y `PATCH /recurring/:id`, validado con
    `validateReminderDays`; se devuelve en `RecurringPayment`.
  - App: campo "Recordar con anticipación" en `RecurringForm`, igual que "Recordar corte" en
    `CardForm`, y el valor en el detalle ("2 días antes").
- **Rationale**: reutiliza la regla y el rango de las tarjetas (spec 002). Editar los días no
  toca las ocurrencias.
- **Alternatives considered**: guardar los días por ocurrencia. No hace falta, porque la regla
  es del pago.

## R13. App: permiso, registro y explicación previa **(usuario)**

- **Decision**: módulo `src/notifications/` con cuatro piezas.
  - **`permission.ts`**:
    - estado (`granted`, `denied`, `undetermined`, `unavailable`) con
      `Notifications.getPermissionsAsync`;
    - pedir el permiso con `requestPermissionsAsync`;
    - abrir los ajustes con `Linking.openSettings()`;
    - en Android, crear el canal `default` (importancia alta) antes de pedir el permiso.
  - **`registration.ts`**:
    - obtiene el token con `getExpoPushTokenAsync({ projectId })`; el `projectId` sale de
      `Constants.expoConfig.extra.eas.projectId`, que ya existe;
    - con el permiso concedido y sesión iniciada, lo envía a `POST /devices` cada vez que la
      app inicia sesión, abre o vuelve al frente, y cuando cambia el token
      (`addPushTokenListener`);
    - si `getExpoPushTokenAsync` falla en un dispositivo sin push (simulador), el estado queda
      `unavailable`;
    - al ver el permiso revocado, llama `DELETE /devices/current`.
  - **Explicación previa**: pantalla `notifications-intro`. Se muestra una vez por dispositivo:
    la marca `notificationsIntroSeen` se guarda en `expo-secure-store`, que ya se usa para la
    sesión, y es independiente del usuario. Aparece al iniciar sesión, al crear la cuenta o al
    abrir con una sesión existente (historia 1, escenario 8). Sus botones: "Activar
    notificaciones" (pide el permiso) y "Ahora no".
  - **`setNotificationHandler`**: muestra los push también con la app abierta (banner y
    sonido).

  Perfil muestra la fila "Notificaciones" con el estado y su acción, y el botón "Enviar
  notificación de prueba" con 30 segundos de espera. El estado se relee al volver a la app
  (`use-refetch-on-app-active`).
- **Rationale**: todo se hace con paquetes que la app ya tiene (`expo-notifications`,
  `expo-constants`, `expo-linking`, `expo-secure-store`). Detectar el simulador por el error del
  token evita agregar `expo-device`.
- **Alternatives considered**:
  - Usar `expo-device` para `isDevice`: es una dependencia nueva para un caso que el error ya
    resuelve.
  - Pedir el permiso apenas se abre la app: va contra FR-001.

## R14. Cambio nativo y versión de runtime

- **Decision**: el plugin `expo-notifications` se configura con el ícono monocromo de Android
  (`./assets/android-icon-monochrome.png`) y el color `primary`. Es un cambio nativo, así que
  `version` sube de `0.0.0` a `0.1.0` (regla de "Versión de runtime" del README) y hace falta
  un development build nuevo. Los push remotos se prueban en ese build, no en Expo Go.
- **Rationale**: sin ícono propio, Android muestra un cuadro blanco en la barra de estado.
- **Alternatives considered**: dejar el ícono por defecto, que se ve como un error.

## R15. Pruebas (principio II, FR-026, FR-027) **(usuario)**

- **Decision**:
  - **Dominio** (`notifications.test.ts`, `calendar.test.ts`):
    - umbrales: 65 → 95, 50 → 110, exactamente 70, ya avisados y uso que baja y vuelve a
      subir;
    - fechas: 8 dic − 2 → 6 dic, N = 0, corte el 31 en febrero de 2027, 1 ene − 2 → 30 dic y
      el ajuste al día siguiente al corte (corte el 20, límite el 22, N = 3 → 21);
    - exclusiones: extracto pagado, $0, vencido;
    - textos exactos, push agrupado con más de 3 recordatorios y `isDailyDispatchDue` en 06:59
      y 07:00.
  - **E2e** contra PostgreSQL real, con `FakePushClient` (`overrideProvider(PUSH_CLIENT)`),
    `JOBS_ENABLED=false` y un reloj mutable (`createTestApp(..., { clock })`):
    - `devices.e2e-spec.ts`: registrar, validar, upsert entre usuarios, `DELETE
      /devices/current`, y cerrar sesión, cambiar o restablecer la contraseña y borrar la
      cuenta quitan el destino;
    - `budget-alerts.e2e-spec.ts`: el criterio de la spec, una edición que cruza, borrar sin
      alerta, una vez por ciclo, el ciclo siguiente, Expo caído (201 igual) y sin dispositivos
      (historial);
    - `reminders.e2e-spec.ts`: 6 dic a las 6:59 y a las 7:00 en Bogotá, el 7 nada, dos
      ejecuciones y un solo push, Madrid, agrupado, extracto pagado, ajuste al día siguiente
      al corte, $0, tarjeta archivada, recurrente pausado y eliminado, un mes que no se abrió
      y el día pasado que no se envía;
    - `push-receipts.e2e-spec.ts`: `DeviceNotRegistered` en el ticket y en el receipt, y la
      limpieza;
    - `notifications.e2e-spec.ts`: historial de 30 días, límite de 200, prueba solo a la
      sesión, 429, 409 y 502;
    - `notifications-isolation.e2e-spec.ts`: dos usuarios en todos los endpoints nuevos y en el
      envío.
  - **App**: a mano con [quickstart.md](./quickstart.md) B9, en un development build.
- **Rationale**: el cliente falso y el reloj mutable hacen deterministas las pruebas de horas y
  de envío, como pidió el usuario.

## R16. Dependencias nuevas **(usuario; CLAUDE.md del usuario: avisar por qué)**

| Paquete | Dónde | Por qué |
| --- | --- | --- |
| `expo-server-sdk` ^8 | `apps/api` | Cliente oficial de Expo Push: troceo, reintentos ante 429, receipts y validación de tokens (R5) |
| `@nestjs/schedule` ^12 | `apps/api` | Cron del job cada 15 minutos dentro del API, compatible con NestJS 12 (R7) |

La app no agrega dependencias: `expo-notifications`, `expo-constants`, `expo-linking` y
`expo-secure-store` ya están instaladas. Las dos son ESM, como NestJS 12, y piden Node ≥ 22.12
(el proyecto usa Node 24).

## R17. Variables de entorno nuevas (principio VII)

| Variable | Obligatoria | Por defecto | Uso |
| --- | --- | --- | --- |
| `JOBS_ENABLED` | No | `true` | `false` desactiva el cron (e2e, consolas de administración) |
| `EXPO_ACCESS_TOKEN` | No | — | Token de Expo para el envío si se activa la seguridad reforzada de push; es un secreto y nunca se registra en logs |

Se validan en `env.schema.ts` y se documentan en el README y en
`specs/000-project-skeleton/contracts/environment.md`. La misma imagen corre en staging y en
producción.

## R18. Ajustes a la spec detectados al planificar

- **Edge case "compra que pasa a otra tarjeta"**: `PATCH /purchases/:id` no permite cambiar la
  tarjeta (spec 003), así que el caso no existe. Se reescribe como "edición que mueve cuotas
  fuera del ciclo abierto".
- **Historia 10, escenario 3**: con el upsert por token (R4), registrar un token es el cambio de
  usuario en el teléfono (historia 9, escenario 4). Ese token solo se obtiene en el dispositivo.
  El escenario se limita a quitar dispositivos y enviar la prueba, que solo actúan sobre la
  sesión del JWT.
