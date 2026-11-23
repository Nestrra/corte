# Research: Inicio y simulador

Fase 0 de [plan.md](./plan.md). `/speckit-plan` no recibió decisiones técnicas nuevas, así que se
siguen las de `docs/mvp-spec.md` (tabla del API: `POST /cards/:id/simulate` y `GET /summary`), la
constitución y el código de las specs 001 a 003 en `main` (`71296b9`).

## R1. La simulación se calcula en el API (FR-001, FR-005, FR-022)

- **Decision**: `POST /cards/:id/simulate` calcula la simulación en el servidor con una función
  pura nueva del dominio (R2). La app la pide mientras el usuario escribe (R7). El API solo lee:
  la tarjeta, la deuda, el "A pagar" del extracto abierto y los extractos ya existentes donde caen
  las cuotas; no abre transacción ni bloquea la tarjeta.
- **Rationale**: la spec exige el "hoy" del servidor y el estado real de los extractos (abierto,
  pagados, FR-030 de la spec 003), datos que la app no tiene completos. Con el cálculo en el API,
  la simulación y el registro usan exactamente las mismas entradas y la prueba SC-001 (simular y
  luego registrar dan lo mismo) se hace en una e2e.
- **Alternatives considered**: calcular en la app con `@corte/domain` y los datos de `GET
  /cards/:id` (sin red al escribir, pero le falta el estado de los extractos pasados y duplica la
  composición de datos en dos lugares); un `dryRun` en `POST /cards/:id/purchases` (mezcla
  escritura y lectura en un endpoint y exige el concepto, que no afecta la simulación).

## R2. `simulatePurchase` en el dominio (FR-002 a FR-004, principio I)

- **Decision**: `packages/domain/src/simulation.ts`:

  ```text
  simulatePurchase({
    purchase: { amount, purchaseDate, installmentCount, annualRate, noInterest },
    days: { cutoffDay, dueDay },
    today,
    openStatementAmount,          // "A pagar" actual del extracto abierto (0 si no existe)
    cycleBudget,
    availableCredit,              // cupo disponible actual (puede ser negativo)
    statements: [{ cutoffDate, paidAt }],   // extractos existentes de la tarjeta
  }) → {
    installments: [{ number, cutoffDate, dueDate, principal, interest, statementStatus }],
    totalInterest,
    cycleBudget,
    cycleBudgetUsage: { cutoffDate, amountBefore, amountAfter, percentBefore, percentAfter },
    availableCredit: { before, after },
  }
  ```

  - El plan es `buildInstallmentPlan` (spec 003) sin cambios.
  - **Estado del extracto de cada cuota**: si el extracto existe y está pagado → `paid`; si existe
    y no está pagado → `statementStatus` (spec 003); si no existe y su fecha límite ya pasó →
    `paid` (así lo crearía el registro, FR-030 de la spec 003); si no → `statementStatus`.
  - **Tope después** (FR-003): el dominio calcula el corte del extracto abierto con `nextCutoff`
    (spec 002); `amountAfter = openStatementAmount + principal + interest` de la cuota con ese corte (a lo sumo una, porque las cuotas caen en cortes
    distintos); si ninguna cae ahí, `amountAfter = amountBefore`. Porcentajes con
    `budgetUsagePercent` (floor, spec 003).
  - **Cupo después** (FR-004): `availableCredit − amount`.
  - `totalInterest` = suma de los intereses del plan.
- **Rationale**: la composición (qué cuota toca el extracto abierto, qué estado tendría cada
  extracto) es regla de negocio y debe vivir en el dominio, con pruebas, no en el servicio Nest.
- **Alternatives considered**: componer en el servicio del API (regla fuera del dominio; principio
  I); devolver solo el plan y que la app sume el tope (duplica la regla en la app).

## R3. Contrato de `POST /cards/:id/simulate` (FR-006, FR-023)

- **Decision**: cuerpo `{ amount, purchaseDate?, installmentCount?, noInterest? }` con los mismos
  validadores y valores por defecto de `createPurchaseSchema` (spec 003) sin `concept`. Responde
  200 con la simulación ([contracts/home.openapi.yaml](./contracts/home.openapi.yaml)).
  - Tarjeta ajena, inexistente o id no UUID → 404 `NOT_FOUND` (igual que el registro).
  - Tarjeta archivada → 409 `CARD_ARCHIVED` (`AppErrors.cardArchivedPurchases`, spec 003).
  - Campos inválidos → 400 `VALIDATION_ERROR` con los códigos por campo de la spec 003
    (`IN_FUTURE` y `TOO_OLD` en la fecha, con el "hoy" del usuario).
