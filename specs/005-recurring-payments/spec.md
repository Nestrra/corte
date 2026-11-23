# Feature Specification: Pagos recurrentes

**Feature Branch**: `005-recurring-payments`

**Created**: 2026-11-23

**Status**: Draft

**Reference**: `docs/mvp-spec.md` → HU-07, HU-08 (recurrentes del mes en el inicio) y reglas
"Pagos recurrentes" 1–5; `docs/design-system.md` → "Pantalla de inicio" (punto 4), StatTile,
ListRow, StatusChip, SectionHeader y TabBar; `specs/002-cards/spec.md` → "hoy" del servidor y
regla del último día del mes; `specs/004-home-simulator/spec.md` → inicio y barra inferior.

**Input**: User description: "Spec 005 — Pagos recurrentes. Corresponde a HU-07 de
docs/mvp-spec.md y a la sección de pagos del inicio de docs/design-system.md. Cambio de orden:
esta es ahora la 005 y las alertas y recordatorios pasan a la 006 (actualiza el orden de specs en
docs/mvp-spec.md). Como usuario quiero: 1. Crear un pago recurrente con nombre (ej. 'Arriendo'),
monto esperado, frecuencia (mensual o anual) y fecha del primer vencimiento. Con frecuencia
mensual se repite ese día cada mes; con anual, ese día y mes cada año. Si el día no existe en el
mes, se usa el último día del mes. 2. Ver en el inicio, debajo del resumen de tarjetas, la sección
'Pagos de <mes actual>' con: total del mes, pagado y lo que falta, y la lista de pagos del mes
ordenada así: vencidos, pendientes (por fecha) y pagados. Cada fila muestra nombre, fecha, monto y
estado como texto (Vencido, Pendiente, Pagado). Con el botón 'Nuevo' creo uno. 3. Marcar una
ocurrencia como pagada, opcionalmente con el monto real si fue distinto, y deshacerlo. 4. Una
pestaña 'Pagos' en la barra inferior (Inicio · Tarjetas · [Registrar compra] · Pagos · Perfil) con
la vista por mes (puedo ir a meses anteriores y siguientes) y la lista de mis pagos recurrentes
para editarlos, pausarlos, reanudarlos o eliminarlos. 5. Editar un pago: los cambios de monto o
fecha aplican a las ocurrencias pendientes futuras, nunca a las pagadas. 6. Pausar un pago: deja
de generar ocurrencias nuevas; las pendientes existentes se mantienen. Reanudar las vuelve a
generar desde el mes actual. 7. Eliminar un pago: borra el pago y sus ocurrencias pendientes, pero
conserva el historial de las pagadas. Reglas: los pagos recurrentes no suman a ninguna tarjeta.
Una ocurrencia pendiente con fecha anterior a 'hoy' (del servidor, en la zona del usuario) se
muestra como Vencida. Los montos en pesos enteros. La lógica de fechas de vencimiento va en el
dominio con pruebas de meses cortos, febrero bisiesto y cambio de año. Criterios de aceptación: un
pago mensual con primer vencimiento el 31 de enero de 2027 vence el 28 de febrero, el 31 de marzo
y el 30 de abril de 2027; con arriendo $1.200.000 pagado, internet $95.000 pagado, celular $65.000
pendiente y gimnasio $120.000 vencido en noviembre, el inicio muestra total $1.480.000, pagado
$1.295.000 y faltan $185.000; marcar pagado con monto real $70.000 cuenta $70.000 en lo pagado; un
usuario no puede ver ni modificar los pagos de otro. Fuera de alcance: recordatorios push (spec
006), cargar un pago recurrente a una tarjeta y otras frecuencias (v2)."

## User Scenarios & Testing *(mandatory)*

Actor: **usuario** con sesión iniciada (spec 001). "Hoy" es la fecha en su zona horaria según el
servidor (spec 002), no la del teléfono.

Términos usados en esta spec:

- **Pago recurrente**: un gasto fijo que se repite (arriendo, internet, gimnasio). Tiene nombre,
  monto esperado, frecuencia (mensual o anual), una fecha de referencia (la del primer
  vencimiento, o la que el usuario fije al editarlo) y un estado: **Activo** o **Pausado**.
