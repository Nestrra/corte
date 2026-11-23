# Feature Specification: Compras, cuotas y extractos

**Feature Branch**: `003-purchases`

**Created**: 2026-11-23

**Status**: Draft

**Reference**: `docs/mvp-spec.md` → HU-03, HU-04, reglas de negocio "Ciclos y extractos" 4, 5 y 6,
"Cuotas" 1 a 5 y "Cupo, tope y alertas" 1, 2 y 4 (con los ajustes de esta spec);
`specs/002-cards/spec.md` → reglas de ciclo FR-001 a FR-006.

**Input**: User description: "Spec 003 — Compras, cuotas y extractos. Corresponde a HU-03 y HU-04
de docs/mvp-spec.md, con las reglas de 'Cuotas' y 'Cupo, tope y alertas' 1, 2 y 4. Ajustes a esas
reglas decididos con un extracto real de Davivienda: la tasa de interés EA (%) es un campo
opcional de la tarjeta (0 a 100, con hasta 2 decimales), que se agrega al formulario de tarjeta de
la spec 002. Registrar una compra pide solo valor, concepto, fecha (por defecto hoy) y número de
cuotas (1 a 72, por defecto 1), más un interruptor 'Sin intereses' apagado por defecto. Cada
compra guarda la tasa vigente de la tarjeta al registrarse; cambiar la tasa de la tarjeta no
altera compras anteriores. Con 1 cuota, con 'Sin intereses' o con tasa vacía, el interés es 0.
Abono a capital por cuota = floor(valor / n); la última cuota absorbe el residuo. Interés estimado
de la cuota k = saldo de capital antes de la cuota × tasa mensual equivalente
(EM = (1+EA)^(1/12) − 1), redondeado al peso; se muestra como 'estimado'. La cuota k cae en el
extracto k − 1 ciclos después del de la compra. Historias: registrar una compra desde el detalle
de la tarjeta y ver en qué extracto cae la primera cuota y cuándo se paga; editar y borrar una
compra; ver los extractos con fecha de corte, fecha límite, 'A pagar' y estado (abierto, por
pagar, pagado, vencido); ver el detalle de un extracto con sus cuotas; marcar un extracto como
pagado y deshacerlo; ver el cupo disponible real y la 'Deuda total'; recalcular los extractos
abiertos al cambiar las fechas de la tarjeta; avisar si una compra supera el cupo disponible pero
dejar guardarla. Criterios: $3.090.000 a 30 cuotas abona $103.000 por cuota; $4.765.548 a 60
cuotas abona $79.425 en las primeras 59 y el residuo en la última; con corte 8 y pago 25, una
compra del 9 de noviembre a 3 cuotas cae en los extractos del 8 de diciembre, 8 de enero y 8 de
febrero; una compra a 1 cuota no genera interés; aislamiento entre usuarios. Fuera de alcance
(v2): interés por días, avances y comisiones, compras en dólares, pago mínimo y pagos parciales,
intereses de mora."

## User Scenarios & Testing *(mandatory)*

Actor: **usuario** con sesión iniciada (spec 001) que tiene al menos una tarjeta (spec 002). Todas
las fechas se interpretan en su zona horaria (por defecto America/Bogota) y "hoy" es la fecha en
esa zona.

Términos usados en esta spec (además de los de la spec 002):

- **Compra**: un gasto con una tarjeta: valor, concepto, fecha, número de cuotas (n), si es "sin
  intereses" y la tasa EA de la tarjeta en el momento de registrarla.
- **Cuota k** (k = 1..n): la parte de una compra que se paga en un extracto. Tiene un **abono**
  (capital) y un **interés estimado**.
- **Extracto**: lo que se paga de una tarjeta por un corte. Tiene fecha de corte, fecha límite,
  sus cuotas, "A pagar" (suma de abonos más intereses estimados de sus cuotas) y un estado.
- **Estado de un extracto**: **Abierto** mientras hoy es igual o anterior a la fecha de corte;
  **Por pagar** después del corte y hasta la fecha límite inclusive; **Vencido** después de la
  fecha límite; **Pagado** cuando el usuario lo marca, sin importar las fechas.
- **Extracto cerrado**: el que ya no está abierto (su fecha de corte es anterior a hoy).
- **Capital pendiente / Deuda total**: suma de los abonos de todas las cuotas de la tarjeta que
  están en extractos no pagados.
- **Cupo disponible**: cupo total − capital pendiente.
- **Tasa mensual equivalente (EM)**: EM = (1 + EA)^(1/12) − 1, con EA en fracción (26,82% → 0,2682).

