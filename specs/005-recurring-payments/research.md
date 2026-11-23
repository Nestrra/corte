# Research: Pagos recurrentes

Fase 0 de [plan.md](./plan.md). Parte de las decisiones técnicas que el usuario dio en
`/speckit-plan`, de la tabla del API de `docs/mvp-spec.md`, de la constitución y del código de las
specs 001 a 004 en `main` (`fb887fe`). Las decisiones del usuario se marcan **(usuario)**.

## R1. Calendario de vencimientos en el dominio (FR-002, FR-003, FR-022) **(usuario)**

- **Decision**: `packages/domain/src/recurring.ts` con funciones puras, sin reloj ("hoy" entra
  como parámetro):

  ```text
  type RecurringFrequency = 'monthly' | 'annual'
  type PeriodKey = string                       // 'YYYY-MM' (mensual) | 'YYYY' (anual)

  periodOf(date, frequency) → PeriodKey
  dueDateFor({ anchorDate, frequency }, period) → IsoDate
      // mensual: clampedDate(año, mes del periodo, día del ancla)
      // anual:   clampedDate(año del periodo, mes del ancla, día del ancla)
  nextDueOnOrAfter({ anchorDate, frequency }, date) → IsoDate
  duePeriods(schedule, from, to) → [{ period, dueDate }]     // orden ascendente
      schedule = { anchorDate, frequency, startsOn, pausedOn: IsoDate | null, deleted: boolean }
      // vencimientos con from ≤ dueDate ≤ to y dueDate ≥ startsOn;
      // si pausedOn: solo periodos ≤ periodOf(pausedOn); si deleted: ninguno
  ```

  El día se toma siempre del ancla, no del vencimiento anterior: 31 ene → 28 feb → 31 mar
  (`clampedDate`, ya usado por los ciclos de la spec 002). En anual, el 29 de febrero cae el 28 en
  años no bisiestos y vuelve al 29 en los bisiestos.
- **Rationale**: calcular un periodo directamente desde el ancla (en vez de sumar un mes al
  vencimiento anterior) evita la deriva 31 → 28 → 28 y permite pedir cualquier mes sin recorrer
  los anteriores. `duePeriods` concentra en una sola función las reglas de pausa, reanudación
  (`startsOn`) y eliminación, así el API no las repite.
- **Alternatives considered**: sumar periodos al vencimiento anterior (deriva en meses cortos);
  una regla tipo RRULE (librería nueva y más frecuencias de las que pide el MVP).

## R2. Estados, totales y validaciones en el dominio (FR-001, FR-008, FR-012, FR-022)

- **Decision**: en el mismo archivo:

  ```text
  occurrenceStatus({ dueDate, paidAt }, today) → 'paid' | 'overdue' | 'pending'
  summarizeMonth(items, today) → { totals: { total, paid, remaining }, items (ordenados) }
      // paid = Σ paidAmount de las pagadas; remaining = Σ expectedAmount de las no pagadas;
      // total = paid + remaining; orden: overdue, pending, paid; dentro por dueDate y nombre
  nextDueDate(schedule, today, paidPeriods) → IsoDate | null
      // primer vencimiento ≥ max(today, startsOn) cuyo periodo no está pagado; null si pausado
  monthBounds(today, earliestDueDate | null) → { first: 'YYYY-MM', last: 'YYYY-MM' }
      // first = mes del vencimiento más antiguo (o el actual, si es posterior o no hay);
      // last = mes actual + 12
  validateRecurringName  (= reglas del nombre de tarjeta: 1–40 sin espacios sobrantes)
  validateFirstDueDate(date, today)  → 'TOO_OLD' | 'TOO_FAR' | null   // [1.º del mes actual, hoy + 12 meses]
  validateNextDueDate(date, today)   → 'IN_PAST' | 'TOO_FAR' | null   // [hoy, hoy + 12 meses]
  ```

  Los montos usan `validateAmount` y `MAX_AMOUNT_COP` de la spec 002. "Hoy + 12 meses" usa
  `addMonths` + `clampedDate` (23 nov 2026 → 23 nov 2027).
- **Rationale**: los totales y el orden son reglas de negocio de la spec (FR-012) y el criterio de
  $1.480.000 / $1.295.000 / $185.000 se prueba en el dominio; el API y la app solo muestran.
- **Alternatives considered**: totales en SQL (rápido, pero saca la regla del dominio, principio
  I); ordenar en la app (dos lugares con la misma regla: inicio y pestaña).

## R3. Tablas `recurring_payments` y `recurring_occurrences` **(usuario)**