- **Periodo**: un mes calendario para la frecuencia mensual; un año calendario para la anual.
- **Ocurrencia**: el vencimiento de un pago recurrente en un periodo: fecha de vencimiento, monto
  esperado y, si se pagó, monto real y fecha en que se marcó. Hay como máximo una por pago y
  periodo.
- **Estado de una ocurrencia**: **Pagado** si el usuario la marcó; **Vencido** si no está pagada y
  su fecha es anterior a hoy; **Pendiente** si no está pagada y su fecha es hoy o posterior.
- **Pagos de un mes**: las ocurrencias cuya fecha de vencimiento cae en ese mes calendario.
- **Total del mes**: suma, sobre los pagos del mes, del monto real de las pagadas y del monto
  esperado de las no pagadas. **Pagado**: suma de los montos reales de las pagadas. **Falta**:
  suma de los montos esperados de las no pagadas (Pendientes y Vencidas). Siempre Total = Pagado +
  Falta.

### User Story 1 - Crear un pago recurrente y ver sus vencimientos (Priority: P1)

Como usuario quiero registrar mis pagos fijos una sola vez, con su monto, frecuencia y primer
vencimiento, para que Corte me diga cada periodo cuánto y cuándo pagar.

**Why this priority**: sin pagos recurrentes no hay nada que mostrar en las demás historias; es el
núcleo de HU-07.

**Independent Test**: crear un pago mensual y uno anual, recorrer los meses en la pestaña Pagos y
comprobar las fechas de cada vencimiento, incluidos meses cortos, febrero bisiesto y cambio de
año.

**Acceptance Scenarios**:

1. **Given** el usuario en "Nuevo pago", **When** guarda "Arriendo", $1.200.000, mensual, primer
   vencimiento 5 de diciembre de 2026, **Then** el pago queda Activo y vence el 5 de diciembre de
   2026, el 5 de enero de 2027, el 5 de febrero de 2027, y así cada mes.
2. **Given** un pago mensual con primer vencimiento el 31 de enero de 2027, **When** el usuario
   mira los meses siguientes, **Then** vence el 28 de febrero, el 31 de marzo y el 30 de abril de
   2027 (el día 31 se conserva y solo se ajusta en los meses que no lo tienen).
3. **Given** un pago mensual con primer vencimiento el 30 de enero de 2028, **When** el usuario
   mira febrero de 2028, **Then** vence el 29 de febrero de 2028 (año bisiesto).
4. **Given** un pago anual con primer vencimiento el 29 de febrero de 2028, **When** el usuario
   mira febrero de 2029 y de 2032, **Then** vence el 28 de febrero de 2029 y el 29 de febrero de
   2032.
5. **Given** un pago anual "SOAT" con primer vencimiento el 10 de marzo de 2027, **When** el
   usuario mira marzo de 2027 y de 2028, **Then** aparece en ambos con fecha 10 de marzo y no
   aparece en los demás meses.
6. **Given** un pago mensual con primer vencimiento el 15 de diciembre de 2026, **When** el
   usuario mira enero de 2027, **Then** vence el 15 de enero de 2027 (cambio de año).
7. **Given** datos inválidos (nombre vacío o de más de 40 caracteres, monto vacío, 0, con
   decimales o mayor que el máximo, fecha anterior al primer día del mes actual o a más de 12
   meses de hoy), **When** el usuario intenta guardar, **Then** ve qué corregir en cada campo y no
   se crea nada.
8. **Given** el usuario crea un pago con primer vencimiento el 5 de noviembre y hoy es 23 de
   noviembre, **When** guarda, **Then** la ocurrencia de noviembre aparece como Vencida (puede
   marcarla pagada de inmediato).

---

### User Story 2 - Pagos del mes en el inicio (Priority: P1)

Como usuario quiero ver en el inicio, debajo del resumen de mis tarjetas, cuánto suman mis pagos
fijos de este mes, cuánto llevo pagado y cuánto me falta, y cuáles están vencidos, para no olvidar
ninguno.

**Why this priority**: es la parte de HU-08 que faltaba y el objetivo del MVP ("nunca pagar tarde").

**Independent Test**: con varios pagos en el mes actual en distintos estados, abrir el inicio y
comprobar totales, orden y estados.

