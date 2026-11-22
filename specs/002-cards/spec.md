# Feature Specification: Tarjetas y dominio de ciclos

**Feature Branch**: `002-cards`

**Created**: 2026-11-21

**Status**: Draft

**Reference**: `docs/mvp-spec.md` → HU-02 y reglas de negocio "Ciclos y extractos" 1, 2 y 3;
`docs/design-system.md` → CreditCardView, CardCarousel y TabBar.

**Input**: User description: "Spec 002 — Tarjetas y dominio de ciclos (HU-02, reglas de ciclos 1,
2 y 3). Registrar varias tarjetas con nombre, color (uno de los 6 de tarjeta), últimos 4 dígitos
opcionales, día de corte y día límite (1–31), cupo total, tope por ciclo y días de anticipación de
los recordatorios de corte (2) y de pago (3). Verlas en la pestaña Tarjetas como carrusel (nombre,
****últimos 4, cupo disponible = cupo total mientras no haya compras, 'Corte día X · Pago día Y').
Detalle con próximo corte, su fecha límite y días restantes en la zona horaria del usuario.
Editar, archivar (no se borra) y restaurar. Dominio puro: ciclo de una compra, próximo corte y
próxima fecha límite desde 'hoy', último día del mes si el día no existe; pruebas exhaustivas.
Barra inferior con Inicio, Tarjetas y Perfil. Criterios: corte 8 / pago 25 (compra del 9 de
noviembre → corte 8 de diciembre, pago 25 de diciembre; compra del 8 de noviembre → corte 8 de
noviembre, pago 25 de noviembre); corte 31 en febrero usa 28 o 29; aislamiento entre usuarios;
cobertura del dominio ≥ 95% exigida por la CI. Fuera de alcance: compras, extractos, cuotas,
alertas y el cálculo real del cupo disponible (spec 003)."

## User Scenarios & Testing *(mandatory)*

Actor: **usuario** con sesión iniciada (spec 001). Todas las fechas se interpretan en su zona
horaria (por defecto America/Bogota).

Términos usados en esta spec:

- **Día de corte / día límite**: números del 1 al 31 que el usuario configura en la tarjeta.
- **Fecha de corte**: el día de corte llevado a un mes concreto. Si ese mes no tiene ese día, es el
  último día del mes (31 en febrero → 28 o 29; 31 en abril → 30).
- **Fecha límite de un corte**: la primera fecha posterior a ese corte cuyo día es el día límite
  (ajustado al mes de la misma forma).
- **Ciclo**: el periodo que termina en una fecha de corte; una compra pertenece al primer corte
  igual o posterior a su fecha.

### User Story 1 - Fechas de ciclo correctas (Priority: P1)

Como usuario quiero que, para cualquier tarjeta, Corte sepa en qué corte cae una compra de cierta
fecha y cuándo se paga ese corte, sin errores en meses cortos, años bisiestos o cambios de año.
Es la regla en la que se apoyan el detalle de la tarjeta y todas las specs siguientes (compras,
extractos, simulador, alertas).

**Why this priority**: si estas fechas fallan, la app aconseja pagar tarde o cuenta mal el tope;
es el núcleo del producto (visión: "nunca pagar tarde").

**Independent Test**: se verifica sin pantallas, con las pruebas automáticas del dominio, dando
día de corte, día límite y una fecha y comparando con las fechas esperadas.

**Acceptance Scenarios**:

1. **Given** corte 8 y pago 25, **When** se consulta una compra del 9 de noviembre de 2026,
   **Then** cae en el corte del 8 de diciembre de 2026 con fecha límite 25 de diciembre de 2026.
2. **Given** corte 8 y pago 25, **When** se consulta una compra del 8 de noviembre de 2026,
   **Then** cae en el corte del 8 de noviembre de 2026 con fecha límite 25 de noviembre de 2026.
3. **Given** corte 25 y pago 8, **When** se consulta una compra del 26 de noviembre de 2026,
   **Then** cae en el corte del 25 de diciembre de 2026 con fecha límite 8 de enero de 2027.