### User Story 1 - Cuotas e intereses correctos (Priority: P1)

Como usuario quiero que, dada una compra, Corte calcule bien cuánto abono a capital y cuánto
interés estimado tiene cada cuota, y en qué extracto cae, igual a como lo hace mi banco.

**Why this priority**: es la regla de la que dependen todos los montos de la app (extractos, cupo,
deuda, simulador y alertas de las specs siguientes); un error aquí da cifras falsas en todas
partes.

**Independent Test**: se verifica sin pantallas, con las pruebas automáticas del dominio, dando
valor, cuotas, tasa, fecha de compra, día de corte y día límite y comparando con el plan esperado.

**Acceptance Scenarios**:

1. **Given** una compra de $3.090.000 a 30 cuotas, **When** se calcula su plan, **Then** cada una
   de las 30 cuotas abona $103.000.
2. **Given** una compra de $4.765.548 a 60 cuotas, **When** se calcula su plan, **Then** las
   primeras 59 cuotas abonan $79.425 y la última $79.473, y la suma de los 60 abonos es
   exactamente $4.765.548.
3. **Given** una tarjeta con corte 8 y pago 25, **When** se registra una compra del 9 de noviembre
   de 2026 a 3 cuotas, **Then** las cuotas caen en los extractos de corte 8 de diciembre de 2026
   (límite 25 de diciembre), 8 de enero de 2027 (límite 25 de enero) y 8 de febrero de 2027
   (límite 25 de febrero).
4. **Given** una compra a 1 cuota con una tarjeta de tasa 26,82% EA, **When** se calcula su plan,
   **Then** el interés de la cuota es $0.
5. **Given** una compra de $1.200.000 a 12 cuotas con tasa 24% EA, **When** se calcula su plan,
   **Then** cada cuota abona $100.000 y los intereses estimados son $21.705 en la cuota 1 (saldo
   $1.200.000), $19.896 en la cuota 2 (saldo $1.100.000), $18.088 en la cuota 3 (saldo
   $1.000.000) y $1.809 en la cuota 12 (saldo $100.000).
6. **Given** una compra a varias cuotas marcada "Sin intereses", o hecha con una tarjeta sin tasa,
   **When** se calcula su plan, **Then** todas las cuotas tienen interés $0.
7. **Given** una tarjeta con corte 31, **When** una compra del 15 de enero de 2027 se hace a 3
   cuotas, **Then** caen en los cortes del 31 de enero, 28 de febrero y 31 de marzo de 2027 (el
   ajuste de fin de mes de la spec 002 aplica mes a mes).

---

### User Story 2 - Registrar una compra (Priority: P1)

Como usuario quiero registrar una compra desde el detalle de la tarjeta y, al guardarla, ver en
qué extracto cae la primera cuota y cuándo se paga.

**Why this priority**: es la acción principal del producto (HU-03); sin compras no hay extractos
ni cupo real.

**Independent Test**: desde el detalle de una tarjeta, registrar una compra y ver la confirmación
con el extracto y la fecha de pago de la primera cuota.

**Acceptance Scenarios**:

1. **Given** el detalle de una tarjeta activa con corte 8 y pago 25 y hoy 9 de noviembre de 2026,
   **When** el usuario toca "Registrar compra", escribe valor $300.000 y concepto "Mercado" sin
   tocar fecha ni cuotas, y guarda, **Then** la compra se guarda con fecha 9 de noviembre de 2026,
   1 cuota, y la app confirma "Primera cuota en el extracto del 8 de diciembre de 2026 · se paga
   el 25 de diciembre de 2026".
2. **Given** el formulario de compra, **When** el usuario lo abre, **Then** ve valor, concepto,
   fecha (hoy), cuotas (1) y el interruptor "Sin intereses" apagado; si la tarjeta tiene tasa, ve
   también la tasa que se aplicará, marcada como estimada.
3. **Given** el formulario, **When** el usuario ingresa valor en cero o negativo, concepto vacío,
   cuotas fuera de 1–72 o una fecha posterior a hoy, **Then** se indica qué campo corregir y la
   compra no se guarda.
4. **Given** una tarjeta con cupo disponible de $500.000, **When** el usuario registra una compra
   de $800.000, **Then** la app avisa que la compra supera el cupo disponible, muestra el cupo
   disponible y, si el usuario confirma, guarda la compra.