**Acceptance Scenarios**:

1. **Given** hoy 23 de noviembre de 2026 y en noviembre: arriendo $1.200.000 Pagado, internet
   $95.000 Pagado, celular $65.000 Pendiente (vence el 28) y gimnasio $120.000 Vencido (venció el
   10), **When** el usuario abre el inicio, **Then** ve "Pagos de noviembre" con Total del mes
   $1.480.000, Pagado $1.295.000 y "Faltan $185.000".
2. **Given** el mismo mes, **When** el usuario mira la lista, **Then** el orden es: gimnasio
   (Vencido), celular (Pendiente), y luego arriendo e internet (Pagado); cada fila muestra nombre,
   fecha ("10 nov"), monto y el estado escrito.
3. **Given** varios Vencidos o varios Pendientes, **When** se listan, **Then** dentro de cada
   grupo van por fecha de vencimiento, de la más antigua a la más reciente (y por nombre si
   coinciden); los Pagados también por fecha.
4. **Given** el celular marcado como pagado con monto real $70.000, **When** el usuario vuelve al
   inicio, **Then** Pagado es $1.365.000, Total del mes $1.485.000 y "Faltan $185.000" pasa a
   "Faltan $120.000" (el celular cuenta con $70.000, no con $65.000).
5. **Given** la sección en el inicio, **When** el usuario toca "Nuevo", **Then** se abre "Nuevo
   pago"; al guardar vuelve al inicio con el pago en la lista si vence este mes.
6. **Given** un usuario sin pagos recurrentes, **When** abre el inicio, **Then** la sección muestra
   una invitación a crear el primero ("Agrega tus pagos fijos" con el botón "Nuevo").
7. **Given** pagos recurrentes que no vencen este mes, **When** el usuario abre el inicio, **Then**
   la sección dice "Sin pagos este mes", con totales en $0 y el botón "Nuevo".
8. **Given** un usuario sin tarjetas activas, **When** abre el inicio, **Then** ve la invitación a
   crear su primera tarjeta (spec 004) y debajo la sección de pagos del mes.
9. **Given** una fila de la lista, **When** el usuario la toca, **Then** abre el detalle de esa
   ocurrencia (historia 3).

---

### User Story 3 - Marcar una ocurrencia como pagada y deshacerlo (Priority: P1)

Como usuario quiero marcar un pago del mes como pagado, con el monto real si fue distinto, y
deshacerlo si me equivoqué.

**Why this priority**: sin esto los estados y totales del mes no reflejan la realidad.

**Independent Test**: marcar una ocurrencia con y sin monto real, comprobar estado y totales,
deshacer y comprobar que vuelve a Pendiente o Vencido.

**Acceptance Scenarios**:

1. **Given** el detalle de la ocurrencia del celular ($65.000, Pendiente), **When** el usuario
   toca "Marcar pagado" sin cambiar el monto, **Then** queda Pagado con monto real $65.000 y la
   fecha de hoy como fecha de pago.
2. **Given** el mismo detalle, **When** el usuario escribe $70.000 como monto real y confirma,
   **Then** queda Pagado con $70.000 y el detalle muestra "Esperado $65.000 · Pagado $70.000".
3. **Given** una ocurrencia Pagada, **When** el usuario toca "Deshacer pago", **Then** vuelve a
   Pendiente o Vencido según su fecha, el monto real se descarta y los totales se recalculan.
4. **Given** una ocurrencia Vencida, **When** el usuario la marca pagada, **Then** queda Pagado
   (marcar pagado no depende de la fecha).
5. **Given** una ocurrencia de un mes siguiente (pago adelantado), **When** el usuario la marca
   pagada, **Then** queda Pagado y cuenta en los totales de su mes, no del actual.
6. **Given** un monto real inválido (0, con decimales o mayor que el máximo), **When** el usuario
   confirma, **Then** ve qué corregir y la ocurrencia no cambia.

---

### User Story 4 - Pestaña Pagos: vista por mes y mis pagos (Priority: P1)

Como usuario quiero una pestaña Pagos donde recorro mis pagos mes a mes y administro la lista de
mis pagos recurrentes.