4. **Given** corte 31, **When** se consulta una compra del 10 de febrero de 2027 (año no
   bisiesto), **Then** cae en el corte del 28 de febrero de 2027; en 2028 (bisiesto) el corte
   equivalente es el 29 de febrero.
5. **Given** corte 31, **When** se consulta una compra del 1 de marzo, **Then** cae en el corte
   del 31 de marzo (el ajuste de febrero no se arrastra a los meses siguientes).
6. **Given** corte 30 y pago 15, **When** se consulta una compra del 31 de enero, **Then** cae en
   el corte del 28 (o 29) de febrero con fecha límite 15 de marzo.
7. **Given** corte 15 y pago 15, **When** se consulta el corte del 15 de mayo, **Then** su fecha
   límite es el 15 de junio (un día límite igual al de corte cae en el mes siguiente).
8. **Given** corte 28 y pago 30, **When** se consulta el corte de febrero de un año no bisiesto
   (28 de febrero), **Then** su fecha límite es el 30 de marzo, nunca el mismo día del corte.
9. **Given** cualquier tarjeta y la fecha de hoy, **When** se piden el próximo corte y la próxima
   fecha límite, **Then** el próximo corte es el primer corte igual o posterior a hoy (si hoy es
   día de corte, es hoy), y la próxima fecha límite es la primera fecha límite igual o posterior a
   hoy, sea del corte que ya pasó o del siguiente.

---

### User Story 2 - Registrar una tarjeta (Priority: P1)

Como usuario quiero registrar cada una de mis tarjetas con su nombre, color, últimos 4 dígitos,
día de corte, día límite, cupo, tope por ciclo y los días de anticipación de los recordatorios,
para que Corte pueda calcular sus fechas.

**Why this priority**: sin tarjetas no hay nada que mostrar ni calcular en las specs siguientes.

**Independent Test**: desde la pestaña Tarjetas, agregar una tarjeta y verla en el carrusel con
los datos ingresados.

**Acceptance Scenarios**:

1. **Given** la pestaña Tarjetas, **When** el usuario toca "Agregar tarjeta" y guarda nombre "Visa
   principal", color verde, últimos 4 "4821", corte 8, pago 25, cupo $5.000.000 y tope
   $2.000.000 sin tocar los recordatorios, **Then** la tarjeta se guarda con recordatorios de 2
   días antes del corte y 3 antes del pago, y aparece en el carrusel.
2. **Given** el formulario, **When** el usuario deja vacíos los últimos 4 dígitos, **Then** la
   tarjeta se guarda sin ellos y la vista de tarjeta no muestra "****".
3. **Given** el formulario, **When** el usuario ingresa un día fuera de 1–31, últimos 4 con algo
   distinto de 4 dígitos, cupo o tope en cero o negativos, o un tope mayor que el cupo, **Then** se
   indica qué campo corregir con un texto y la tarjeta no se guarda.
4. **Given** que el usuario ya tiene tarjetas, **When** agrega otra, **Then** todas aparecen en el
   carrusel en el orden en que las creó.

---

### User Story 3 - Ver mis tarjetas en el carrusel (Priority: P1)

Como usuario quiero ver mis tarjetas activas en la pestaña "Tarjetas" como un carrusel con el
aspecto de una tarjeta de crédito, para reconocerlas de un vistazo.

**Why this priority**: es la vista principal de las tarjetas y el punto de entrada al detalle.

**Independent Test**: con dos tarjetas creadas, abrir la pestaña Tarjetas y recorrer el carrusel.

**Acceptance Scenarios**:

1. **Given** una tarjeta con nombre "Visa principal", últimos 4 "4821", cupo $5.000.000, corte 8 y
   pago 25, **When** el usuario abre la pestaña Tarjetas, **Then** ve la tarjeta con el degradado de su color, con
   "Visa principal", "**** 4821", el cupo disponible "$5.000.000" (igual al cupo total mientras no
   existan compras) y "Corte día 8 · Pago día 25".