5. **Given** una compra registrada, **When** el usuario vuelve al detalle de la tarjeta, **Then**
   el cupo disponible, la deuda total y el carrusel reflejan la compra sin recargar.
6. **Given** una tarjeta archivada, **When** el usuario abre su detalle, **Then** no ve la acción
   "Registrar compra".

---

### User Story 3 - Ver extractos y su detalle (Priority: P1)

Como usuario quiero ver los extractos de cada tarjeta con su fecha de corte, fecha límite, monto a
pagar y estado, y entrar a cada uno para ver sus cuotas.

**Why this priority**: responde a "cuánto pago y cuándo" (HU-04), el objetivo del MVP de no pagar
tarde.

**Independent Test**: con una tarjeta con compras a varias cuotas, abrir la lista de extractos y
el detalle de uno, y comparar con el plan de cuotas de las compras.

**Acceptance Scenarios**:

1. **Given** una tarjeta con compras, **When** el usuario abre "Extractos" desde el detalle de la
   tarjeta, **Then** ve cada extracto con fecha de corte, fecha límite, "A pagar" y estado en
   texto (Abierto, Por pagar, Pagado o Vencido).
2. **Given** hoy 23 de noviembre de 2026 y una tarjeta con corte 8 y pago 25, **When** el usuario
   ve sus extractos, **Then** el del 8 de noviembre aparece "Por pagar", el del 8 de diciembre
   "Abierto" y, si el del 8 de octubre no se marcó pagado, "Vencido".
3. **Given** un extracto, **When** el usuario lo abre, **Then** ve cada cuota con el concepto de
   la compra, el número de cuota ("3 de 12"), el abono y el interés marcado como estimado, y el
   total "A pagar".
4. **Given** un extracto que tiene intereses, **When** el usuario lo ve en la lista o en el
   detalle, **Then** el monto "A pagar" se indica como estimado.
5. **Given** una tarjeta sin compras, **When** el usuario abre "Extractos", **Then** ve un mensaje
   de que aún no hay extractos y la invitación a registrar una compra.

---

### User Story 4 - Marcar un extracto como pagado (Priority: P1)

Como usuario quiero marcar un extracto como pagado cuando le pago al banco, y deshacerlo si me
equivoqué.

**Why this priority**: sin pagos registrados, los extractos aparecen vencidos y el cupo
disponible nunca se libera.

**Independent Test**: marcar un extracto "Por pagar" como pagado, ver su estado y el cupo
disponible actualizados, y deshacerlo.

**Acceptance Scenarios**:

1. **Given** un extracto "Por pagar" o "Vencido", **When** el usuario toca "Marcar como pagado" y
   confirma, **Then** queda "Pagado" con la fecha de pago y el monto pagado (su "A pagar" en ese
   momento), y el cupo disponible aumenta en la suma de sus abonos.
2. **Given** un extracto pagado, **When** el usuario toca "Deshacer pago", **Then** vuelve al
   estado que le corresponde por fechas y el cupo disponible vuelve a descontar sus abonos.
3. **Given** un extracto "Abierto", **When** el usuario lo ve, **Then** no puede marcarlo como
   pagado todavía (aún puede recibir compras).

---

### User Story 5 - Cupo disponible real y deuda total (Priority: P1)

Como usuario quiero ver en la tarjeta mi cupo disponible real, mi deuda total y cuánto llevo del
tope del ciclo, para saber cuánto más puedo gastar.

**Why this priority**: reemplaza el cupo provisional de la spec 002 por la cifra real; es lo que
el usuario consulta antes de comprar.

**Independent Test**: con una tarjeta de cupo $5.000.000, registrar una compra de $1.200.000 a 12
cuotas y comprobar cupo, deuda y tope antes y después de pagar un extracto.

**Acceptance Scenarios**:

1. **Given** una tarjeta de cupo $5.000.000 sin compras, **When** el usuario registra una compra
   de $1.200.000 a 12 cuotas, **Then** el carrusel y el detalle muestran cupo disponible
   $3.800.000 y el detalle muestra "Deuda total" $1.200.000.
2. **Given** esa compra, **When** el usuario marca pagado el extracto de la primera cuota, **Then**
   el cupo disponible pasa a $3.900.000 y la deuda total a $1.100.000 (los intereses no cuentan
   en la deuda ni en el cupo).
3. **Given** una tarjeta con tope por ciclo de $2.000.000 y cuotas por $900.000 en el extracto
   abierto, **When** el usuario abre el detalle, **Then** ve "Tope del ciclo: 45% · $900.000 de
   $2.000.000".
