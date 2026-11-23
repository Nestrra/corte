# Feature Specification: Inicio y simulador

**Feature Branch**: `004-home-simulator`

**Created**: 2026-11-23

**Status**: Draft

**Reference**: `docs/mvp-spec.md` → HU-05 y HU-08 (sin los pagos recurrentes del inicio) y reglas
"Cupo, tope y alertas" 1, 2 y 4; `docs/design-system.md` → "Pantalla de inicio", CycleSummary,
ProgressBar, CardCarousel y TabBar; `specs/002-cards/spec.md` → reglas de ciclo;
`specs/003-purchases/spec.md` → cuotas, extractos, estados, cupo disponible, deuda y uso del tope.

**Input**: User description: "Spec 004 — Inicio y simulador. Corresponde a HU-05 y HU-08 de
docs/mvp-spec.md, con el diseño de inicio de docs/design-system.md. Como usuario quiero: un inicio
con saludo con mi nombre; 'Mis tarjetas' con el carrusel (mismo componente de la pestaña
Tarjetas) y el botón 'Agregar'; y debajo un resumen de la tarjeta que está al frente del
carrusel, que cambia al deslizar: próximo pago (monto 'A pagar' del extracto por pagar más
cercano, su fecha límite y días que faltan, resaltado si faltan 5 días o menos), próximo corte con
días que faltan, y el ciclo actual: acumulado del extracto abierto frente al tope, con barra de
progreso que cambia a color de alerta desde 70% y de error desde 100%. Si no tengo tarjetas, el
inicio me invita a crear la primera. El botón central 'Registrar compra' de la barra inferior
abre el formulario de compra desde cualquier pestaña, con la tarjeta del frente del carrusel
preseleccionada y la opción de cambiarla. Simular mientras registro: en el formulario de compra,
a medida que escribo valor, fecha, cuotas y 'Sin intereses', veo sin guardar: el extracto donde
cae la primera cuota y su fecha límite, el plan de cuotas (abono + interés estimado por mes), el
total de intereses estimados, y cómo quedaría el uso del tope del ciclo y el cupo disponible. Si
supera el tope o el cupo, lo veo como aviso. Puedo salir sin guardar. Los datos del inicio se
actualizan al registrar, editar o borrar compras, marcar pagos o editar tarjetas. Reglas: los
cálculos de la simulación usan el mismo dominio que el registro real y el 'hoy' del servidor;
simular no crea ni modifica nada. Criterios: con corte 8 y pago 25, simular el 23 de noviembre
una compra de $300.000 a 3 cuotas muestra la primera cuota en el corte del 8 de diciembre con pago
el 25 de diciembre; si el extracto abierto lleva $1.500.000 con tope de $2.000.000, simular
$600.000 a 1 cuota muestra el tope en 105% con aviso; la pantalla de inicio cumple el diseño,
contraste AA y áreas táctiles de 44. Fuera de alcance: la sección de pagos recurrentes del inicio
(spec 006), notificaciones (spec 005)."

## User Scenarios & Testing *(mandatory)*

Actor: **usuario** con sesión iniciada (spec 001). "Hoy" es la fecha en su zona horaria según el
servidor (spec 002), no la del teléfono.

Términos usados en esta spec (además de los de las specs 002 y 003):

- **Tarjeta al frente**: la tarjeta activa que se ve completa en el carrusel del inicio. Al abrir
  la app es la primera del carrusel; cambia al deslizar.
- **Próximo pago**: el extracto no pagado ya cortado (Por pagar o Vencido) con la fecha límite más
  antigua de la tarjeta: su "A pagar", su fecha límite y los días que faltan (o que pasaron).
- **Próximo corte**: la fecha de corte del extracto abierto (la del ciclo actual de la spec 002) y
  los días que faltan.
- **Ciclo actual**: el "A pagar" del extracto abierto frente al tope por ciclo, en pesos y en
  porcentaje (uso del tope de la spec 003).
- **Simulación**: el resultado de calcular una compra sin guardarla: extracto de la primera
  cuota, plan de cuotas, total de intereses estimados, uso del tope y cupo disponible después de
  la compra.
- **Días que faltan**: "Hoy", "Mañana", "En N días"; si la fecha ya pasó, "Hace N días".

### User Story 1 - Simular una compra mientras la registro (Priority: P1)