- **Rationale**: mismas reglas que el registro (FR-006) y un esquema compartido: se extrae la parte
  común a `simulatePurchaseSchema = createPurchaseSchema.omit({ concept })`.
- **Alternatives considered**: `GET` con query string (los números y el booleano llegan como texto
  y se pierde la validación estricta de zod que ya existe para el cuerpo).

## R4. `GET /summary` para el inicio (FR-014 a FR-017, FR-022)

- **Decision**: un endpoint que devuelve todo el inicio en una llamada:

  ```text
  { today, cards: [{ card: Card, nextPayment | null, nextCutoff, cycleBudgetUsage }] }
  ```

  - `cards`: las activas, en el mismo orden que `GET /cards` (el carrusel no cambia de orden).
  - `nextPayment`: el extracto no pagado con corte anterior a hoy (Por pagar o Vencido) con la
    fecha límite más antigua: `{ statementId, cutoffDate, dueDate, amount, status, daysLeft }`;
    `daysLeft` negativo si está vencido. Elegido con la función pura `nextPayment(statements,
    today)` del dominio.
  - `nextCutoff`: `{ cutoffDate, dueDate, daysLeft }` del ciclo actual (`nextCutoff` de la spec
    002).
  - `cycleBudgetUsage`: `{ cutoffDate, amount, percent }` como en `GET /cards/:id` (spec 003).
  - Número fijo de consultas, sin N+1: tarjetas activas, deuda por tarjeta (`debtByCard`),
    extractos no pagados con corte < hoy de esas tarjetas, sus totales (`totalsByStatement`) y los
    totales de los extractos abiertos (consulta agregada nueva `totalsForCutoffs`).
- **Rationale**: el inicio muestra varias tarjetas; pedir `GET /cards/:id` por cada una serían N
  llamadas. `daysLeft` viene del API para que los días usen el "hoy" del servidor (FR-022) sin que
  la app lo reconstruya.
- **Alternatives considered**: ampliar `GET /cards` con los campos del resumen (encarece la lista
  que usan otras pantallas y mezcla dos contratos); calcular el próximo pago en la app con `GET
  /cards/:id/statements` por tarjeta (N llamadas).

## R5. Umbrales visuales en el dominio (FR-016, FR-017)

- **Decision**: `budgetLevel(percent)` → `'normal' | 'warning' | 'danger'` (< 70, 70–99, ≥ 100) y
  `paymentUrgency(daysLeft, status)` → `'normal' | 'soon' | 'overdue'` (`overdue` si el estado es
  `overdue`; `soon` si 0 ≤ daysLeft ≤ 5; si no `normal`), en `packages/domain/src/statements.ts`
  con las constantes `BUDGET_WARNING_PERCENT = 70`, `BUDGET_DANGER_PERCENT = 100` y
  `PAYMENT_SOON_DAYS = 5`. La app los importa.
- **Rationale**: son reglas de producto (los umbrales 70/100 los reusan las alertas de la spec
  005); un solo lugar y con pruebas.
- **Alternatives considered**: constantes en la app (la spec 005 las duplicaría en el API).

## R6. Tarjeta al frente (FR-012, FR-018)

- **Decision**: store de Zustand en memoria `apps/mobile/src/features/front-card-store.ts` con
  `frontCardId: string | null` y `setFrontCardId`. `CardCarousel` gana la prop opcional
  `onActiveChange(card)` (se llama al montar y al terminar cada deslizamiento); solo el carrusel
  del inicio la usa. Si la tarjeta guardada ya no está entre las activas, se toma la primera.
- **Rationale**: el botón central vive en otra pestaña y necesita saber la tarjeta al frente; Zustand
  ya está en el proyecto (constitución) y no se persiste (Assumptions de la spec).
- **Alternatives considered**: parámetro de ruta (el botón central no tiene acceso a la ruta del
  inicio); persistirlo en SecureStore (fuera de la spec).

## R7. Simulación en vivo en la app (FR-007, SC-003)