4. **Given** compras por encima del cupo, **When** el usuario ve la tarjeta, **Then** el cupo
   disponible se muestra negativo (por ejemplo "−$300.000") con un texto que indica que se superó
   el cupo.

---

### User Story 6 - Editar y borrar una compra (Priority: P2)

Como usuario quiero corregir o borrar una compra que registré mal, y que sus cuotas y los
extractos se recalculen.

**Why this priority**: los errores de digitación pasan, pero se puede vivir unos días sin
corregirlos.

**Independent Test**: cambiar el número de cuotas de una compra y ver sus cuotas y los extractos
recalculados; borrarla y ver que sus cuotas desaparecen.

**Acceptance Scenarios**:

1. **Given** una compra de $1.200.000 a 12 cuotas, **When** el usuario la edita a 6 cuotas,
   **Then** su plan pasa a 6 cuotas de $200.000 y los extractos de los meses 7 a 12 ya no la
   incluyen.
2. **Given** una compra, **When** el usuario cambia su fecha a otro ciclo, **Then** sus cuotas se
   mueven a los extractos que les corresponden.
3. **Given** una compra, **When** el usuario la borra con confirmación, **Then** sus cuotas
   desaparecen de los extractos, el cupo disponible y la deuda se actualizan, y los extractos que
   quedan sin cuotas y no están pagados desaparecen.
4. **Given** una compra registrada con tasa 26,82% EA, **When** el usuario cambia la tasa de la
   tarjeta a 30% y luego edita el valor de la compra, **Then** la compra conserva la tasa 26,82%.
5. **Given** una compra con alguna cuota en un extracto pagado, **When** el usuario la edita o la
   borra, **Then** el cambio se guarda, el extracto pagado sigue "Pagado" con el monto que se
   registró al pagarlo, su "A pagar" se recalcula y su detalle muestra los dos valores.

---

### User Story 7 - Recalcular extractos al cambiar las fechas de la tarjeta (Priority: P2)

Como usuario quiero que, si el banco me cambia el día de corte o de pago y lo edito en la
tarjeta, los extractos que aún no han cerrado se recalculen, sin tocar los que ya cerraron.

**Why this priority**: pasa pocas veces, pero si no se hace los extractos futuros quedan con
fechas falsas.

**Independent Test**: con compras a varias cuotas, cambiar el corte de 8 a 15 y comparar los
extractos antes y después.

**Acceptance Scenarios**:

1. **Given** hoy 23 de noviembre de 2026, una tarjeta con corte 8 y pago 25 y una compra del 9 de
   noviembre a 3 cuotas (extractos del 8 de diciembre, 8 de enero y 8 de febrero), **When** el
   usuario cambia el corte a 15 y el pago a 2, **Then** las cuotas pasan a los extractos del 15 de
   diciembre de 2026 (límite 2 de enero de 2027), 15 de enero (límite 2 de febrero) y 15 de
   febrero de 2027 (límite 2 de marzo), y los extractos del 8 que quedaron vacíos desaparecen.
2. **Given** el mismo cambio, **When** el usuario mira el extracto del 8 de noviembre (cerrado),
   **Then** conserva su fecha de corte, su fecha límite, sus cuotas y su estado.
3. **Given** un cambio de cupo, tope, tasa, nombre o color, **When** el usuario guarda, **Then**
   los extractos y las cuotas no cambian (el cupo disponible sí refleja el nuevo cupo).

---

### User Story 8 - Tasa de interés de la tarjeta (Priority: P2)

Como usuario quiero guardar en mi tarjeta la tasa de interés efectiva anual que me cobra el banco,
para que las compras a cuotas calculen intereses estimados.

**Why this priority**: sin tasa la app funciona (interés 0), pero los montos a pagar de compras a
cuotas quedan por debajo de los reales.

**Independent Test**: editar una tarjeta con tasa 26,82%, registrar una compra a 12 cuotas y ver
intereses estimados en su plan.

**Acceptance Scenarios**:

1. **Given** el formulario de tarjeta (crear o editar), **When** el usuario lo abre, **Then** ve
   el campo opcional "Tasa de interés EA (%)".
2. **Given** ese campo, **When** el usuario escribe "26,82", **Then** se guarda 26,82% y el
   detalle de la tarjeta lo muestra; vacío, la tarjeta queda sin tasa.
3. **Given** ese campo, **When** el usuario escribe un valor menor que 0, mayor que 100 o con más
   de 2 decimales, **Then** se indica qué corregir y no se guarda.