2. **Given** varias tarjetas, **When** el usuario desliza el carrusel, **Then** avanza una tarjeta
   a la vez, deja ver el borde de la siguiente y un indicador muestra en cuál está.
3. **Given** que el usuario no tiene tarjetas activas, **When** abre la pestaña Tarjetas, **Then**
   ve un mensaje que lo invita a agregar su primera tarjeta y el botón "Agregar tarjeta".
4. **Given** la app con sesión iniciada, **When** el usuario mira la parte inferior, **Then** ve la
   barra con Inicio, Tarjetas y Perfil, con la pestaña activa destacada con texto y no solo con
   color.

---

### User Story 4 - Ver el detalle de una tarjeta (Priority: P1)

Como usuario quiero tocar una tarjeta y ver su próxima fecha de corte, la fecha límite de ese
corte y cuántos días faltan para cada una, para planear mis compras y pagos.

**Why this priority**: es la primera respuesta útil del producto ("¿cuándo corta y cuándo pago?").

**Independent Test**: con una tarjeta de corte 8 y pago 25, abrir su detalle en distintas fechas y
comparar con un calendario.

**Acceptance Scenarios**:

1. **Given** una tarjeta con corte 8 y pago 25 y hoy 21 de noviembre de 2026 en la zona del
   usuario, **When** abre el detalle, **Then** ve "Próximo corte: 8 de diciembre de 2026 · faltan
   17 días" y "Fecha límite de ese corte: 25 de diciembre de 2026 · faltan 34 días".
2. **Given** que hoy es el día de corte, **When** abre el detalle, **Then** el próximo corte es hoy
   y se muestra "Hoy" en lugar de "faltan 0 días"; si es mañana, "Mañana".
3. **Given** un usuario con zona horaria America/Bogota y otro con Europe/Madrid, **When** ambos
   abren el detalle a la misma hora en la que en Madrid ya es el día siguiente, **Then** cada uno
   ve las fechas y los días restantes calculados con su propio "hoy".
4. **Given** el detalle abierto, **When** el usuario cambia su zona horaria en el perfil y vuelve,
   **Then** el detalle se recalcula con la nueva zona.
5. **Given** el detalle, **When** el usuario lo revisa, **Then** también ve los datos de la tarjeta
   (cupo, tope por ciclo, días de recordatorio) y las acciones "Editar" y "Archivar".

---

### User Story 5 - Editar una tarjeta (Priority: P2)

Como usuario quiero corregir los datos de una tarjeta (por ejemplo, el banco me cambió el día de
corte o el cupo), y que las fechas mostradas se recalculen.

**Why this priority**: los datos de una tarjeta cambian con el tiempo, pero se puede vivir unos
días sin editar.

**Independent Test**: cambiar el día de corte de una tarjeta y ver el nuevo próximo corte en el
detalle y en el carrusel.

**Acceptance Scenarios**:

1. **Given** una tarjeta con corte 8, **When** el usuario la edita a corte 15 y guarda, **Then** el
   carrusel muestra "Corte día 15" y el detalle muestra el próximo corte con el día 15.
2. **Given** el formulario de edición, **When** el usuario ingresa datos inválidos, **Then** se
   aplican las mismas validaciones que al crear y no se guarda nada.
3. **Given** el formulario de edición, **When** el usuario cancela, **Then** la tarjeta queda como
   estaba.

---

### User Story 6 - Archivar y restaurar una tarjeta (Priority: P2)

Como usuario quiero archivar una tarjeta que ya no uso para que no aparezca en el carrusel, sin
perder sus datos, y poder restaurarla si vuelvo a usarla.

**Why this priority**: mantiene limpia la vista principal; no bloquea el uso de las demás tarjetas.

**Independent Test**: archivar una tarjeta, comprobar que no está en el carrusel y sí en
"Archivadas", y restaurarla.

**Acceptance Scenarios**:

1. **Given** el detalle de una tarjeta activa, **When** el usuario toca "Archivar" y confirma,
   **Then** la tarjeta deja de aparecer en el carrusel y sus datos se conservan.