- **Decision**: dos tablas nuevas (detalle en [data-model.md](./data-model.md)):
  - `recurring_payments`: `user_id`, `name`, `amount`, `frequency` (enum), `first_due_date`
    (inmutable, para el límite de navegación), `anchor_date` (de dónde salen día y mes),
    `starts_on` (primer vencimiento que puede generar ocurrencias), `paused_on` (fecha de la
    pausa, null si está activo) y `deleted_at` (borrado lógico).
  - `recurring_occurrences`: `recurring_payment_id`, `period` (`VARCHAR(7)`: `YYYY-MM` o
    `YYYY`), `due_date`, `expected_amount`, `paid_at`, `paid_amount`, con
    `UNIQUE (recurring_payment_id, period)`.

  El periodo es texto para que un periodo mensual (`2027-01`) y uno anual (`2027`) nunca se
  confundan si el pago cambia de frecuencia.
- **Rationale**: la clave única garantiza "una ocurrencia por pago y periodo" (FR-003) en la base,
  no solo en el código. El borrado lógico conserva el nombre y el dueño de las ocurrencias pagadas
  de un pago eliminado sin copiar datos en cada ocurrencia (FR-007); el nombre nuevo de un pago
  editado se ve en todas sus ocurrencias por el join (FR-004).
- **Alternatives considered**: periodo como `DATE` del primer día (choca enero mensual con el año
  anual); borrar el pago y dejar `recurring_payment_id` en null con una copia de `name` y
  `user_id` en la ocurrencia (duplica datos y el aislamiento pasa por dos caminos); guardar en el
  pago una lista de intervalos activos (más estado del necesario, ver R5).

## R4. Ocurrencias materializadas bajo demanda (FR-003, FR-012, FR-014) **(usuario)**

- **Decision**: no hay cron. Al pedir un mes (`GET /recurring/occurrences?month=` o `GET
  /summary` para el mes actual), en una transacción:
  1. `SELECT id FROM recurring_payments WHERE user_id = $1 AND deleted_at IS NULL ORDER BY id FOR
     UPDATE` (bloquea los pagos del usuario en un orden fijo, sin interbloqueos).
  2. Para cada pago, `duePeriods(schedule, primer día del mes, último día del mes)`.
  3. `createMany({ skipDuplicates: true })` de las ocurrencias que falten, con el monto actual del
     pago como `expected_amount`.
  4. Lee las ocurrencias del mes (incluidas las de pagos pausados y las pagadas de eliminados) con
     el nombre del pago.

  El estado (Vencido, Pendiente) se deriva con `occurrenceStatus` y el "hoy" del `Clock` en la zona
  del usuario (`LedgerService.todayFor`); no se guarda.
- **Rationale**: materializar solo lo que se mira deja la tabla pequeña y no depende de un job.
  El bloqueo serializa la materialización con las ediciones (R5): sin él, una lectura podía leer
  el monto viejo, una edición borrar las futuras y la lectura reinsertarlas con el monto viejo.
  `skipDuplicates` (`ON CONFLICT DO NOTHING`) más la clave única evita duplicados aun con dos
  lecturas simultáneas.
- **Consecuencia**: `GET /summary` deja de ser de solo lectura (spec 004 R4): ahora puede insertar
  ocurrencias del mes actual. Sigue con un número fijo de consultas.
- **Alternatives considered**: cron diario que genera el mes siguiente (otra pieza que operar y
  meses futuros vacíos en la navegación); calcular ocurrencias sin guardarlas y guardar solo las
  pagadas (el estado de "pendientes existentes al pausar" y "vencidas que no cambian al editar"
  exigiría recalcular la historia de cada edición).

## R5. Congelar la historia antes de cambiar las reglas (FR-004 a FR-006)

- **Decision**: editar, pausar y reanudar empiezan con `materializeThrough(tx, payment, today)`:
  materializa con las reglas vigentes todos los periodos desde `starts_on` hasta el que contiene
  hoy (acotado: `first_due_date` nunca es anterior al mes de creación). Después cambian el pago:
  - **Editar** (`PATCH`): borra las ocurrencias no pagadas con `due_date ≥ hoy`; aplica nombre y
    monto; si llega `nextDueDate`, `anchor_date = starts_on = nextDueDate` (y la frecuencia
    nueva, si llega). Las futuras se regeneran al mirarlas, con los datos nuevos; un periodo que
    ya tiene una ocurrencia (pagada, o vencida del mes actual) no recibe otra por la clave única.
    Cambiar la frecuencia exige `nextDueDate` y que sea posterior al último vencimiento pagado del
    pago (`nextDueDate: BEFORE_LAST_PAID`), para no repetir un mes ya pagado con el calendario
    nuevo.
  - **Pausar**: `paused_on = hoy`. `duePeriods` sigue generando hasta el periodo de la pausa
    (incluido) y nada después: la ocurrencia del periodo actual se conserva aunque aún no venza.
  - **Reanudar**: `starts_on = nextDueOnOrAfter(ancla, hoy)`, `paused_on = null`. Los periodos
    entre la pausa y ese vencimiento quedan sin ocurrencia y no aparece nada Vencido por reanudar
    (decisión del usuario en la spec, FR-006).