---

### User Story 9 - Mis compras y extractos son solo míos (Priority: P1)

Como usuario quiero que nadie más pueda ver ni modificar mis compras ni mis extractos.

**Why this priority**: aislamiento por usuario, principio no negociable de la constitución.

**Independent Test**: con dos cuentas, intentar desde una ver, editar, borrar o pagar compras y
extractos de la otra.

**Acceptance Scenarios**:

1. **Given** dos usuarios con compras, **When** uno intenta listar compras o extractos de una
   tarjeta del otro, ver, editar o borrar una compra del otro, o ver, pagar o deshacer el pago de
   un extracto del otro, **Then** la respuesta es la misma que para un recurso que no existe y
   nada del otro usuario cambia.
2. **Given** un usuario que registra una compra, **When** indica una tarjeta de otro usuario,
   **Then** la respuesta es la misma que para una tarjeta inexistente y no se guarda nada.
3. **Given** un usuario que elimina su cuenta, **When** se completa la eliminación, **Then** sus
   compras, cuotas y extractos se borran con ella.

---

### Edge Cases

- **Compra el día de corte**: cae en el extracto de ese mismo corte (spec 002); su primera cuota
  se paga en la fecha límite de ese corte.
- **Compra con fecha pasada** (cargar compras ya hechas o deudas en curso): sus cuotas caen en los
  extractos que les corresponden por fecha, aunque ya estén cerrados. Un extracto que no existía y
  cuya fecha límite ya pasó se crea como Pagado, con su "A pagar" como monto pagado; los que ya
  existían conservan su estado. Si el usuario no había pagado alguno, deshace el pago a mano.
- **Varias compras pasadas en el mismo ciclo**: la primera crea el extracto pasado como Pagado; las
  siguientes entran en él como pagadas (FR-031) y su "A pagar" se recalcula.
- **Fecha de compra futura**: no se permite (para eso está el simulador de la spec 004).
- **Valor no divisible entre las cuotas**: la última cuota absorbe el residuo; si el valor es
  menor que el número de cuotas (por ejemplo $50 a 72 cuotas), las primeras abonan $0 y la última
  todo el valor; la suma siempre es el valor.
- **Tasa 0%**: equivale a sin interés.
- **Interés con medio peso**: se redondea al peso más cercano y los medios pesos hacia arriba.
- **Cambiar la tasa de la tarjeta**: no altera compras ya registradas; las compras nuevas usan la
  nueva tasa.
- **Compras que superan el cupo**: se guardan tras el aviso; el cupo disponible puede quedar
  negativo.
- **Extracto pagado**: su monto pagado queda registrado; si después cambia su "A pagar", el
  detalle muestra ambos valores.
- **Extracto vencido**: se deriva de la fecha; no se cobra mora (v2).
- **Cambio de fechas de la tarjeta con hoy igual al día de corte**: el extracto de hoy sigue
  abierto y se recalcula.
- **Cambio de fechas que movería una cuota a un corte ya pasado**: la cuota va al primer extracto
  abierto, y las siguientes de la misma compra van en los ciclos consecutivos.
- **Tarjeta archivada**: sus compras y extractos se ven en solo lectura; no se registran ni
  editan compras, pero sí se puede marcar o deshacer el pago de un extracto.
- **Cambio de zona horaria**: el estado de los extractos y "hoy" se recalculan con la nueva zona.
- **Sin conexión al guardar, editar, borrar o pagar**: se muestra el error de conexión y no se
  pierde lo escrito en el formulario.
- **Usuario con la contraseña temporal pendiente** (spec 001): no accede a compras ni extractos.

## Requirements *(mandatory)*

### Functional Requirements

**Reglas de cuotas (dominio)**

- **FR-001**: El sistema MUST calcular el abono de la cuota k de una compra de valor V a n cuotas
  como floor(V / n) para k = 1..n−1 y V − (n−1) × floor(V / n) para la cuota n; la suma de los
  abonos MUST ser exactamente V.
- **FR-002**: El sistema MUST calcular la tasa mensual equivalente como EM = (1 + EA)^(1/12) − 1.
- **FR-003**: El sistema MUST calcular el interés estimado de la cuota k como el saldo de capital
  antes de esa cuota (V menos los abonos de las cuotas 1..k−1) × EM, redondeado al peso más
  cercano (medios pesos hacia arriba). El interés MUST ser 0 si la compra tiene 1 cuota, está
  marcada "Sin intereses", o la tasa guardada en la compra está vacía o es 0.