Como usuario quiero ver, mientras lleno el formulario de compra y antes de guardar, en qué extracto
cae, cuándo la pago, su plan de cuotas, cuánto interés estimado pagaría y cómo quedarían mi tope y
mi cupo, para decidir si hago la compra, con cuántas cuotas o con qué tarjeta.

**Why this priority**: es la razón de ser de Corte ("si compro hoy, ¿cuándo lo pago?"); HU-05 es
el núcleo del MVP y reutiliza todo el dominio de las specs 002 y 003.

**Independent Test**: con una tarjeta de corte 8 y pago 25, abrir "Registrar compra", escribir
valor, cuotas y fecha y comprobar que la simulación cambia con cada dato sin crear nada; salir sin
guardar y comprobar que compras, extractos, cupo y tope siguen iguales.

**Acceptance Scenarios**:

1. **Given** una tarjeta con corte 8 y pago 25 y hoy 23 de noviembre de 2026, **When** el usuario
   escribe $300.000 a 3 cuotas con fecha de hoy, **Then** ve "Primera cuota en el corte del 8 de
   diciembre de 2026 · se paga el 25 de diciembre de 2026" y un plan de 3 cuotas de $100.000 en
   los cortes del 8 de diciembre, 8 de enero y 8 de febrero, cada una con su interés estimado.
2. **Given** la misma tarjeta con un extracto abierto con "A pagar" de $1.500.000 y tope de
   $2.000.000, **When** el usuario simula $600.000 a 1 cuota con fecha de hoy, **Then** ve el
   tope del ciclo en 105% ($2.100.000 de $2.000.000) con un aviso de que supera el tope.
3. **Given** una tarjeta con tasa 24% EA, **When** el usuario simula $1.200.000 a 12 cuotas,
   **Then** ve los 12 meses con abono $100.000 y el interés estimado de cada uno ($21.705 el
   primero … $1.809 el último), y el total de intereses estimados marcado como "estimado".
4. **Given** una simulación con intereses, **When** el usuario activa "Sin intereses", cambia a 1
   cuota o la tarjeta no tiene tasa, **Then** el plan muestra interés $0 en todas las cuotas y el
   total de intereses es $0.
5. **Given** un cupo disponible de $500.000, **When** el usuario simula $800.000, **Then** ve el
   cupo disponible después de la compra como −$300.000 con un aviso de que supera el cupo (y aún
   puede guardarla, como en la spec 003).
6. **Given** una simulación en pantalla, **When** el usuario cambia la fecha a una anterior al
   último corte, **Then** la simulación muestra el extracto de ese corte con su estado y el uso
   del tope del ciclo actual no cambia por esa cuota.
7. **Given** una simulación en pantalla, **When** el usuario sale con "Cancelar" o el gesto de
   volver, **Then** no se crea ninguna compra ni extracto y el cupo, la deuda y el tope siguen
   iguales.
8. **Given** datos incompletos o inválidos (valor vacío o 0, cuotas fuera de 1 a 72, fecha
   futura), **When** el usuario los escribe, **Then** la simulación no muestra cifras y dice qué
   falta, sin mostrar errores de servidor.

---

### User Story 2 - Resumen de la tarjeta al frente en el inicio (Priority: P1)

Como usuario quiero que el inicio me diga, para la tarjeta que tengo al frente, cuánto debo pagar
y cuándo, cuándo es el próximo corte y cuánto llevo del tope, para no pagar tarde ni pasarme del
tope.

