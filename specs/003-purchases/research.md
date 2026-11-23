# Research: Compras, cuotas y extractos

Fase 0 de [plan.md](./plan.md). Las decisiones de stack y de modelo vienen del usuario (entrada de
`/speckit-plan`); aquí se concretan y se registran los puntos delicados. Base: código de las specs
001 y 002 en `main` (`e6badef`).

## R1. Plan de cuotas en el dominio (FR-001 a FR-004)

- **Decision**: función pura `buildInstallmentPlan(purchase, days)` en
  `packages/domain/src/installments.ts`:

  ```text
  purchase = { amount, purchaseDate, installmentCount, annualRate (number | null), noInterest }
  days     = { cutoffDay, dueDay }                          (CycleDays de la spec 002)
  →  [{ number, cutoffDate, dueDate, principal, interest }]  (n elementos, number = 1..n)
  ```

  - **Abono**: `base = Math.floor(amount / n)`; cuotas 1..n−1 = `base`; cuota n =
    `amount − base × (n − 1)`. Todo en enteros; la suma es exactamente `amount`.
  - **Corte de la cuota k**: `c1 = cutoffForDate(purchaseDate, cutoffDay)` (spec 002); la cuota k
    usa `cutoffForMonthOffset(c1, k − 1, cutoffDay)` = `clampedDate(addMonths(año, mes de c1, k − 1),
    cutoffDay)`. El ajuste de fin de mes se aplica en cada mes desde el día configurado, no desde
    `c1` (corte 31: 31 ene → 28 feb → 31 mar). Fecha límite: `dueDateForCutoff` (spec 002).
  - **Interés**: si `n === 1`, `noInterest`, `annualRate` nulo o 0 → 0. Si no,
    `em = monthlyRate(annualRate)` y la cuota k = `roundHalfUp(saldo_k × em)` con
    `saldo_k = amount − base × (k − 1)`.
- **Rationale**: una sola función que devuelve el plan completo sirve al API (guardar cuotas), a
  la respuesta de "registrar compra" (primera cuota) y al simulador de la spec 004.
- **Alternatives considered**: calcular cuotas en SQL (duplica reglas fuera del dominio, viola el
  principio I); guardar solo la compra y derivar las cuotas al leer (impide reasignar cuotas de
  extractos cerrados al cambiar fechas, FR-021).

## R2. Tasa: representación y redondeo

- **Decision**: la tasa EA viaja y entra al dominio como `number` en porcentaje con hasta 2
  decimales (`26.82`), o `null`. `validateAnnualRate(rate)` → `'OUT_OF_RANGE' | 'TOO_MANY_DECIMALS'
  | null` (0 ≤ rate ≤ 100; `Math.abs(rate * 100 − Math.round(rate * 100)) < 1e-9`).
  `monthlyRate(rate) = (1 + rate / 100) ** (1 / 12) − 1`.
- **Redondeo**: `roundHalfUp(x) = Math.floor(x + 0.5)` (los montos son no negativos). El interés es
  un estimado (principio IV) y el error de punto flotante de `saldo × em` es del orden de 10⁻⁷
  pesos, así que solo afecta casos que caen a menos de eso de un medio peso; se acepta.
- **En la base**: `NUMERIC(5,2)` en `cards.annual_rate` y `purchases.annual_rate`. Prisma devuelve
  `Decimal`; el mapper lo convierte con `Number(decimal.toFixed(2))` y escribe el `number`
  validado. El dinero sigue en `BIGINT`: la tasa no es un monto.
- **Verificación** (Node 24): EA 24% → EM = 0,018087582…; compra de $1.200.000 a 12 cuotas →
  intereses 21.705, 19.896, 18.088 … 1.809 (spec, historia 1, escenario 5).
- **Alternatives considered**: guardar la tasa en centésimas de punto como entero (evita
  `Decimal` en Prisma, pero el usuario eligió `NUMERIC(5,2)` y `Decimal` se aísla en el mapper);
  aritmética decimal exacta (dependencia extra para un valor que la UI marca como estimado).

## R3. Validación de compras (FR-008, FR-011)

- **Decision**: reglas en `packages/domain/src/purchase-rules.ts`, compartidas por zod en el API y
  en la app:
  - `PURCHASE_CONCEPT_MAX_LENGTH = 60`, `INSTALLMENTS_MIN = 1`, `INSTALLMENTS_MAX = 72`,
    `PURCHASE_MAX_AGE_MONTHS = 72`.
  - `normalizeConcept`, `validateConcept` → `'REQUIRED' | 'TOO_LONG' | null`.
  - `validateInstallmentCount(n)` → `'OUT_OF_RANGE' | null` (entero 1–72).
  - `validatePurchaseDate(date, today)` → `'INVALID' | 'IN_FUTURE' | 'TOO_OLD' | null`. La fecha
    mínima es `today` menos 72 meses, ajustada a fin de mes (`clampedDate`).
  - El valor usa `validateAmount` de la spec 002 (1 a 9.999.999.999).