2. **Given** que hay tarjetas archivadas, **When** el usuario abre "Archivadas" desde la pestaña
   Tarjetas, **Then** ve la lista con nombre, últimos 4 dígitos y color de cada una.
3. **Given** una tarjeta archivada, **When** el usuario toca "Restaurar", **Then** vuelve al
   carrusel con los mismos datos, en su posición según la fecha de creación.
4. **Given** que no hay tarjetas archivadas, **When** el usuario mira la pestaña Tarjetas, **Then**
   no ve el acceso a "Archivadas".

---

### User Story 7 - Mis tarjetas son solo mías (Priority: P1)

Como usuario quiero que nadie más pueda ver, editar, archivar ni restaurar mis tarjetas.

**Why this priority**: aislamiento por usuario, principio no negociable de la constitución.

**Independent Test**: con dos cuentas, intentar desde una ver o modificar una tarjeta de la otra.

**Acceptance Scenarios**:

1. **Given** dos usuarios con tarjetas, **When** cada uno lista sus tarjetas (activas o
   archivadas), **Then** solo ve las suyas.
2. **Given** el identificador de una tarjeta de otro usuario, **When** un usuario intenta verla,
   editarla, archivarla o restaurarla, **Then** la respuesta es la misma que para una tarjeta que no
   existe y la tarjeta del otro no cambia.
3. **Given** un usuario que elimina su cuenta (spec 001), **When** se completa la eliminación,
   **Then** sus tarjetas se borran con ella y las de otros usuarios no cambian.

---

### Edge Cases

- Día de corte o límite 29, 30 o 31 en meses que no los tienen: se usa el último día del mes, y el
  ajuste no se arrastra al mes siguiente (corte 31 → 28 de febrero → 31 de marzo).
- Día límite igual al día de corte: la fecha límite cae en el mes siguiente.
- Día límite que, ajustado al mes, coincidiría con el corte o quedaría antes (corte 28, pago 30 en
  febrero no bisiesto): la fecha límite pasa al mes siguiente (30 de marzo).
- Cambio de año: cortes de diciembre con pago en enero; compras del 31 de diciembre que caen en un
  corte de enero.
- Hoy es día de corte: el próximo corte es hoy y una compra de hoy pertenece a él.
- Entre un corte y su fecha límite (por ejemplo, 21 de noviembre con corte 8 y pago 25): el
  detalle muestra el próximo corte (8 de diciembre) y su fecha límite (25 de diciembre); la fecha
  límite pendiente del corte anterior (25 de noviembre) la calcula el dominio como "próxima fecha
  límite" y se mostrará cuando existan extractos (spec 003/004).
- Cambio de zona horaria: un mismo instante puede ser días distintos; "hoy" siempre es el día
  calendario en la zona del usuario.
- Tope igual al cupo: es válido.
- Nombre con espacios al inicio o al final: se recortan; nombre solo de espacios: inválido.
- Dos tarjetas con el mismo nombre: se permite (el color y los últimos 4 las distinguen).
- Archivar la única tarjeta activa: el carrusel pasa al estado vacío.
- Tarjeta archivada: no se edita hasta restaurarla; su detalle es de solo lectura.
- Usuario con la contraseña temporal pendiente (spec 001): no accede a las tarjetas hasta cambiarla.
- Sin conexión al guardar, editar, archivar o restaurar: se muestra el error de conexión y no se
  pierde lo escrito en el formulario.

## Requirements *(mandatory)*

### Functional Requirements

**Reglas de ciclo (dominio)**

- **FR-001**: El sistema MUST calcular la fecha de corte de un mes dado un día de corte (1–31): ese
  día del mes o, si el mes no lo tiene, el último día del mes.
- **FR-002**: El sistema MUST determinar, para una fecha de compra, el corte al que pertenece: el
  primer corte (FR-001) igual o posterior a la fecha de compra. Equivale a la regla 1 del MVP: si
  el día de la compra es menor o igual al día de corte de ese mes, cae en el corte de ese mes; si
  no, en el del mes siguiente.