- **Decision**: `PurchaseForm` observa valor, fecha, cuotas y "Sin intereses" con `useWatch`, los
  valida con el esquema local de la spec 003 y, si son válidos, los pasa por un hook
  `useDebouncedValue` (350 ms, sin dependencias nuevas) a un `useQuery` con clave
  `['simulation', cardId, input]`, `placeholderData: keepPreviousData` y `staleTime: 0`. Con datos
  inválidos no se pide nada y el panel dice qué falta ("Escribe el valor de la compra", "Las cuotas
  van de 1 a 72", etc.). Un error de red muestra un mensaje con "Reintentar" y no bloquea "Guardar".
  - **Recalculando, sin spinner**: mientras llega la respuesta de los datos nuevos
    (`isPlaceholderData`), el panel sigue mostrando los últimos valores **atenuados** con el token
    nuevo `interaction.staleOpacity` (0,85), con la línea "Actualizando…" y
    `accessibilityState.busy`. Solo la primera vez, sin valores previos, dice "Calculando…" (texto,
    sin spinner).
  - **La atenuación respeta AA** (principio IX): se aplica a las cifras, fechas y la barra, que
    van en `text`, `textSecondary` o `primaryStrong` sobre `surface`/`primarySoft` (a 0,85: 5,17 el
    peor par). No se atenúan los avisos (`danger` sobre `dangerSoft`) ni los StatusChip del plan,
    porque `warning` sobre `warningSoft` atenuado bajaría a 4,01.
  - **Respuestas viejas descartadas**: cada combinación de datos es una clave distinta, así que una
    respuesta tardía de una combinación anterior queda en su propia clave y nunca se pinta sobre la
    actual. Además, `apiFetch` acepta el `signal` de TanStack Query (combinado con su timeout), de
    modo que la petición anterior se cancela cuando su clave deja de usarse; `gcTime` corto (30 s)
    para no acumular simulaciones.
- **Rationale**: 350 ms de espera + una lectura simple queda bajo el segundo de SC-003; mantener el
  resultado anterior atenuado evita parpadeos y deja claro que se está actualizando; la clave por
  datos garantiza que lo visible siempre corresponde a lo escrito.
- **Alternatives considered**: botón "Simular" (la spec pide que se actualice sin pulsar); pedir en
  cada tecla (ráfagas de peticiones); spinner al recalcular (parpadeo y salto de altura); contador
  de peticiones a mano para ignorar respuestas viejas (lo resuelve ya la clave de la consulta).

## R8. Botón central "Registrar compra" (FR-011, FR-012)

- **Decision**: una ruta de pestaña `(tabs)/register.tsx` que no se muestra nunca: el `TabBar`
  dibuja esa ruta como el botón central de 56 (círculo `primary`, ícono `add`, etiqueta accesible
  "Registrar compra", rol `button`) y al tocarlo hace `router.push('/purchase/new')` en lugar de
  cambiar de pestaña. Orden: Inicio, Tarjetas, Registrar compra, Perfil.
- **Rationale**: expo-router necesita una ruta por elemento de la barra; esta forma no cambia los
  tokens ni la estructura de la spec 002 (como pide `docs/design-system.md`).
- **Alternatives considered**: botón flotante fuera de la barra (no sigue el diseño); pantalla de
  registro dentro de las pestañas (perdería la pestaña de origen al volver).

## R9. Una sola pantalla de registro con selector de tarjeta (FR-012, FR-013)

- **Decision**: nueva ruta apilada `(app)/purchase/new.tsx` con parámetro opcional `cardId`:
  - Desde el botón central: `cardId` = tarjeta al frente (R6) o la primera activa.
  - Desde el detalle de la tarjeta: `router.push({ pathname: '/purchase/new', params: { cardId } })`.
  - Se elimina `card/[id]/purchases/new.tsx` (la spec 003 la usaba solo desde el detalle).
  - Arriba del formulario, `CardPicker`: fila "Tarjeta · Visa Oro · Cambiar" que despliega la lista
    de tarjetas activas como opciones de radio (≥ 44, nombre y últimos 4). Al elegir otra, el
    formulario no se reinicia (mismo `useForm`), la simulación se pide con la nueva tarjeta y la
    nota de la tasa, el cupo y el aviso de cupo usan la nueva.
  - Sin tarjetas activas: mensaje "Agrega tu primera tarjeta" y botón a `card/new`.
  - Al guardar: la misma confirmación de la spec 003; "Listo" hace `router.back()` (vuelve a la
    pestaña o al detalle de origen) y "Ver compra" reemplaza por el detalle de la compra.
- **Rationale**: un solo formulario con simulación para los dos puntos de entrada evita duplicar
  la pantalla.
- **Alternatives considered**: mantener las dos rutas (dos pantallas casi iguales); selector en un
  modal aparte (un paso más y riesgo de perder lo escrito).

## R10. Componentes nuevos (FR-014 a FR-019, FR-026)

- **Decision** (`apps/mobile/src/components/`):
  - `ProgressBar`: alto 8, fondo `primarySoft`, relleno según `budgetLevel` (`primary`, `warning`,
    `danger`), ancho máximo 100% aunque el porcentaje lo supere; `accessibilityRole="progressbar"`
    con `accessibilityValue` y la frase completa en la etiqueta.
  - `CycleSummary`: panel con tres filas tocables (≥ 44): Próximo pago (monto, "25 nov", días y,
    si aplica, chip "Pronto"/"Vencido" con fondo `warningSoft`/`dangerSoft`), Próximo corte y
    Ciclo actual (porcentaje, "$X de $Y" y `ProgressBar`; "Superaste el tope" desde 100%). Título
    accesible "Resumen de <tarjeta>" en una región `polite` para anunciar el cambio al deslizar.
  - `SimulationPanel`: "Primera cuota en el corte del … · se paga el …", Tope del ciclo (antes →
    después, `ProgressBar` con el nivel del después), Cupo disponible después, Intereses
    estimados (total) y el plan con `InstallmentRow` (spec 003) por cuota con su estado. Avisos de
    tope ≥ 100% y cupo negativo con texto, en `dangerSoft`.
  - `CardPicker` (R9) y `EmptyCards` (invitación del inicio y del registro).
  - `days.ts` (features): `daysLeftText(n)` → "Hoy", "Mañana", "En N días", "Hace N días".
- **Rationale**: componentes del sistema de diseño ya nombrados en `docs/design-system.md`
  (CycleSummary, ProgressBar); los demás se documentan ahí.
- **Alternatives considered**: reutilizar el `LedgerPanel` del detalle de tarjeta (no tiene próximo
  pago ni urgencia); se deja como está.

## R11. Inicio siempre al día (FR-021, SC-006)

- **Decision**: `summaryKeys.all = ['summary']`. **Toda mutación de compras, pagos y tarjetas
  invalida `['summary']`**, sin excepciones:
  - Compras: registrar, editar y borrar (`invalidateCardLedger`, spec 003, que ahora incluye
    `['summary']`).
  - Pagos: marcar pagado y deshacer (también por `invalidateCardLedger`).
  - Tarjetas: crear, editar, archivar y restaurar (helper nuevo `invalidateCards(queryClient)` en
    `ledger-cache.ts` que invalida `['cards']` y `['summary']`; editar sigue usando
    `invalidateCardLedger` porque reprograma extractos).
  - Ninguna pantalla llama a `invalidateQueries` de tarjetas a mano: todas pasan por estos dos
    helpers, para que una mutación nueva no olvide el inicio. El inicio usa
  `useRefetchOnFocus` y además vuelve a pedir el resumen cuando la app pasa a primer plano
  (`AppState` → `active`), para que los días cambien al pasar la medianoche (US5-2).
- **Rationale**: mismo patrón de la spec 003; el `AppState` cubre la app abierta de un día para otro.
- **Alternatives considered**: refrescar con un temporizador (consume batería y red sin motivo).

## R12. Pruebas (principio II, FR-024, SC-001, SC-002, SC-007)

- **Decision**:
  - Dominio: `simulation.test.ts` con los dos criterios de la spec (300.000 a 3 cuotas el 23 de
    noviembre; 1.500.000 + 600.000 de 2.000.000 = 105%), compra que cae en el ciclo siguiente,
    compra con fecha pasada (extracto existente pagado, existente no pagado y nuevo vencido →
    `paid`), cupo negativo, total de intereses = suma del plan; `nextPayment`, `budgetLevel` y
    `paymentUrgency` con sus bordes (69/70/99/100; 6/5/0/−1 días).
  - API: `simulate.e2e-spec.ts` con el reloj fijo en `2026-11-23T15:00:00Z` (hoy = 23 de
    noviembre en Bogotá) para los criterios; comprueba que simular y luego registrar la misma
    compra dan el mismo plan (SC-001), que el número de compras, cuotas y extractos y el cupo no
    cambian tras simular (SC-002), validaciones, archivada; `summary.e2e-spec.ts` con orden,
    próximo pago (por pagar, vencido, ninguno), uso del tope y usuario sin tarjetas;
    `home-isolation.e2e-spec.ts` con dos usuarios para `simulate` y `summary`.
  - App: validación manual con [quickstart.md](./quickstart.md) (B9).
- **Rationale**: mismo esquema de la spec 003; cada endpoint nuevo con e2e y aislamiento.
- **Alternatives considered**: pruebas de componentes en la app (el proyecto no las tiene; fuera
  de alcance).

## R13. Dependencias

- **Decision**: ninguna nueva. Debounce con un hook propio; `AppState` de React Native; Zustand,
  TanStack Query, react-hook-form y `@expo/vector-icons` ya están.