- **"Hoy" para validar**: el API usa `todayInTimeZone(user.timezone, clock.now())` (spec 002, R3).
  La app usa el `cycle.today` que ya devuelve `GET /cards/:id`; así la fecha por defecto y la
  validación local coinciden con el servidor aunque el reloj del teléfono esté mal.

## R4. Extractos: estado derivado y pago (FR-015 a FR-020)

- **Decision**: en `statements` solo se guardan `cutoff_date`, `due_date`, `paid_at` y
  `paid_amount`. El estado lo deriva `statementStatus({ cutoffDate, dueDate, paidAt }, today)` del
  dominio: `paid` si `paidAt`; si no, `open` si `today ≤ cutoffDate`, `due` si
  `today ≤ dueDate`, `overdue` en otro caso. Claves en inglés en el API; la app las muestra como
  Abierto, Por pagar, Vencido y Pagado.
- **`paid_at`** es `DATE` (la fecha de pago es una fecha de negocio, principio IV): el "hoy" del
  usuario al marcar. `paid_amount` es el "A pagar" en ese momento. Un `CHECK` exige que ambos sean
  nulos o ambos no nulos.
- **Pagar**: `POST /statements/:id/payment` solo con estado `due` u `overdue`; con `open` → 409
  `STATEMENT_OPEN`. Sobre uno ya pagado responde 200 sin cambios (idempotente, como archivar).
  `DELETE /statements/:id/payment` borra ambos campos; sobre uno no pagado responde 200 sin
  cambios. Pagar o deshacer se permite con la tarjeta archivada (spec, Assumptions).
- **"A pagar"** (`total`) = `SUM(principal + interest)` de sus cuotas, calculado en la consulta;
  no se guarda. `hasInterest` = alguna cuota con `interest > 0` (la app marca el total como
  estimado). Un extracto pagado devuelve `total` y `paidAmount`; la app muestra ambos si difieren
  (FR-031).
- **Orden de la lista (FR-018)**: no pagados por `cutoff_date` ascendente y después pagados por
  `cutoff_date` descendente. Lo resuelve el API tras derivar el estado (una tarjeta tiene a lo sumo
  unos cientos de extractos; sin paginación en esta spec).

## R5. Escrituras transaccionales y bloqueo por tarjeta

- **Decision**: toda operación que crea, cambia o borra cuotas (registrar, editar o borrar una
  compra; cambiar `cutoffDay` o `dueDay` de una tarjeta) corre en `prisma.$transaction` interactiva
  y empieza con `SELECT id FROM cards WHERE id = $1 AND user_id = $2 FOR UPDATE`. Ese bloqueo:
  - comprueba la propiedad (principio III) y da 404 si no hay fila;
  - serializa las escrituras de una misma tarjeta, así dos compras simultáneas no crean dos veces
    el mismo extracto ni dejan uno vacío a medias.
- **Extractos bajo demanda**: por cada cuota se busca el extracto `(card_id, cutoff_date)` y se
  crea si no existe (`upsert` sobre la clave única). La fecha límite de un extracto nuevo es la del
  plan.
- **FR-030 (extracto pasado nuevo)**: si el extracto se crea en esta operación y su `due_date <
  today`, se crea con `paid_at = today`; al terminar de insertar las cuotas,
  `paid_amount = SUM(principal + interest)` de ese extracto. Los extractos que ya existían no
  cambian de estado (FR-031): si estaban pagados, sus nuevas cuotas cuentan como pagadas y
  `paid_amount` no se toca.
- **Limpieza (FR-022)**: al final de cada operación se borran los extractos de la tarjeta sin
  cuotas y con `paid_at IS NULL`. Los pagados vacíos se conservan (muestran `total` 0 y su
  `paidAmount`).

## R6. Editar y borrar compras (FR-014)

- **Decision**:
  - Si solo cambia `concept`, se actualiza la compra y las cuotas no se tocan.
  - Si cambia `amount`, `purchaseDate`, `installmentCount` o `noInterest`, se borran sus cuotas y
    se regenera el plan completo con `buildInstallmentPlan`, los días actuales de la tarjeta y la
    `annual_rate` guardada en la compra (FR-007; nunca la de la tarjeta). Se aplica R5 (extractos
    bajo demanda, FR-030 y limpieza).
  - Borrar: se borran la compra y sus cuotas (cascada) y luego se limpia (R5).
  - Tarjeta archivada: registrar, editar o borrar → 409 `CARD_ARCHIVED`.