**Why this priority**: es donde se crean, revisan y administran los pagos; completa la barra
inferior del diseño.

**Independent Test**: abrir la pestaña Pagos, ir a meses anteriores y siguientes comparando
totales y estados, y abrir cada pago de "Mis pagos".

**Acceptance Scenarios**:

1. **Given** la barra inferior, **When** el usuario la ve en cualquier pestaña, **Then** tiene, en
   este orden, Inicio, Tarjetas, el botón central "Registrar compra", Pagos y Perfil.
2. **Given** la pestaña Pagos, **When** se abre, **Then** muestra el mes actual con el mismo
   resumen y la misma lista ordenada del inicio, y controles "mes anterior" y "mes siguiente".
3. **Given** el mes actual, **When** el usuario va al mes siguiente, **Then** ve las ocurrencias
   de ese mes de sus pagos activos como Pendientes con sus totales; **When** va a un mes anterior,
   **Then** ve lo que pagó y lo que quedó vencido ese mes.
4. **Given** un mes 12 meses después del actual, **When** el usuario lo ve, **Then** el control
   "mes siguiente" ya no avanza; hacia atrás puede llegar hasta el mes del primer vencimiento más
   antiguo de sus pagos.
5. **Given** la pestaña Pagos, **When** el usuario abre "Mis pagos", **Then** ve todos sus pagos
   recurrentes con nombre, monto esperado, frecuencia ("Mensual · día 5", "Anual · 10 mar") y
   estado (Activo o Pausado escrito), y el botón "Nuevo".
6. **Given** "Mis pagos", **When** el usuario toca un pago, **Then** ve su detalle con sus datos,
   su próximo vencimiento y las acciones Editar, Pausar (o Reanudar) y Eliminar.

---

### User Story 5 - Editar un pago recurrente (Priority: P2)

Como usuario quiero cambiar el nombre, el monto, la frecuencia o la fecha de un pago cuando
cambian (subió el arriendo), sin alterar lo que ya pagué.

**Why this priority**: los montos fijos cambian algunas veces al año; sin editar habría que borrar
y crear de nuevo, perdiendo el historial.

**Independent Test**: con ocurrencias pagadas, vencidas y futuras, editar monto y fecha y
comprobar qué ocurrencias cambiaron.

**Acceptance Scenarios**:

1. **Given** "Arriendo" $1.200.000 con noviembre Pagado y hoy 23 de noviembre, **When** el usuario
   cambia el monto a $1.300.000, **Then** diciembre en adelante muestran $1.300.000 y noviembre
   sigue Pagado con $1.200.000.
2. **Given** "Gimnasio" con noviembre Vencido (10 nov) y hoy 23 de noviembre, **When** el usuario
   cambia el monto, **Then** la ocurrencia vencida de noviembre conserva su monto (no es futura).
3. **Given** "Internet" mensual día 5 y hoy 23 de noviembre, **When** el usuario cambia el próximo
   vencimiento al 20 de diciembre, **Then** vence el 20 de diciembre, el 20 de enero y así; las
   ocurrencias pagadas y vencidas anteriores no cambian.
4. **Given** "Celular" con vencimiento el 28 de noviembre (Pendiente, hoy 23), **When** el usuario
   cambia el día al 25, **Then** la ocurrencia de noviembre pasa al 25 de noviembre.
5. **Given** un pago con diciembre ya pagado por adelantado, **When** el usuario cambia la fecha
   o el monto, **Then** diciembre sigue Pagado con sus datos y no aparece otra ocurrencia en
   diciembre.
6. **Given** cualquier edición, **When** se cambia el nombre, **Then** el nombre nuevo se ve en
   todas las ocurrencias del pago, incluidas las pagadas.
7. **Given** el formulario de edición, **When** el usuario escribe datos inválidos (las reglas de
   la historia 1, con el próximo vencimiento entre hoy y 12 meses después), **Then** ve qué
   corregir y nada cambia.

---

### User Story 6 - Pausar y reanudar un pago (Priority: P2)

Como usuario quiero pausar un pago que dejo de tener por un tiempo (gimnasio en vacaciones) y
reanudarlo después, sin perder su historial.

**Why this priority**: evita borrar y crear de nuevo pagos temporales; es parte explícita de HU-07.