- **FR-003**: El sistema MUST calcular la fecha límite de un corte: la primera fecha posterior al
  corte cuyo día es el día límite, ajustado al último día del mes cuando no existe. Equivale a la
  regla 2 del MVP (día límite mayor que el de corte → mismo mes; si no → mes siguiente) y además
  garantiza que la fecha límite nunca coincide con el corte ni queda antes de él.
- **FR-004**: El sistema MUST calcular, a partir de una fecha "hoy", el próximo corte (primer corte
  igual o posterior a hoy) y su fecha límite.
- **FR-005**: El sistema MUST calcular, a partir de "hoy", la próxima fecha límite: la primera
  fecha límite igual o posterior a hoy, considerando el corte anterior a hoy y el próximo.
- **FR-006**: El sistema MUST calcular los días calendario entre dos fechas. La fecha "hoy" en la
  zona horaria del usuario la obtiene el servidor a partir de su reloj y la zona IANA del usuario,
  y se entrega a las reglas como parámetro.
- **FR-007**: Las reglas FR-001 a FR-006 MUST ser funciones puras que reciben "hoy" como parámetro,
  sin reloj del sistema ni otro acceso externo, y MUST ser la única implementación de estas reglas
  que usan el servidor y la app.
- **FR-008**: Las reglas MUST tener pruebas automáticas que cubran como mínimo: febrero de 28 y 29
  días, meses de 30 días, días de corte y de pago 29, 30 y 31, corte y pago en el mismo mes y en el
  siguiente, día límite igual al de corte, cambio de año (diciembre → enero), hoy igual al día de
  corte, y los casos de la visión (corte 8 y pago 25 con compras del 8 y del 9 de noviembre).
- **FR-009**: La cobertura de las pruebas del dominio MUST ser al menos 95% y la integración
  continua MUST fallar si baja de ese valor.

**Tarjetas**

- **FR-010**: El usuario MUST poder crear tarjetas con: nombre (1–40 caracteres tras recortar
  espacios), color (una de las 6 claves de color de tarjeta del sistema de diseño), últimos 4
  dígitos (opcional; exactamente 4 dígitos), día de corte (entero 1–31), día límite (entero 1–31),
  cupo total (entero en pesos, mayor que 0), tope por ciclo (entero en pesos, mayor que 0 y no
  mayor que el cupo), días de recordatorio del corte (entero 0–15, por defecto 2) y del pago
  (entero 0–15, por defecto 3).
- **FR-011**: El sistema MUST validar los campos de FR-010 en el servidor y en la app con las
  mismas reglas, e indicar por campo qué corregir.
- **FR-012**: El usuario MUST poder tener varias tarjetas activas; se listan en el orden de
  creación.
- **FR-013**: El usuario MUST poder editar todos los campos de una tarjeta activa con las mismas
  validaciones; los cambios de día de corte o límite se reflejan de inmediato en las fechas
  calculadas (todavía no hay extractos que recalcular; esa regla llega en la spec 003).
- **FR-014**: El usuario MUST poder archivar una tarjeta activa (con confirmación). Una tarjeta
  archivada no aparece en el carrusel, conserva todos sus datos, no se puede editar y su detalle es
  de solo lectura.
- **FR-015**: El usuario MUST poder ver la lista de sus tarjetas archivadas y restaurar cualquiera,
  que vuelve a estar activa con los mismos datos.
- **FR-016**: Las tarjetas no se borran individualmente en esta spec; solo se borran con la
  eliminación de la cuenta (cascada, spec 001).
- **FR-017**: El cupo disponible de una tarjeta MUST mostrarse igual a su cupo total mientras no
  existan compras (el cálculo real llega en la spec 003).

**Aislamiento**

- **FR-018**: Toda operación sobre tarjetas MUST limitarse a las tarjetas del usuario autenticado;
  una tarjeta de otro usuario MUST tratarse como inexistente (misma respuesta) en lectura, edición,
  archivado y restauración.