**Why this priority**: es HU-08 y el objetivo del MVP ("nunca pagar tarde ni pasarse del tope sin
enterarse"); hoy el inicio es temporal.

**Independent Test**: con dos tarjetas con extractos y compras, abrir el inicio, deslizar el
carrusel y comprobar que el resumen cambia a la tarjeta del frente con las cifras de su detalle.

**Acceptance Scenarios**:

1. **Given** un usuario con tarjetas, **When** abre el inicio, **Then** ve "Hola, <nombre>",
   "Mis tarjetas" con el botón "Agregar", el carrusel de tarjetas activas (el mismo de la pestaña
   Tarjetas) y debajo el resumen de la tarjeta al frente.
2. **Given** una tarjeta con un extracto Por pagar de $850.000 con fecha límite 25 de noviembre y
   hoy 23 de noviembre, **When** está al frente, **Then** el resumen muestra "Próximo pago
   $850.000 · 25 nov · En 2 días" resaltado con el color de alerta (faltan 5 días o menos).
3. **Given** un próximo pago con fecha límite en 12 días, **When** la tarjeta está al frente,
   **Then** se muestra sin resaltar.
4. **Given** una tarjeta con un extracto Vencido, **When** está al frente, **Then** el próximo
   pago muestra ese extracto con "Vencido · Hace N días" en el color de error.
5. **Given** una tarjeta sin extractos Por pagar ni Vencidos, **When** está al frente, **Then** el
   próximo pago dice "Sin pagos pendientes".
6. **Given** una tarjeta con corte 8 y hoy 23 de noviembre, **When** está al frente, **Then** el
   resumen muestra "Próximo corte 8 dic · En 15 días".
7. **Given** un extracto abierto con "A pagar" de $1.500.000 y tope de $2.000.000, **When** la
   tarjeta está al frente, **Then** el ciclo actual muestra "75% · $1.500.000 de $2.000.000" con
   la barra en color de alerta; con 69% la barra es del color normal y con 100% o más es del color
   de error y dice "Superaste el tope".
8. **Given** varias tarjetas, **When** el usuario desliza el carrusel, **Then** el resumen pasa a
   la nueva tarjeta al frente y el lector de pantalla anuncia de qué tarjeta es el resumen.
9. **Given** el resumen en pantalla, **When** el usuario toca el próximo pago, **Then** abre el
   detalle de ese extracto (spec 003); al tocar el ciclo actual abre los extractos de la tarjeta.

---

### User Story 3 - Botón central "Registrar compra" (Priority: P1)

Como usuario quiero registrar (y simular) una compra desde cualquier pestaña con un solo toque,
con la tarjeta que tengo al frente ya elegida y la opción de cambiarla.

**Why this priority**: registrar y simular es la acción más frecuente; hoy solo se llega desde el
detalle de cada tarjeta.

**Independent Test**: desde Inicio, Tarjetas y Perfil, tocar el botón central, comprobar la
tarjeta preseleccionada, cambiarla y ver que la simulación se recalcula con la nueva tarjeta.

**Acceptance Scenarios**:

1. **Given** la barra inferior, **When** el usuario la ve en cualquier pestaña, **Then** tiene
   Inicio, Tarjetas, el botón central "Registrar compra" y Perfil (Pagos llega en la spec 006).
2. **Given** la tarjeta "Visa Oro" al frente del carrusel del inicio, **When** el usuario toca el
   botón central desde cualquier pestaña, **Then** se abre el formulario de compra con "Visa Oro"
   seleccionada.
3. **Given** el formulario abierto, **When** el usuario elige otra tarjeta activa, **Then** la
   simulación se recalcula con las fechas, la tasa, el cupo y el tope de la nueva tarjeta y se
   conservan valor, concepto, fecha, cuotas y "Sin intereses".
4. **Given** el usuario guarda la compra, **When** se registra, **Then** se comporta como en la
   spec 003 (confirmación con el extracto y la fecha de pago) y vuelve a la pestaña donde estaba.
5. **Given** un usuario sin tarjetas activas, **When** toca el botón central, **Then** ve una
   invitación a crear su primera tarjeta en lugar del formulario.
6. **Given** el formulario abierto desde el detalle de una tarjeta (spec 003), **When** se abre,
   **Then** esa tarjeta queda seleccionada y también tiene la simulación.

---

### User Story 4 - Inicio sin tarjetas (Priority: P2)

Como usuario nuevo quiero que el inicio me invite a crear mi primera tarjeta, para empezar.

**Why this priority**: solo pasa una vez por usuario, pero sin él el inicio queda vacío.

**Independent Test**: con un usuario recién registrado o con todas sus tarjetas archivadas, abrir
el inicio.

**Acceptance Scenarios**:

1. **Given** un usuario sin tarjetas activas, **When** abre el inicio, **Then** ve el saludo y una
   invitación ("Agrega tu primera tarjeta" con un botón) en lugar del carrusel y el resumen.
2. **Given** la invitación, **When** el usuario crea su primera tarjeta, **Then** vuelve al inicio
   y ve el carrusel con esa tarjeta y su resumen.

---

### User Story 5 - El inicio siempre al día (Priority: P2)

Como usuario quiero que el inicio refleje al instante lo que hago en otras pantallas.

**Why this priority**: un resumen viejo engaña sobre lo que se debe pagar.

**Independent Test**: con el inicio abierto, registrar, editar y borrar una compra, pagar y
deshacer un extracto y editar una tarjeta, y volver al inicio cada vez.

**Acceptance Scenarios**:

1. **Given** el inicio, **When** el usuario registra, edita o borra una compra, marca o deshace un
   pago, o crea, edita o archiva una tarjeta, **Then** al volver al inicio el carrusel y el resumen
   muestran las cifras nuevas sin recargar a mano.
2. **Given** la app abierta de un día para otro, **When** el usuario vuelve al inicio, **Then** los
   días que faltan y los estados corresponden al nuevo "hoy".

---

### User Story 6 - La simulación es solo mía (Priority: P1)

Como usuario quiero que nadie pueda simular sobre mis tarjetas ni ver mis cifras en el inicio.

**Why this priority**: principio de aislamiento por usuario de la constitución.

**Independent Test**: pruebas automáticas con dos usuarios.

**Acceptance Scenarios**:

1. **Given** dos usuarios A y B, **When** B intenta simular una compra en una tarjeta de A,
   **Then** recibe la misma respuesta que para una tarjeta inexistente y no se revela nada de A.
2. **Given** dos usuarios, **When** cada uno abre el inicio, **Then** solo ve sus tarjetas y sus
   cifras.

---

### Edge Cases

- **Simular en una tarjeta archivada**: no se puede; el selector solo ofrece tarjetas activas y la
  simulación sobre una archivada se rechaza igual que el registro.
- **Tarjeta al frente archivada o borrada**: al volver al inicio, la tarjeta al frente pasa a la
  primera activa; el botón central preselecciona esa.
- **Compra a varias cuotas con fecha pasada**: cuotas que caen en extractos ya cortados se
  muestran con su estado (Pagado si el extracto nuevo ya venció, como FR-030 de la spec 003); solo
  la cuota que cae en el extracto abierto cuenta para el tope del ciclo.
- **La primera cuota cae en el ciclo siguiente** (compra posterior al corte actual, por ejemplo
  hoy es día de corte + 1): el tope del ciclo actual no cambia; la simulación lo dice.
- **Varios extractos Por pagar o Vencidos**: el próximo pago es el de fecha límite más antigua; el
  resto se ve en los extractos de la tarjeta.
- **Tope o cupo ya superados antes de simular**: la simulación muestra el valor resultante y el
  aviso, igual que si la compra lo superara.
- **Tasa de la tarjeta con muchas cuotas (72)**: el plan muestra las 72 cuotas en una lista
  desplazable sin bloquear la escritura.
- **Sin conexión o error al simular**: la simulación muestra un mensaje y un reintento; el
  formulario sigue usable y guardar se comporta como en la spec 003.
- **Cambiar de tarjeta con un valor que supera el cupo de la nueva**: el aviso aparece o
  desaparece según la nueva tarjeta.
- **Montos muy grandes** (valor máximo de la spec 003): las cifras no se cortan ni se desbordan;
  se ajustan al ancho.

## Requirements *(mandatory)*

### Functional Requirements

**Simulación**

- **FR-001**: El sistema MUST calcular la simulación de una compra (valor, fecha, cuotas, "Sin
  intereses") en una tarjeta activa del usuario con las mismas reglas del dominio que el registro
  real (specs 002 y 003) y con el "hoy" del servidor en la zona del usuario.
- **FR-002**: La simulación MUST devolver: fecha de corte, fecha límite y estado del extracto de
  la primera cuota; el plan completo (por cuota: número, corte, fecha límite, abono e interés
  estimado); el total de intereses estimados; el uso del tope del ciclo actual después de la
  compra (porcentaje y pesos); y el cupo disponible después de la compra.
- **FR-003**: El uso del tope después de la compra MUST ser ("A pagar" del extracto abierto + abono
  e interés estimado de la cuota de la compra que cae en ese extracto, si cae alguna) ÷ tope por
  ciclo, con el mismo redondeo del uso del tope de la spec 003.
- **FR-004**: El cupo disponible después de la compra MUST ser el cupo disponible actual (spec 003)
  menos el valor de la compra; puede ser negativo.
- **FR-005**: Simular MUST NOT crear, modificar ni borrar compras, cuotas ni extractos, y MUST NOT
  cambiar el cupo, la deuda ni el tope.
- **FR-006**: La simulación MUST validar los datos con las mismas reglas que el registro (spec 003
  FR-008 y FR-011) y rechazar tarjetas archivadas igual que el registro.
- **FR-007**: El formulario de compra MUST mostrar la simulación y actualizarla mientras el
  usuario escribe valor, fecha, cuotas o "Sin intereses", o cambia de tarjeta, sin pulsar un
  botón; mientras los datos sean incompletos o inválidos MUST decir qué falta en lugar de cifras.
- **FR-008**: La simulación MUST mostrar un aviso cuando el uso del tope después de la compra sea
  100% o más, y otro cuando el cupo disponible después de la compra sea negativo; la barra del
  tope de la simulación sigue los colores de FR-014. Los avisos no impiden guardar.
- **FR-009**: Todo interés de la simulación MUST mostrarse como "estimado" (principio IV).
- **FR-010**: El usuario MUST poder salir del formulario sin guardar en cualquier momento.

**Botón central y formulario**

- **FR-011**: La barra inferior MUST tener Inicio, Tarjetas, el botón central "Registrar compra" y
  Perfil, según el TabBar de `docs/design-system.md` (Pagos llega en la spec 006).
- **FR-012**: El botón central MUST abrir el formulario de compra desde cualquier pestaña con la
  tarjeta al frente del inicio preseleccionada (o la primera activa si no hay una al frente) y un
  selector para cambiarla entre las tarjetas activas; sin tarjetas activas MUST invitar a crear
  una. Al cambiar de tarjeta, los datos escritos se conservan y la simulación se recalcula.
- **FR-013**: El formulario abierto desde el detalle de una tarjeta (spec 003) MUST tener la misma
  simulación, con esa tarjeta seleccionada.

**Inicio**

- **FR-014**: El inicio MUST mostrar, en este orden: saludo con el nombre del usuario; "Mis
  tarjetas" con el botón "Agregar" (abre crear tarjeta) y el carrusel de tarjetas activas (el
  mismo componente de la pestaña Tarjetas); y el resumen (CycleSummary) de la tarjeta al frente.
- **FR-015**: El resumen MUST mostrar: próximo pago ("A pagar", fecha límite y días que faltan) del
  extracto Por pagar o Vencido con la fecha límite más antigua, o "Sin pagos pendientes"; próximo
  corte con los días que faltan; y el ciclo actual ("A pagar" del extracto abierto frente al tope,
  en porcentaje y en pesos) con una barra de progreso.
- **FR-016**: El próximo pago MUST resaltarse con el color de alerta cuando falten 5 días o menos
  para la fecha límite (incluido hoy) y con el color de error cuando esté Vencido, siempre con el
  texto que lo dice (no solo el color).
- **FR-017**: La barra del ciclo actual MUST usar el color normal por debajo de 70%, el de alerta
  desde 70% y el de error desde 100%, con "Superaste el tope" desde 100%; el porcentaje siempre va
  escrito.
- **FR-018**: El resumen MUST cambiar a la tarjeta al frente cuando el usuario desliza el carrusel
  y anunciarlo al lector de pantalla.
- **FR-019**: Tocar el próximo pago MUST abrir el detalle de ese extracto, y tocar el ciclo actual
  MUST abrir los extractos de la tarjeta (spec 003).
- **FR-020**: Sin tarjetas activas, el inicio MUST mostrar el saludo y una invitación a crear la
  primera tarjeta en lugar del carrusel y el resumen.
- **FR-021**: El inicio MUST mostrar las cifras actualizadas después de registrar, editar o borrar
  compras, marcar o deshacer pagos y crear, editar o archivar tarjetas, y al volver a la app en
  otro día, sin que el usuario recargue a mano.
- **FR-022**: Los días que faltan y los estados MUST calcularse con el "hoy" del servidor en la
  zona del usuario, no con la fecha del teléfono.

**Aislamiento, formato y diseño**

- **FR-023**: Simular y leer los datos del inicio MUST limitarse a las tarjetas del usuario; una
  tarjeta de otro usuario MUST responder igual que una inexistente.
- **FR-024**: La simulación MUST tener pruebas automáticas con dos usuarios (simular sobre una
  tarjeta ajena) y pruebas que comprueben que no cambia nada guardado.
- **FR-025**: Los montos MUST mostrarse como en la spec 003 (pesos sin decimales, separador de
  miles, signo menos para negativos) y las fechas en formato corto en el resumen ("25 nov") y
  largo en la confirmación.
- **FR-026**: El inicio, el botón central, el selector de tarjeta y la simulación MUST seguir
  `docs/design-system.md` (tokens del tema, contraste AA, áreas táctiles de al menos 44, montos
  tabulares) y ser accesibles con VoiceOver y TalkBack (el resumen y la barra se leen como frases
  completas con su estado).

### Key Entities

- **Simulación** (no se guarda): tarjeta, datos de la compra, extracto de la primera cuota (corte,
  fecha límite, estado), plan de cuotas (número, corte, fecha límite, abono, interés estimado),
  total de intereses estimados, uso del tope después de la compra y cupo disponible después de la
  compra.
- **Resumen del ciclo de una tarjeta** (derivado): próximo pago (extracto, "A pagar", fecha límite,
  días, estado), próximo corte (fecha, días) y ciclo actual ("A pagar" del extracto abierto, tope,
  porcentaje).
- Usa sin cambios **Tarjeta** (spec 002) y **Compra**, **Cuota** y **Extracto** (spec 003).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los escenarios de la historia 1 dan el extracto, el plan, los intereses,
  el tope y el cupo esperados, y coinciden con lo que guarda el registro real de la misma compra.
- **SC-002**: Después de cualquier número de simulaciones, el 100% de las compras, cuotas y
  extractos guardados y el cupo, la deuda y el tope siguen iguales.
- **SC-003**: La simulación se actualiza en menos de 1 segundo después de que el usuario deja de
  escribir, en una conexión normal.
- **SC-004**: Un usuario sabe cuánto y cuándo pagar de la tarjeta al frente en menos de 5 segundos
  después de abrir la app, sin tocar nada.
- **SC-005**: Un usuario simula y registra una compra a cuotas desde cualquier pestaña en menos de
  45 segundos.
- **SC-006**: Tras cualquier cambio de compras, pagos o tarjetas, el inicio muestra las cifras
  nuevas al volver a él en el 100% de los casos.
- **SC-007**: En las pruebas con dos usuarios, el 100% de los intentos de simular sobre una
  tarjeta ajena se rechazan como inexistentes.
- **SC-008**: El inicio, la barra inferior y la simulación cumplen el sistema de diseño: contraste
  AA y áreas táctiles de al menos 44 en el 100% de los elementos, y todos los estados se entienden
  sin depender del color.
- **SC-009**: La cobertura de las pruebas del dominio sigue en al menos 95%.

## Assumptions

- **Solo al registrar**: la simulación está en el formulario de registrar compra (desde el botón
  central o desde el detalle de la tarjeta). Editar una compra (spec 003) no la muestra; queda
  como mejora posterior.
- **Tope del ciclo actual**: la simulación compara siempre contra el extracto abierto (el del
  próximo corte), aunque la compra caiga en otro, porque es el tope que el usuario está gastando.
- **Próximo pago incluye vencidos**: un extracto Vencido es más urgente que uno Por pagar, así que
  el próximo pago es el no pagado ya cortado con la fecha límite más antigua.
- **Umbral de 5 días**: "faltan 5 días o menos" incluye el día de la fecha límite (0 días).
- **Tarjeta al frente**: se recuerda mientras la app está abierta; al reabrirla es la primera del
  carrusel. No se guarda en el servidor.
- **Botón de notificaciones del saludo**: el diseño lo muestra, pero llega con la spec 005; esta
  spec no lo incluye.
- **Pagos recurrentes del inicio**: la sección "Pagos de <mes>" y la pestaña Pagos llegan con la
  spec 006.
- **Simulación con fecha distinta de hoy**: se permite cualquier fecha válida para el registro
  (hoy o hasta 72 meses atrás, spec 003); la simulación "si compro hoy" es el caso por defecto.
- **Sin alertas push**: los avisos de la simulación son solo visuales; los push de 70%, 90% y 100%
  son de la spec 005.