- **FR-004**: El sistema MUST asignar la cuota k al extracto cuyo corte está k − 1 ciclos después
  del corte al que pertenece la fecha de compra (spec 002, FR-002), con el ajuste de fin de mes
  aplicado mes a mes.
- **FR-005**: Las reglas FR-001 a FR-004 y las de estado y recálculo de extractos (FR-016,
  FR-021) MUST ser funciones puras del dominio, sin reloj ni acceso externo, con pruebas que
  cubran los escenarios de la historia 1, todos los n de 1 a 72 con valores divisibles y no
  divisibles, valores menores que n, tasas vacía, 0 y con 2 decimales, y compras en los bordes de
  mes y de año. La cobertura del dominio MUST seguir siendo al menos 95%.

**Tasa de la tarjeta**

- **FR-006**: La tarjeta MUST tener un campo opcional "Tasa de interés EA (%)" entre 0 y 100 con
  hasta 2 decimales, editable en el formulario de crear y editar tarjeta (spec 002) y visible en
  el detalle. La app acepta coma o punto decimal.
- **FR-007**: Cambiar la tasa de la tarjeta MUST NOT alterar compras ya registradas.

**Compras**

- **FR-008**: El usuario MUST poder registrar una compra en una tarjeta activa con: valor (entero
  en pesos, mayor que 0 y hasta $9.999.999.999), concepto (1–60 caracteres tras recortar
  espacios), fecha (por defecto hoy; no posterior a hoy ni anterior a 72 meses antes de hoy),
  número de cuotas (entero 1–72, por defecto 1) y "Sin intereses" (por defecto apagado).
- **FR-009**: Al registrar una compra, el sistema MUST guardar con ella la tasa EA vigente de la
  tarjeta (o vacía si no tiene) y generar sus n cuotas en sus extractos, creando los extractos que
  aún no existan (uno por tarjeta y fecha de corte).
- **FR-010**: Al guardar una compra, la app MUST mostrar la fecha de corte del extracto de la
  primera cuota y su fecha límite de pago.
- **FR-011**: El sistema MUST validar los campos de FR-008 en el servidor y en la app con las
  mismas reglas e indicar por campo qué corregir.
- **FR-012**: Si el valor de una compra nueva (o el aumento de valor al editarla) supera el cupo
  disponible de la tarjeta, la app MUST avisarlo mostrando el cupo disponible y pedir
  confirmación; con la confirmación, la compra se guarda.
- **FR-013**: El usuario MUST poder ver la lista de compras de una tarjeta (concepto, fecha,
  valor, cuotas) y el detalle de cada compra con su plan: por cuota, el extracto (fecha de corte y
  fecha límite), el abono y el interés estimado.
- **FR-014**: El usuario MUST poder editar valor, concepto, fecha, cuotas y "Sin intereses" de una
  compra de una tarjeta activa, con las mismas validaciones; sus cuotas se recalculan y reasignan
  con la tasa guardada en la compra. El usuario MUST poder borrar una compra con confirmación, lo
  que borra sus cuotas. Registrar, editar o borrar una compra se permite aunque afecte extractos
  pagados (FR-031).

**Extractos**

- **FR-015**: El sistema MUST guardar los extractos de cada tarjeta (fecha de corte, fecha límite,
  pago) y crearlos a medida que una cuota los necesita; MUST existir como máximo uno por tarjeta y
  fecha de corte.
- **FR-016**: El estado de un extracto MUST derivarse de hoy en la zona del usuario: Abierto si
  hoy ≤ fecha de corte; Por pagar si fecha de corte < hoy ≤ fecha límite; Vencido si hoy > fecha
  límite; Pagado si el usuario lo marcó, sin importar las fechas.
- **FR-017**: El "A pagar" de un extracto MUST ser la suma de los abonos y los intereses
  estimados de sus cuotas, y MUST presentarse como estimado cuando incluye intereses.
- **FR-018**: La app MUST mostrar los extractos de una tarjeta con fecha de corte, fecha límite,
  "A pagar" y estado en texto, primero los no pagados por fecha de corte ascendente y después los
  pagados del más reciente al más antiguo; y el detalle de un extracto con sus cuotas (concepto,
  "k de n", abono e interés estimado).
- **FR-019**: El usuario MUST poder marcar como pagado un extracto Por pagar o Vencido; se guardan
  la fecha de pago (hoy) y el monto pagado (su "A pagar" en ese momento). Un extracto Abierto
  MUST NOT poder marcarse como pagado.