**Independent Test**: pausar un pago, recorrer meses siguientes, reanudarlo en otro mes y
comprobar desde cuándo vuelve a aparecer.

**Acceptance Scenarios**:

1. **Given** "Gimnasio" Activo con noviembre Pendiente, **When** el usuario lo pausa, **Then** el
   pago queda Pausado, la ocurrencia de noviembre se mantiene Pendiente y en diciembre en adelante
   no aparece.
2. **Given** "Gimnasio" mensual día 10, pausado desde noviembre, **When** el usuario lo reanuda el
   3 de febrero de 2027, **Then** vuelve a aparecer desde el 10 de febrero de 2027 en adelante;
   diciembre y enero no tienen ocurrencia.
3. **Given** el mismo pago, **When** el usuario lo reanuda el 15 de febrero de 2027 (el día 10 ya
   pasó), **Then** la primera ocurrencia nueva es la del 10 de marzo de 2027; febrero no tiene
   ocurrencia y no aparece nada Vencido por reanudar.
4. **Given** un pago pausado y reanudado en el mismo mes, cuya ocurrencia de ese mes se conservó al
   pausar, **When** se reanuda, **Then** ese mes no tiene dos ocurrencias.
5. **Given** un pago anual pausado, **When** se reanuda después de su fecha de este año, **Then**
   la siguiente ocurrencia es la del año próximo; si se reanuda en su fecha o antes, es la de este
   año.
6. **Given** un pago Pausado, **When** el usuario mira "Mis pagos", **Then** lo ve con el estado
   "Pausado" escrito y la acción "Reanudar".

---

### User Story 7 - Eliminar un pago (Priority: P2)

Como usuario quiero eliminar un pago que ya no tengo, conservando lo que pagué.

**Why this priority**: mantiene la lista limpia sin perder el historial de gastos.

**Independent Test**: con ocurrencias pagadas y pendientes, eliminar el pago y comprobar los meses
pasados y futuros.

**Acceptance Scenarios**:

1. **Given** "Gimnasio" con octubre Pagado y noviembre Vencido, **When** el usuario lo elimina y
   confirma, **Then** desaparece de "Mis pagos", noviembre ya no muestra la ocurrencia vencida y
   los meses siguientes no lo muestran.
2. **Given** el mismo pago eliminado, **When** el usuario mira octubre, **Then** sigue viendo
   "Gimnasio" Pagado con su monto real y los totales de octubre no cambian.
3. **Given** el botón "Eliminar", **When** el usuario lo toca, **Then** se le pide confirmación
   explicando que se conserva lo pagado; si cancela, nada cambia.
4. **Given** una ocurrencia pagada de un pago eliminado, **When** el usuario abre su detalle,
   **Then** la ve sin la opción "Deshacer pago" y con la indicación de que el pago fue eliminado.

---

### User Story 8 - Mis pagos son solo míos (Priority: P1)

Como usuario quiero que nadie pueda ver ni modificar mis pagos recurrentes.

**Why this priority**: principio de aislamiento por usuario de la constitución.

**Independent Test**: pruebas automáticas con dos usuarios.

**Acceptance Scenarios**:

1. **Given** dos usuarios A y B, **When** B intenta ver, editar, pausar, reanudar o eliminar un
   pago de A, o marcar o deshacer una ocurrencia de A, **Then** recibe la misma respuesta que para
   uno inexistente y no se revela nada de A.
2. **Given** dos usuarios, **When** cada uno abre el inicio, la vista por mes o "Mis pagos",
   **Then** solo ve sus propios pagos y totales.

---

### Edge Cases

- **Vence hoy**: una ocurrencia no pagada con fecha de hoy es Pendiente, no Vencida.
- **Cambio de día**: con la app abierta de un día para otro, al volver una ocurrencia Pendiente
  cuya fecha pasó se muestra Vencida, según el nuevo "hoy" del servidor.
- **Cambio de zona horaria** (spec 002): estados y "mes actual" se recalculan con la nueva zona;
  las fechas de vencimiento guardadas no cambian.
- **Primer vencimiento en un mes futuro**: los meses anteriores a ese no tienen ocurrencia del
  pago; el inicio no lo muestra hasta su mes.