- **Rationale**: como las ocurrencias son perezosas, un mes pasado que nadie miró todavía no
  existe; sin congelarlo, cambiar `starts_on` o el monto reescribiría la historia. Con esto los
  meses pasados quedan como eran, sin guardar intervalos de actividad.
- **Alternatives considered**: guardar el historial de pausas (más columnas o tabla); prohibir
  cambiar la frecuencia (la spec lo permite, FR-004).

## R6. Eliminar con borrado lógico (FR-007)

- **Decision**: `DELETE /recurring/:id` en una transacción: bloquea el pago, borra sus ocurrencias
  no pagadas (también las vencidas) y pone `deleted_at`. Los listados de pagos excluyen los
  eliminados; las ocurrencias pagadas siguen apareciendo en su mes y cuentan en sus totales. Un
  pago eliminado responde 404 en `GET/PATCH/DELETE /recurring/:id` y en pausar/reanudar.
- **Rationale**: una sola ruta de código (siempre lógico) y el historial sigue unido a su pago.
- **Alternatives considered**: borrado físico cuando no hay pagadas (dos caminos para el mismo
  caso de uso).

## R7. Marcar pagado y deshacer (FR-009, FR-010)

- **Decision**: `POST /occurrences/:id/payment` con cuerpo opcional `{ amount }` (1..máximo; por
  defecto `expected_amount`); guarda `paid_at = hoy` y `paid_amount`. Si ya estaba pagada responde
  la ocurrencia sin cambios (idempotente, como los extractos de la spec 003). `DELETE` la devuelve
  a no pagada; si el pago fue eliminado responde `409 RECURRING_DELETED`. Ambas bloquean el pago
  padre (`FOR UPDATE`) para no cruzarse con una edición. Se puede pagar cualquier ocurrencia no
  pagada, también de meses futuros.
- **Rationale**: misma forma y semántica que `POST/DELETE /statements/:id/payment`.
- **Alternatives considered**: `PATCH /occurrences/:id` con `paidAt` (otra forma para la misma
  acción que ya tiene convención en el proyecto).

## R8. Endpoints y aislamiento (FR-021) **(usuario)**

- **Decision**: los de `docs/mvp-spec.md`, con dos lecturas de detalle que necesitan las pantallas
  y que la tabla no tenía:

  | Método | Ruta | Uso |
  | --- | --- | --- |
  | GET / POST | `/recurring` | "Mis pagos" / crear |
  | GET / PATCH / DELETE | `/recurring/:id` | detalle (nuevo) / editar / eliminar |
  | POST | `/recurring/:id/pause`, `/recurring/:id/resume` | pausar / reanudar (idempotentes) |
  | GET | `/recurring/occurrences?month=YYYY-MM` | vista de un mes (materializa, R4) |
  | GET | `/occurrences/:id` | detalle de una ocurrencia (nuevo) |
  | POST / DELETE | `/occurrences/:id/payment` | marcar pagado / deshacer |

  `GET /recurring/occurrences` se declara antes que `GET /recurring/:id` para que Nest no tome
  `occurrences` como id. Todo se filtra por el usuario del token (`recurring_payments.user_id`,
  y para ocurrencias por el join con su pago); ajeno, inexistente e id inválido dan el mismo 404.
  Un mes fuera de `monthBounds` o mal formado responde `400 VALIDATION_ERROR` con
  `month: OUT_OF_RANGE` o `month: INVALID`. Contrato en
  [contracts/recurring.openapi.yaml](./contracts/recurring.openapi.yaml).
- **Rationale**: misma estructura que tarjetas y extractos; los detalles evitan que la app
  reconstruya una ocurrencia desde la lista del mes.

## R9. `GET /summary` incluye los pagos del mes (FR-014, FR-015) **(usuario)**

- **Decision**: `Summary` gana `recurring: MonthView` del mes actual (la misma estructura de `GET
  /recurring/occurrences`: mes, límites, `hasPayments`, totales y lista ordenada). Se calcula
  también sin tarjetas (hoy `summary` devuelve antes cuando no hay tarjetas). La lógica vive en
  un `RecurringService.monthView(userId, month, tx)` que usan los dos endpoints.