- **FR-020**: El usuario MUST poder deshacer el pago de un extracto; vuelve al estado que le
  corresponde por fechas y se borran la fecha y el monto pagados.
- **FR-021**: Al cambiar el día de corte o el día límite de una tarjeta, el sistema MUST
  recalcular los extractos abiertos: sus cuotas se reasignan con las nuevas fechas según FR-004 y,
  si eso las llevaría a un corte ya pasado, al primer extracto abierto, manteniendo las cuotas de
  una misma compra en ciclos consecutivos; los extractos abiertos que quedan sin cuotas se
  eliminan. Los extractos cerrados y sus cuotas MUST NOT cambiar.
- **FR-022**: Los extractos que quedan sin cuotas por editar o borrar compras MUST eliminarse si
  no están pagados.
- **FR-030**: Cuando una compra (al registrarse o editarse) necesita un extracto que no existe y
  cuya fecha límite es anterior a hoy, el sistema MUST crearlo como Pagado, con fecha de pago hoy
  y monto pagado igual a su "A pagar" al crearse. Los extractos que ya existen MUST conservar su
  estado.
- **FR-031**: Registrar, editar o borrar una compra MUST permitirse aunque afecte cuotas de un
  extracto pagado. Ese extracto MUST seguir Pagado con el monto pagado registrado; su "A pagar" se
  recalcula y, si difiere del monto pagado, su detalle MUST mostrar ambos valores. Las cuotas que
  entran en un extracto pagado cuentan como pagadas (no suman al capital pendiente).

**Cupo, deuda y tope**

- **FR-023**: El sistema MUST calcular el capital pendiente de una tarjeta como la suma de los
  abonos de sus cuotas en extractos no pagados, y el cupo disponible como cupo total − capital
  pendiente (puede ser negativo). Los intereses no cuentan.
- **FR-024**: El carrusel y el detalle de la tarjeta MUST mostrar el cupo disponible real
  (reemplaza FR-017 de la spec 002); el detalle MUST mostrar además la "Deuda total" (capital
  pendiente) y el uso del tope del ciclo: "A pagar" del extracto abierto del próximo corte ÷ tope
  por ciclo, en porcentaje y en pesos. Un cupo disponible negativo o un tope superado se indican
  con texto, no solo con color.

**Aislamiento**

- **FR-025**: Toda operación sobre compras y extractos MUST limitarse a las tarjetas del usuario
  autenticado; una compra, extracto o tarjeta de otro usuario MUST tratarse como inexistente
  (misma respuesta) en lectura, listado, registro, edición, borrado, pago y deshacer pago.
- **FR-026**: Cada operación sobre compras y extractos MUST tener pruebas automáticas con dos
  usuarios que verifiquen FR-025.

**App**

- **FR-027**: El detalle de una tarjeta activa MUST ofrecer "Registrar compra", y el de cualquier
  tarjeta los accesos a "Compras" y "Extractos".
- **FR-028**: Los montos MUST mostrarse en pesos colombianos sin decimales, con separador de miles
  y números tabulares; la tasa con hasta 2 decimales y coma decimal ("26,82% EA"); todo interés y
  todo total que lo incluya, marcado como estimado; los estados de los extractos, con texto.
- **FR-029**: Todas las pantallas nuevas MUST seguir `docs/design-system.md` (tokens del tema,
  áreas táctiles de al menos 44, contraste AA, estados con texto).

### Key Entities

- **Tarjeta (Card)**: la de la spec 002, más la tasa de interés EA opcional (0–100, hasta 2
  decimales).
- **Compra (Purchase)**: pertenece a una tarjeta. Valor (entero en pesos), concepto, fecha, número
  de cuotas, "sin intereses" y la tasa EA copiada de la tarjeta al registrarla. Se borra en
  cascada con la tarjeta y con el usuario.
- **Cuota (Installment)**: pertenece a una compra y a un extracto. Número (1..n), abono e interés
  estimado (enteros en pesos). La suma de los abonos de una compra es su valor.
- **Extracto (Statement)**: pertenece a una tarjeta. Fecha de corte (única por tarjeta), fecha
  límite, y, si está pagado, fecha y monto pagados. El estado Abierto, Por pagar o Vencido se
  deriva de las fechas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los escenarios de la historia 1 dan el abono, el interés y el extracto
  esperados en las pruebas automáticas, y la suma de los abonos es igual al valor en todas las
  combinaciones probadas de valor y cuotas (n de 1 a 72).