- **Pago anual con primer vencimiento en otro mes**: no aparece en el inicio ni en el mes actual
  hasta su mes.
- **Pago adelantado y luego pausado o eliminado**: las ocurrencias futuras ya pagadas se conservan
  (lo pagado nunca se borra).
- **Deshacer el pago de una ocurrencia después de editar el pago**: la ocurrencia vuelve con su
  propia fecha y monto esperado, sin tomar los del pago editado.
- **Deshacer el pago de una ocurrencia de un pago Pausado**: se permite; vuelve a Pendiente o
  Vencida y se mantiene, como las pendientes existentes al pausar.
- **Editar un pago Pausado**: se permite; los cambios aplican a las ocurrencias pendientes futuras
  existentes y a las que se generen al reanudar.
- **Nombres repetidos**: se permiten dos pagos con el mismo nombre; se distinguen por fecha y
  monto.
- **Montos muy grandes** (máximo de la spec 002): las cifras no se cortan ni se desbordan.
- **Sin conexión o error**: cada pantalla muestra un mensaje con reintento; nada se marca como
  pagado si el servidor no lo confirmó.

## Requirements *(mandatory)*

### Functional Requirements

**Pagos recurrentes**

- **FR-001**: El usuario MUST poder crear un pago recurrente con nombre (1 a 40 caracteres, sin
  espacios sobrantes), monto esperado (pesos enteros de 1 al máximo de la spec 002), frecuencia
  (Mensual o Anual) y fecha del primer vencimiento (desde el primer día del mes actual hasta 12
  meses después de hoy). Se crea Activo.
- **FR-002**: Las fechas de vencimiento MUST calcularse en el dominio a partir de la fecha de
  referencia: mensual, el mismo día cada mes; anual, el mismo día y mes cada año. Si el día no
  existe en el mes, se usa el último día del mes, sin mover el día de los meses siguientes (31 de
  enero → 28 de febrero → 31 de marzo).
- **FR-003**: Cada pago MUST tener como máximo una ocurrencia por periodo, desde el periodo de su
  fecha de referencia en adelante.
- **FR-004**: El usuario MUST poder editar nombre, monto esperado, frecuencia y próximo
  vencimiento (entre hoy y 12 meses después). El nombre aplica a todas las ocurrencias; monto,
  frecuencia y fecha aplican solo a las ocurrencias no pagadas con fecha de hoy en adelante, que
  se recalculan desde el nuevo próximo vencimiento. Las ocurrencias pagadas y las vencidas MUST
  NOT cambiar, y un periodo que ya tiene una ocurrencia pagada MUST NOT recibir otra.
- **FR-005**: El usuario MUST poder pausar un pago Activo: deja de tener ocurrencias en los
  periodos posteriores al actual y conserva las existentes hasta el periodo actual (pagadas, vencidas y
  pendientes) y las futuras ya pagadas.
- **FR-006**: El usuario MUST poder reanudar un pago Pausado: vuelve a tener ocurrencias desde su
  próximo vencimiento igual o posterior a hoy en adelante; los vencimientos entre la pausa y ese
  próximo vencimiento quedan sin ocurrencia, y reanudar MUST NOT crear ocurrencias Vencidas ni
  una segunda ocurrencia en un periodo que ya tiene una.
- **FR-007**: El usuario MUST poder eliminar un pago, con confirmación: se borran el pago y sus
  ocurrencias no pagadas; las pagadas se conservan con su nombre, fecha y montos y siguen contando
  en los totales de su mes.

**Ocurrencias**

- **FR-008**: El estado de una ocurrencia MUST ser Pagado si está marcada, Vencido si no lo está y
  su fecha es anterior a hoy, y Pendiente en otro caso, con el "hoy" del servidor en la zona del
  usuario.
- **FR-009**: El usuario MUST poder marcar como pagada cualquier ocurrencia no pagada (de cualquier
  mes visible), con un monto real opcional (pesos enteros de 1 al máximo; por defecto, el
  esperado). Se guarda la fecha de hoy como fecha de pago.
- **FR-010**: El usuario MUST poder deshacer el pago de una ocurrencia pagada de un pago que no
  fue eliminado: vuelve a Pendiente o Vencido según su fecha y se descarta el monto real.