- **Rationale**: el inicio sigue siendo una sola llamada y un solo estado de carga (spec 004).

## R10. Pantallas y navegación de la app (FR-014 a FR-019) **(usuario)**

- **Decision**:
  - Pestaña `payments` ("Pagos", ícono `calendar`) entre `register` y `profile`.
  - `(tabs)/payments`: MonthNavigator ("‹ noviembre de 2026 ›", botones de 44 deshabilitados en
    los límites de `bounds`), MonthOverview (StatTiles + "Faltan" + lista) y un botón "Mis pagos".
  - `recurring/index` ("Mis pagos"), `recurring/new`, `recurring/[id]` (detalle con acciones),
    `recurring/[id]/edit`, `occurrence/[id]` (detalle) y `occurrence/[id]/pay` (hoja).
  - La hoja de pagar es una ruta del Stack con `presentation: 'formSheet'` y
    `sheetAllowedDetents`, de `react-native-screens` (ya instalado, sin dependencia nueva), con el
    monto esperado prellenado y editable.
  - El inicio agrega RecurringSection debajo del resumen o de EmptyCards.
- **Rationale**: la hoja nativa da el gesto de cerrar y el teclado sin librerías; reutilizar
  MonthOverview garantiza el mismo orden y totales en inicio y pestaña.
- **Alternatives considered**: `@gorhom/bottom-sheet` (dependencia nueva); `Modal` de React Native
  (sin gesto nativo de cerrar en Android); pestañas internas "Por mes / Mis pagos" (un componente
  de segmentos nuevo para algo que un botón resuelve).

## R11. Caché e invalidación en la app (FR-020) **(usuario)**

- **Decision**: todas las claves bajo `['recurring', …]` (`list`, `detail/:id`, `month/YYYY-MM`,
  `occurrence/:id`). `features/recurring-cache.ts` exporta `invalidateRecurring(queryClient)`,
  que invalida `['recurring']` y `['summary']`; toda mutación de pagos y ocurrencias pasa por ahí,
  como `invalidateCardLedger` en la spec 004. La pestaña y el inicio también recargan al enfocar y
  al volver la app al frente (cambio de día).
- **Rationale**: un solo punto de invalidación evita pantallas viejas; el prefijo común cubre
  todas las vistas del módulo con una llamada.

## R12. Componentes de UI (FR-013, FR-024)

- **Decision**: nuevos StatTile, RecurringRow (el ListRow del diseño), MonthOverview,
  MonthNavigator, RecurringSection, RecurringForm y PayOccurrenceForm. StatusChip gana la variante
  `pending` ("Pendiente", `warning` sobre `warningSoft`, el mismo par de "Por pagar": 5,20).
  "Activo" y "Pausado" van como texto secundario en "Mis pagos". Sin tokens nuevos.
- **Rationale**: los colores ya medidos del StatusChip cubren los tres estados; reutilizarlos
  mantiene AA sin medir pares nuevos.

## R13. Pruebas (principio II, FR-021, FR-022)

- **Decision**:
  - Dominio (`recurring.test.ts`): criterio 31 ene → 28 feb → 31 mar → 30 abr; día 29, 30 y 31;
    febrero bisiesto (2028) y no bisiesto; anual con 29 de febrero (2028 → 2029 → 2032); cambio de
    año; pausa (periodo de la pausa sí, siguiente no); reanudación con el día ya pasado y no
    pasado; eliminado; estados con vence hoy/ayer; `summarizeMonth` con el criterio de noviembre
    y el monto real de $70.000; orden con empates; límites de las validaciones.
  - E2e con el reloj `HOME_NOW` (23 nov 2026): `recurring.e2e-spec.ts` (crear, validar, listar,
    detalle, editar, pausar, reanudar, eliminar), `occurrences.e2e-spec.ts` (mes, totales, orden,
    pagar con y sin monto, deshacer, eliminado, límites del mes, dos `GET` simultáneos sin
    duplicados), `recurring-isolation.e2e-spec.ts` (dos usuarios en cada endpoint) y
    `summary.e2e-spec.ts` ampliado (sección del mes, sin tarjetas, sin pagos).
  - Los cambios de día se prueban con una app de reloj distinto, como el caso vencido de la spec
    004.
- **Rationale**: mismas herramientas y patrón de las specs anteriores.

## R14. Sin dependencias nuevas (CLAUDE.md del usuario)

- **Decision**: no se agregan paquetes. La hoja usa `react-native-screens` (ya en
  `apps/mobile`), el formulario `react-hook-form` + `zod`, y el API Prisma y zod.