- **SC-002**: La cobertura de las pruebas del dominio sigue siendo al menos 95% y la integración
  continua rechaza cambios que la bajen.
- **SC-003**: Para una compra real del extracto de Davivienda usado como referencia, los abonos y
  las fechas de corte y de pago de cada cuota coinciden con los del extracto; los intereses
  estimados difieren de los del banco solo por la liquidación por días.
- **SC-004**: Un usuario registra una compra de 1 cuota en menos de 30 segundos desde el detalle
  de la tarjeta y ve el extracto y la fecha de pago de la primera cuota al guardar.
- **SC-005**: Tras registrar, editar o borrar una compra, o pagar o deshacer el pago de un
  extracto, el cupo disponible, la deuda total y los extractos se ven actualizados sin recargar.
- **SC-006**: En las pruebas con dos usuarios, el 100% de los intentos de leer, listar, crear,
  editar, borrar, pagar o deshacer el pago sobre compras y extractos del otro fallan sin revelar
  si existen.
- **SC-007**: Tras cambiar las fechas de una tarjeta, el 100% de los extractos cerrados conservan
  fechas, cuotas y estado, y el 100% de las cuotas de los abiertos quedan en los cortes que les
  corresponden con las nuevas fechas.
- **SC-008**: Las pantallas nuevas cumplen el sistema de diseño: contraste AA y áreas táctiles de
  al menos 44, y ningún estado ni interés se comunica solo con color o sin la marca de estimado.

## Clarifications

### Session 2026-11-23

- Q: ¿En qué estado quedan los extractos de ciclos pasados que se crean al registrar una compra
  con fecha pasada? → A: un extracto nuevo con la fecha límite ya pasada se crea como Pagado, con
  su "A pagar" como monto pagado; los existentes conservan su estado (FR-030).
- Q: ¿Qué pasa con los extractos ya pagados cuando una compra nueva, editada o borrada los afecta?
  → A: se permite; el extracto sigue Pagado con el monto registrado, su "A pagar" se recalcula y
  el detalle muestra ambos valores; las cuotas que entran cuentan como pagadas (FR-031).

## Assumptions

- **Liquidación del banco**: confirmada con un extracto real de Davivienda (cierra la decisión
  pendiente de `docs/mvp-spec.md`): abono fijo a capital (floor) con el residuo en la última cuota
  e interés sobre el saldo de capital. El banco liquida por días; la app muestra el interés como
  estimado y el interés por días queda para la v2.
- **Regla 2 de "Cuotas" ajustada**: el MVP decía "valor / n redondeado al peso"; se usa floor con
  el residuo en la última cuota, como el banco, para que los abonos coincidan con el extracto.
- **Tasa por compra**: la compra copia la tasa de la tarjeta al registrarse y la conserva al
  editarse; no se ingresa una tasa distinta por compra (solo "Sin intereses").
- **Uso del tope**: "suma de las cuotas del extracto abierto" se toma como su "A pagar" (abonos más
  intereses estimados) del extracto del próximo corte. Solo se muestra; los avisos push de 70%,
  90% y 100% y la regla 3 de "Cupo, tope y alertas" llegan en la spec 005.
- **Pagar un extracto**: solo se marca pagado completo; el monto pagado es su "A pagar" en ese
  momento. Pago mínimo y pagos parciales quedan para la v2. Solo se pueden pagar extractos ya
  cortados, porque uno abierto aún puede recibir compras.
- **Cupo y deuda sin intereses**: la regla 2 habla de capital; los intereses estimados no
  descuentan cupo ni suman deuda.
- **Fecha de compra**: no futura (el simulador "si compro hoy" es la spec 004) y no más de 72
  meses atrás, porque ninguna cuota de una compra más antigua podría seguir pendiente.
- **Entrada a "Registrar compra"**: desde el detalle de la tarjeta. El botón central de la barra
  inferior y el inicio con resumen llegan en la spec 004.
- **Tarjeta archivada**: compras y extractos en solo lectura, salvo marcar o deshacer el pago,
  para poder terminar de pagar una tarjeta que ya no se usa.
- **Dependencias**: spec 001 (cuentas, sesión, zona horaria, eliminación en cascada) y spec 002
  (tarjetas y reglas de ciclo).
- **Fuera de alcance (v2)**: interés por días, avances y comisiones, compras en dólares, pago
  mínimo y pagos parciales, intereses de mora; ajuste de fechas por festivos (ya anotado).