- **FR-011**: Los pagos recurrentes MUST NOT sumar ni restar al cupo, la deuda, los extractos ni
  el tope de ninguna tarjeta.

**Vista del mes**

- **FR-012**: Para un mes dado, el sistema MUST devolver los pagos del mes con Total del mes,
  Pagado y Falta según las definiciones de esta spec, y la lista ordenada: Vencidos, Pendientes y
  Pagados; dentro de cada grupo por fecha de vencimiento ascendente y luego por nombre.
- **FR-013**: Cada fila MUST mostrar nombre, fecha corta ("10 nov"), monto (real si está pagada,
  esperado si no) y el estado escrito (Vencido, Pendiente o Pagado).

**Inicio**

- **FR-014**: El inicio MUST mostrar, debajo del resumen de tarjetas (o de la invitación a crear
  tarjeta), la sección "Pagos de <mes actual>" con el botón "Nuevo", el Total del mes y lo Pagado
  (StatTile), lo que falta y la lista del mes (FR-012, FR-013).
- **FR-015**: Sin pagos recurrentes, la sección MUST invitar a crear el primero; con pagos pero sin
  ocurrencias este mes, MUST decir "Sin pagos este mes" con totales en $0.
- **FR-016**: Tocar una fila MUST abrir el detalle de la ocurrencia, con sus datos, su estado y las
  acciones Marcar pagado o Deshacer pago, y un acceso al pago recurrente si no fue eliminado.

**Pestaña Pagos**

- **FR-017**: La barra inferior MUST tener Inicio, Tarjetas, el botón central "Registrar compra",
  Pagos y Perfil, según el TabBar de `docs/design-system.md`.
- **FR-018**: La pestaña Pagos MUST mostrar la vista de un mes (empieza en el mes actual) con
  controles para ir al mes anterior y al siguiente, desde el mes del primer vencimiento más antiguo
  del usuario (o el actual, si es posterior) hasta 12 meses después del actual.
- **FR-019**: La pestaña Pagos MUST dar acceso a "Mis pagos": todos los pagos recurrentes no
  eliminados con nombre, monto esperado, frecuencia con su día ("Mensual · día 5", "Anual · 10 mar")
  y estado escrito (Activo o Pausado), el botón "Nuevo" y el detalle de cada pago con su próximo
  vencimiento (si está Activo) y las acciones Editar, Pausar o Reanudar y Eliminar.

**Actualización, aislamiento, formato y diseño**

- **FR-020**: El inicio, la vista por mes y "Mis pagos" MUST mostrar los datos actualizados después
  de crear, editar, pausar, reanudar o eliminar un pago y de marcar o deshacer un pago de una
  ocurrencia, y al volver a la app en otro día, sin recargar a mano.
- **FR-021**: Toda lectura y cambio de pagos y ocurrencias MUST limitarse a los del usuario; uno de
  otro usuario MUST responder igual que uno inexistente. MUST existir pruebas automáticas con dos
  usuarios para cada operación.
- **FR-022**: El cálculo de fechas de vencimiento, estados y totales del mes MUST vivir en el
  dominio con pruebas de meses cortos, febrero de año bisiesto y no bisiesto, día 29, 30 y 31, y
  cambio de año.
- **FR-023**: Los montos MUST ser pesos enteros y mostrarse como en las specs anteriores (sin
  decimales, separador de miles); las fechas en formato corto en listas ("10 nov") y largo en el
  detalle.
- **FR-024**: La sección del inicio, la pestaña Pagos, los formularios y los detalles MUST seguir
  `docs/design-system.md` (tokens del tema, contraste AA, áreas táctiles de al menos 44, montos
  tabulares, estados escritos) y ser accesibles con VoiceOver y TalkBack (cada fila se lee como una
  frase: nombre, fecha, monto y estado).

### Key Entities

- **Pago recurrente**: pertenece a un usuario; nombre, monto esperado, frecuencia (mensual o
  anual), fecha de referencia, estado (Activo o Pausado), desde cuándo está activo (para saber qué
  periodos se saltan al reanudar). No se relaciona con ninguna tarjeta.