- **FR-019**: Cada operación sobre tarjetas MUST tener pruebas automáticas con dos usuarios que
  verifiquen que ninguno lee, lista, modifica, archiva ni restaura las tarjetas del otro.

**App**

- **FR-020**: Con sesión iniciada, la app MUST mostrar una barra inferior con tres pestañas: Inicio
  (la pantalla temporal actual), Tarjetas y Perfil. La pestaña activa se distingue con texto en
  negrita y color, no solo con color. El botón central "Registrar compra" y la pestaña Pagos no se
  muestran en esta spec.
- **FR-021**: La pestaña Tarjetas MUST mostrar las tarjetas activas en un carrusel horizontal que
  avanza de a una tarjeta, deja ver el borde de la siguiente y muestra un indicador de posición.
  Cada tarjeta tiene la proporción de una tarjeta bancaria (1,586:1) y muestra el degradado de su
  color, nombre, "**** últimos 4" (si existen), cupo disponible en pesos y "Corte día X · Pago día
  Y", según la vista de tarjeta del sistema de diseño. Con una sola tarjeta, esta ocupa el ancho de
  la pantalla menos los márgenes (pantalla − 40) y queda centrada; con varias, cada una mide
  pantalla − 56, asoman unos 16 px de la siguiente y al deslizar cada tarjeta se alinea con el
  margen izquierdo de 20, igual en iOS y Android.
- **FR-022**: La pestaña Tarjetas MUST ofrecer "Agregar tarjeta", un estado vacío con invitación a
  agregar la primera tarjeta, y el acceso a "Archivadas" cuando existan.
- **FR-023**: El detalle de una tarjeta MUST mostrar la vista de la tarjeta, el próximo corte y su
  fecha límite con los días que faltan para cada uno ("Hoy", "Mañana" o "faltan N días"), y los
  datos configurados (cupo, tope por ciclo, días de recordatorio), calculados con la zona horaria
  del usuario y la fecha actual en esa zona (la que da el servidor, para
  que la app y el servidor no muestren días distintos si el reloj del teléfono está mal).