- **Consecuencia aceptada**: si las fechas de la tarjeta cambiaron después de registrar la compra,
  regenerarla usa las fechas nuevas también para sus cuotas de ciclos pasados (que pueden pasar a
  extractos pasados nuevos, creados como pagados por FR-030). Es coherente con "sus cuotas se
  recalculan" y evita guardar el historial de fechas de la tarjeta.
- **Alternatives considered**: diferenciar cuotas a mano (más código y casos para el mismo
  resultado); bloquear la edición de compras con cuotas cerradas (descartado en la aclaración Q2).

## R7. Cambio de fechas de la tarjeta (FR-021)

- **Decision**: función pura `rescheduleInstallments(input, today, newDays)` en el dominio:

  ```text
  input = [{ purchaseDate, installments: [{ number, cutoffDate (actual) }] }]  (cuotas en orden)
  → por compra, la nueva { cutoffDate, dueDate } de cada cuota en extracto abierto
  ```

  Para cada compra, las cuotas con `cutoffDate < today` (extractos cerrados) no se tocan. Sea
  `j` la primera cuota restante: `start = max(corte que le da la regla con los días nuevos,
  cutoffForDate(today, nuevoCorte))`; la cuota `j + i` va a `cutoffForMonthOffset(start, i)` con
  su fecha límite nueva. Así quedan consecutivas, nunca en un corte pasado y nunca chocan con un
  extracto cerrado (todos los nuevos cortes son ≥ hoy).
- **En el API**: dentro de la transacción de `PATCH /cards/:id` (solo si cambian `cutoffDay` o
  `dueDay`): se leen las cuotas de extractos abiertos (`cutoff_date ≥ today`), se calculan los
  destinos, se crean o reutilizan extractos (los nuevos tienen corte ≥ hoy, así que nunca aplica
  FR-030), se mueven las cuotas (`statement_id`), se actualiza la `due_date` de los abiertos que se
  reutilizan y se limpia (R5). Los cerrados no se leen ni se escriben (SC-007). Los extractos
  abiertos nunca están pagados (FR-019), así que no hay pagos que perder.
- **Pruebas**: el escenario de la historia 7 (corte 8/pago 25 → 15/2 el 23 de noviembre), cuotas
  parcialmente cerradas, hoy igual al día de corte, y corte 31 → 30.

## R8. Cupo disponible, deuda y tope (FR-023, FR-024)

- **Decision**: valores derivados, no guardados:
  - `totalDebt` = `SUM(principal)` de las cuotas de la tarjeta en extractos con `paid_at IS NULL`.
  - `availableCredit` = `creditLimit − totalDebt` (puede ser negativo).
  - `cycleBudgetUsage` (solo en el detalle) = `{ cutoffDate, amount, percent }` del extracto del
    próximo corte (`nextCutoff(today)`): `amount` = su "A pagar" (0 si no existe) y
    `percent = Math.floor(amount × 100 / cycleBudget)` (`budgetUsagePercent` en el dominio; con
    floor, 99,6% no se muestra como 100%).
- **Consultas**: `GET /cards` calcula `totalDebt` de todas las tarjetas con un solo `groupBy` (o un
  `SUM` con `JOIN`) por `card_id`; el detalle agrega una consulta para el extracto del próximo
  corte. `PublicCard` gana `annualRate`, `totalDebt` y el `availableCredit` real (reemplaza FR-017
  de la spec 002).
- **Aviso de cupo (FR-012)**: lo decide la app antes de enviar, con el `availableCredit` del
  detalle: compra nueva si `amount > availableCredit`; edición si
  `amount − amountAnterior > availableCredit`. El API no lo bloquea.

## R9. Fechas `DATE` en Prisma

- **Decision**: columnas `@db.Date` (`purchase_date`, `cutoff_date`, `due_date`, `paid_at`). Prisma
  las expone como `Date` a medianoche UTC. Un helper `src/common/iso-date.ts` convierte
  `IsoDate → Date` con `new Date(iso + 'T00:00:00.000Z')` y `Date → IsoDate` con
  `toISOString().slice(0, 10)`; nunca se usan los métodos locales de `Date`.
- **Rationale**: es la primera spec con columnas `DATE`; un solo punto de conversión evita
  corrimientos de un día por zona horaria del servidor.

## R10. Contrato HTTP