- **Ocurrencia**: pertenece a un pago recurrente (o queda como historial si el pago se eliminó y
  estaba pagada); periodo, fecha de vencimiento, monto esperado, y si se pagó, monto real y fecha
  de pago. Su estado (Pendiente, Vencido o Pagado) se deriva de la fecha y de "hoy".
- **Resumen del mes** (derivado): mes, Total del mes, Pagado, Falta y la lista ordenada de
  ocurrencias.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las fechas de vencimiento de los escenarios de la historia 1 (meses
  cortos, bisiesto, día 31 y cambio de año) coinciden con las esperadas.
- **SC-002**: Con los datos de noviembre de la historia 2, el inicio muestra Total $1.480.000,
  Pagado $1.295.000 y Faltan $185.000; con el monto real de $70.000, Pagado cuenta $70.000 por el
  celular. En cualquier mes, Total = Pagado + Falta en el 100% de los casos.
- **SC-003**: Un usuario sabe cuánto le falta pagar este mes y qué está vencido en menos de 5
  segundos después de abrir la app, sin tocar nada.
- **SC-004**: Un usuario crea un pago recurrente en menos de 30 segundos y marca una ocurrencia
  como pagada en menos de 10 segundos desde el inicio.
- **SC-005**: Después de editar, pausar, reanudar o eliminar un pago, el 100% de las ocurrencias
  pagadas conservan su fecha, monto esperado y monto real.
- **SC-006**: En las pruebas con dos usuarios, el 100% de los intentos de leer o modificar pagos u
  ocurrencias ajenas se rechazan como inexistentes.
- **SC-007**: Ningún pago recurrente cambia el cupo, la deuda, los extractos ni el tope de una
  tarjeta.
- **SC-008**: La sección del inicio y la pestaña Pagos cumplen el sistema de diseño: contraste AA
  y áreas táctiles de al menos 44 en el 100% de los elementos, y todos los estados se entienden sin
  depender del color.
- **SC-009**: La cobertura de las pruebas del dominio sigue en al menos 95%.

## Assumptions

- **Cambio de orden de specs**: esta es la spec 005; alertas y recordatorios (HU-06) pasan a la
  006. Se actualizan el orden en `docs/mvp-spec.md` y la nota del TabBar en
  `docs/design-system.md`; las specs ya cerradas (004) no se reescriben.
- **Primer vencimiento**: desde el primer día del mes actual (para registrar un pago de este mes
  que ya venció o ya se pagó) hasta 12 meses después de hoy (alcanza para un pago anual). No se
  cargan meses anteriores.
- **"Futuras" al editar**: son las ocurrencias no pagadas con fecha de hoy en adelante; una
  vencida conserva su monto y fecha porque ya debía pagarse con el valor anterior.
- **Pausar conserva el periodo actual**: la ocurrencia del mes en curso (o del año, si es anual) se
  mantiene aunque aún no venza, como pide "las pendientes existentes se mantienen"; los meses
  siguientes muestran el pago solo si está Activo.
- **Reanudar desde hoy**: al reanudar, las ocurrencias vuelven desde el próximo vencimiento igual o
  posterior a hoy (si vence hoy, cuenta), no desde el mes actual si su día ya pasó; así reanudar
  nunca deja un pago Vencido de un periodo en que estuvo pausado.
- **Meses futuros**: la vista de un mes futuro muestra las ocurrencias que tendrán los pagos
  activos; se pueden marcar pagadas por adelantado.
- **Navegación**: hasta 12 meses después del actual; hacia atrás, hasta el mes del primer
  vencimiento más antiguo del usuario, porque antes no hay datos.
- **Fecha de pago**: es la de hoy al marcar; no se elige otra en el MVP.
- **Monto real**: si no se escribe, es igual al esperado; un monto real de $0 no se acepta (para
  "no lo pagué" la ocurrencia queda sin marcar).
- **Historial de eliminados**: las ocurrencias pagadas de un pago eliminado solo se ven en la
  vista de su mes y su detalle; no se pueden deshacer ni editar.
- **Botón de notificaciones del saludo y recordatorios**: llegan con la spec 006.
- **Sin tarjeta**: cargar un pago recurrente a una tarjeta y otras frecuencias (quincenal, semanal,
  bimestral) quedan para la v2.