- **FR-024**: Los montos MUST mostrarse en pesos colombianos sin decimales, con separador de miles
  y números tabulares (por ejemplo "$5.000.000"); las fechas en español (por ejemplo "8 de
  diciembre de 2026").
- **FR-025**: El formulario de tarjeta MUST ofrecer los 6 colores como opciones tocables, cada una
  con su degradado y su nombre accesible (Negro, Morado, Amarillo, Naranja, Verde, Marrón), y la
  opción elegida marcada también con un indicador visual distinto del color.
- **FR-027**: Las tarjetas creadas con los colores anteriores MUST conservarse con el color nuevo
  más parecido: grafito → negro, ciruela → morado, índigo → morado, bosque → verde, petróleo →
  verde y terracota → marrón. Las claves anteriores dejan de aceptarse.
- **FR-026**: El perfil (spec 001) pasa a ser la pestaña Perfil; sus pantallas (zona horaria,
  cambio de contraseña, eliminar cuenta) siguen funcionando igual. Con la contraseña temporal
  pendiente, solo es accesible el cambio de contraseña, como en la spec 001.
- **FR-027**: Todas las pantallas nuevas MUST seguir `docs/design-system.md` (tokens del tema,
  áreas táctiles de al menos 44, contraste AA, estados con texto).

### Key Entities

- **Tarjeta (Card)**: pertenece a un usuario. Nombre, color (clave), últimos 4 dígitos opcionales,
  día de corte, día límite, cupo total y tope por ciclo (enteros en pesos), días de recordatorio
  del corte y del pago, fecha de archivado (vacía si está activa), fechas de creación y
  actualización. Se borra en cascada con el usuario.
- **Ciclo (derivado, no se guarda en esta spec)**: fecha de corte y su fecha límite, calculadas
  por el dominio a partir de la tarjeta y de una fecha. Los extractos que se guardan llegan en la
  spec 003.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los casos de calendario de FR-008 y de los escenarios de la historia 1
  dan la fecha esperada en las pruebas automáticas.
- **SC-002**: La cobertura de las pruebas del dominio es al menos 95% y la integración continua
  rechaza cambios que la bajen.
- **SC-003**: Para una muestra de al menos 24 combinaciones (día de corte, día límite, fecha) que
  incluya todos los meses de un año bisiesto y uno no bisiesto, las fechas del detalle coinciden
  con las calculadas a mano en un calendario.
- **SC-004**: Un usuario registra una tarjeta completa en menos de 1 minuto y la ve en el carrusel
  sin recargar.
- **SC-005**: En las pruebas con dos usuarios, el 100% de los intentos de leer, listar, editar,
  archivar o restaurar tarjetas del otro fallan sin revelar si la tarjeta existe.
- **SC-006**: Una tarjeta archivada y restaurada conserva el 100% de sus datos.
- **SC-007**: Las pantallas nuevas cumplen el sistema de diseño: contraste AA en todo el texto
  (incluido el texto principal y secundario sobre los dos extremos del degradado de los 6 colores
  de tarjeta) y áreas táctiles de al menos 44.

## Ajustes de diseño (2026-11-22)

Antes de cerrar la spec se ajustaron la vista de tarjeta y sus colores (FR-021, FR-025, FR-027,
SC-007): tarjetas más grandes con proporción 1,586:1 y anchos según cuántas haya, y seis colores
nuevos con degradado diagonal (negro, morado, amarillo, naranja, verde, marrón), con texto oscuro
sobre el amarillo. Las tarjetas existentes se migran al color nuevo más parecido.

## Assumptions

- **Regla 2 en el borde del ajuste de fin de mes**: la regla 2 del MVP compara los días
  configurados; cuando el ajuste al último día del mes haría que la fecha límite coincidiera con el
  corte (corte 28 y pago 30 en febrero), se toma la del mes siguiente. Se formula como "la primera
  fecha límite posterior al corte", que coincide con la regla 2 en todos los demás casos.
- **Fecha límite en el detalle**: el detalle muestra la fecha límite del próximo corte, como pide
  la historia. Entre un corte y su fecha límite, el pago pendiente del corte anterior todavía no
  tiene monto (no hay compras), así que no se muestra; el dominio ya calcula esa "próxima fecha
  límite" (FR-005) para el inicio, los extractos y los recordatorios de las specs 003–005.
- **"Hoy"** lo calcula el servidor con su reloj y la zona horaria del usuario, y lo envía a la app
  junto con las fechas del ciclo; las reglas en sí no leen el reloj.
- **Límites de los campos**: nombre de 1 a 40 caracteres (cabe en la vista de tarjeta); cupo y tope
  hasta $9.999.999.999; recordatorios de 0 a 15 días (0 = el mismo día). Los recordatorios solo se
  guardan; los avisos llegan en la spec 005.
- **Tope no mayor que el cupo**: se exige para detectar errores de digitación; no hay límite en la
  cantidad de tarjetas por usuario.
- **Orden del carrusel**: por fecha de creación; reordenar queda fuera de alcance.
- **Archivar en vez de borrar**: como en el MVP, quitar una tarjeta significa archivarla; no hay
  borrado individual de tarjetas en esta spec.
- **Inicio**: la pestaña Inicio conserva la pantalla temporal de la spec 001 (saludo); el botón
  "Perfil" de esa pantalla se quita porque Perfil pasa a ser pestaña. El inicio con resumen llega
  en la spec 004.
- **Dependencias**: spec 001 (cuentas, sesión, zona horaria del usuario, eliminación en cascada).
- **Fuera de alcance**: compras, extractos y su recálculo al cambiar fechas, cuotas, alertas y
  recordatorios, cupo disponible real, botón central "Registrar compra" y pestaña Pagos.
- **v2**: ajustar las fechas de corte y de pago por fines de semana y festivos de Colombia (anotado
  en `docs/mvp-spec.md`); en esta spec las fechas siguen solo el calendario.