- **Decision** (rutas de `docs/mvp-spec.md`, más `GET /purchases/:id` para el detalle de FR-013):

  | Método | Ruta | Resultado |
  | --- | --- | --- |
  | GET | `/cards/:id/purchases` | Compras de la tarjeta, por fecha descendente |
  | POST | `/cards/:id/purchases` | 201, compra con su plan |
  | GET | `/purchases/:id` | Compra con su plan |
  | PATCH | `/purchases/:id` | 200, compra con su plan |
  | DELETE | `/purchases/:id` | 204 |
  | GET | `/cards/:id/statements` | Extractos con `total`, `status` y orden de FR-018 |
  | GET | `/statements/:id` | Extracto con sus cuotas |
  | POST / DELETE | `/statements/:id/payment` | 200, extracto |

- **Aislamiento**: compras y extractos no tienen `user_id`; se filtran por la relación
  (`purchase.card.userId`, `statement.card.userId`) con el `userId` del token. Un id ajeno,
  inexistente o que no es UUID responde 404 `NOT_FOUND` con el mismo cuerpo (FR-025). E2e con dos
  usuarios para las 9 operaciones.
- **Plan en la respuesta**: cada cuota incluye `number`, `cutoffDate`, `dueDate`, `principal`,
  `interest`, `statementId` y `statementStatus`; la confirmación de la app usa la primera cuota
  (FR-010).

## R11. App

- **Decision**:
  - Rutas nuevas en el Stack de `(app)`: `card/[id]/purchases/index` (lista),
    `card/[id]/purchases/new`, `purchase/[id]/index` (detalle con plan), `purchase/[id]/edit`,
    `card/[id]/statements` (lista) y `statement/[id]` (detalle con cuotas y pago).
  - Componentes: `PurchaseForm` (crear y editar), `StatusChip` (Abierto, Por pagar, Pagado,
    Vencido, siempre con texto), `StatementRow`, `InstallmentRow`, `DateField`.
  - `CardForm` gana el campo "Tasa de interés EA (%)" (`features/rate.ts`: acepta coma o punto,
    formatea "26,82% EA").
  - Detalle de tarjeta: cupo disponible real, "Deuda total", tasa, "Tope del ciclo: 45% · $900.000
    de $2.000.000", y acciones "Registrar compra" (solo activa), "Compras" y "Extractos".
  - Invalidación (TanStack Query): tras registrar, editar, borrar o pagar se invalidan
    `['cards']`, `['card', id]`, `['purchases', cardId]`, `['statements', cardId]` y el detalle
    tocado (SC-005).
- **Fecha de la compra**: `@react-native-community/datetimepicker` (dependencia nueva). Viene
  incluido en Expo Go, usa el selector nativo de cada plataforma (accesible con VoiceOver y
  TalkBack) y permite fijar `maximumDate` = hoy y `minimumDate` = hoy − 72 meses. Alternativa
  descartada: un campo de texto `AAAA-MM-DD` (propenso a errores y poco accesible). El valor se
  convierte a `IsoDate` con los componentes de año, mes y día locales del valor elegido, sin pasar
  por UTC.
- **Estados**: `docs/design-system.md` define StatusChip con Pagado (`success`), Pendiente
  (`warning`) y Vencido (`danger`). Se agregan "Abierto" (neutral: `textSecondary` sobre
  `surface` con borde `border`) y "Por pagar" (`warning`); se actualiza el documento en la misma
  PR.

## R12. Pruebas

- **Dominio** (Vitest, cobertura ≥ 95% como en la spec 002): ejemplos de la spec (3.090.000/30;
  4.765.548/60; 1.200.000/12 al 24%; corte 8/pago 25 desde el 9 de noviembre; corte 31 en
  febrero); propiedades por recorrido exhaustivo, sin dependencias nuevas: para n de 1 a 72 y una
  lista de valores (1, n − 1, n, n + 1, divisibles, no divisibles, primos grandes, el máximo) la
  suma de abonos es el valor, ningún abono es negativo, y el interés es 0 con n = 1, sin intereses,
  tasa nula o 0; los cortes del plan son estrictamente crecientes y consecutivos.
  `rescheduleInstallments` y `statementStatus` con sus bordes (hoy = corte, hoy = fecha límite).
- **API** (Jest e2e contra PostgreSQL, reloj fijo `2026-11-22T02:30:00Z` → hoy 21 de noviembre en
  Bogotá): `purchases.e2e-spec.ts`, `statements.e2e-spec.ts`, `card-reschedule.e2e-spec.ts` y
  `purchases-isolation.e2e-spec.ts` (las 9 operaciones con dos usuarios, más `POST
  /cards/:id/purchases` sobre una tarjeta ajena).
- **Alternatives considered**: `fast-check` para propiedades (dependencia nueva para lo que un
  recorrido exhaustivo de n = 1..72 cubre en milisegundos).
