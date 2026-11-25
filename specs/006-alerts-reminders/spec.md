# Feature Specification: Alertas y recordatorios

**Feature Branch**: `006-alerts-reminders`

**Created**: 2026-11-25

**Status**: Draft

**Reference**: `docs/mvp-spec.md` → HU-06 y reglas "Cupo, tope y alertas" 3 y 5;
`docs/design-system.md` → "Pantalla de inicio" (punto 1, botón de notificaciones); `specs/002-cards/spec.md`
→ días de recordatorio de la tarjeta (0–15) y "hoy" del servidor; `specs/003-purchases/spec.md` →
extractos, "A pagar", estados y uso del tope; `specs/004-home-simulator/spec.md` → umbrales 70% y
100% del tope; `specs/005-recurring-payments/spec.md` → ocurrencias y su estado;
`specs/001-auth/spec.md` → cierre de sesión, eliminación de la cuenta y zona horaria.

**Input**: User description: "Spec 006 — Alertas y recordatorios. Corresponde a HU-06 de
docs/mvp-spec.md (reglas 'Cupo, tope y alertas' 3 y 5), más los recordatorios de pagos recurrentes
que quedaron pendientes de la spec 005. Como usuario quiero: 1. Que después de iniciar sesión la app
me explique para qué son las notificaciones y luego me pida el permiso del sistema. Si lo niego, la
app sigue funcionando y en Perfil puedo ver el estado y abrir los ajustes del sistema. 2. Alertas de
tope: al registrar o editar una compra, si el uso del tope del ciclo abierto de esa tarjeta cruza el
70%, el 90% o el 100%, recibo un push por cada umbral cruzado, una sola vez por umbral y ciclo (ej.
'Visa principal: llevas el 92% del tope de este ciclo'). 3. Recordatorio de corte: N días antes del
corte (configurado en la tarjeta, por defecto 2), con lo acumulado en el ciclo. 4. Recordatorio de
pago: N días antes de la fecha límite (configurado en la tarjeta, por defecto 3), con el monto 'A
pagar' exacto del extracto, solo si no está marcado como pagado. 5. Recordatorio de pagos
recurrentes: N días antes del vencimiento de cada ocurrencia pendiente (por defecto 2, configurable
en el pago recurrente), con nombre y monto. 6. Los recordatorios llegan una vez al día a las 7:00 en
mi zona horaria, agrupados si hay varios ese día, y nunca se repite el mismo recordatorio. 7. Al
tocar una notificación, la app abre la pantalla correspondiente (extracto, tarjeta o pago del mes).
8. La campana del inicio abre el historial de mis últimas notificaciones de los últimos 30 días. 9.
En Perfil, un botón 'Enviar notificación de prueba' para comprobar que me llegan. 10. Si cierro
sesión o elimino la cuenta, ese dispositivo deja de recibir notificaciones. Puedo tener la app en
varios dispositivos y todos reciben. Reglas: los cálculos de umbrales, fechas de recordatorio y
montos usan el dominio y el 'hoy' del servidor; el envío es por Expo Push; un token que Expo reporta
como no registrado se elimina; el envío fallido no rompe el registro de la compra. Criterios de
aceptación: con tope $2.000.000 y $1.300.000 acumulados, registrar $600.000 envía una sola alerta
del 90% (cruza 70% y 90%, se agrupa en una); con corte 8 y recordatorio de 2 días, el 6 a las 7:00
llega el recordatorio de corte y el 7 no; un extracto pagado no genera recordatorio de pago; un
usuario nunca recibe notificaciones de datos de otro. Fuera de alcance: preferencias por tipo de
notificación, horario configurable, correo o SMS (v2)."

## User Scenarios & Testing *(mandatory)*

Actor: **usuario** con sesión iniciada (spec 001). "Hoy" es la fecha en su zona horaria según el
servidor (spec 002), no la del teléfono.

Términos usados en esta spec:

- **Dispositivo registrado**: un teléfono con la app, con sesión iniciada de un usuario y con
  permiso de notificaciones concedido, que el servidor conoce como destino de los avisos de ese
  usuario. Un usuario puede tener varios; un dispositivo pertenece a un solo usuario a la vez.
- **Notificación**: un aviso que Corte genera para el usuario. Se envía como push a todos sus
  dispositivos registrados y queda en su historial. Tiene un tipo, un título, un texto y un destino
  (la pantalla que abre).
- **Uso del tope**: el de la spec 003: "A pagar" del extracto abierto de la tarjeta (el del próximo
  corte) ÷ tope por ciclo, en porcentaje entero redondeado hacia abajo (99,6% es 99%).
- **Ciclo**: el periodo de un extracto, identificado por su fecha de corte.
- **Umbrales**: 70%, 90% y 100% del tope. Una compra **cruza** un umbral cuando el uso del tope
  antes de registrarla o editarla está por debajo del umbral y después queda en el umbral o por
  encima.
- **Alerta de tope**: notificación inmediata de que el uso del tope de una tarjeta cruzó un umbral.
- **Recordatorio**: notificación programada de un corte próximo, una fecha límite próxima o un pago
  recurrente próximo. Los recordatorios del día se envían juntos a las 7:00 del usuario.
- **Días de anticipación (N)**: cuántos días antes llega un recordatorio. 0 significa el mismo día.
  La tarjeta ya los tiene para el corte (por defecto 2) y el pago (por defecto 3), de 0 a 15 (spec
  002); el pago recurrente los incorpora en esta spec (por defecto 2, de 0 a 15).

### User Story 1 - Activar las notificaciones (Priority: P1)

Como usuario quiero que la app me explique para qué sirven las notificaciones antes de pedirme el
permiso, y poder activarlas o no sin que eso me impida usar Corte.

**Why this priority**: sin permiso no llega ningún push; es la puerta de entrada de toda la spec y
el sistema solo deja pedir el permiso una vez.

**Independent Test**: instalar la app en un teléfono nuevo, iniciar sesión, pasar por la
explicación, aceptar o negar el permiso y revisar el estado en Perfil.

**Acceptance Scenarios**:

1. **Given** un usuario que inicia sesión o crea su cuenta en un dispositivo donde nunca vio la
   explicación, **When** entra a la app, **Then** ve la pantalla "Activa las notificaciones", que
   explica que avisan al acercarse al tope, antes del corte, antes de la fecha límite y antes de
   cada pago fijo, con los botones "Activar notificaciones" y "Ahora no".
2. **Given** esa pantalla, **When** el usuario toca "Activar notificaciones" y acepta el permiso del
   sistema, **Then** el dispositivo queda registrado y el usuario llega al inicio.
3. **Given** esa pantalla, **When** el usuario niega el permiso del sistema o toca "Ahora no",
   **Then** llega al inicio y la app funciona igual (tarjetas, compras, pagos e historial de
   notificaciones), solo que no recibe push.
4. **Given** un usuario que ya vio la explicación en este dispositivo, **When** vuelve a iniciar
   sesión, **Then** no se le muestra de nuevo.
5. **Given** Perfil, **When** el usuario mira la fila "Notificaciones", **Then** ve el estado
   escrito: "Activadas", "Desactivadas" (permiso negado) o "Sin activar" (nunca lo concedió ni lo
   negó), con la acción que corresponde: ninguna, "Abrir ajustes" o "Activar".
6. **Given** el estado "Desactivadas", **When** el usuario toca "Abrir ajustes", activa el permiso
   en los ajustes del sistema y vuelve a la app, **Then** Perfil muestra "Activadas" y el
   dispositivo queda registrado sin hacer nada más.
7. **Given** el estado "Sin activar", **When** el usuario toca "Activar", **Then** se le pide el
   permiso del sistema y Perfil muestra el resultado.
8. **Given** un usuario con sesión iniciada desde antes de esta versión, **When** abre la app
   actualizada por primera vez, **Then** ve la explicación una vez, como si acabara de iniciar
   sesión.

---

### User Story 2 - Alertas de tope (Priority: P1)

Como usuario quiero enterarme en el momento en que una compra me acerca o me pasa del tope del
ciclo de una tarjeta, para frenar a tiempo.

**Why this priority**: es el objetivo del MVP ("nunca pasarse del tope sin enterarse") y la regla
3 de "Cupo, tope y alertas".

**Independent Test**: con una tarjeta y su tope, registrar y editar compras que lleven el uso del
tope por debajo y por encima de cada umbral, y comprobar qué alertas llegan y cuáles no.

**Acceptance Scenarios**:

1. **Given** hoy 25 de noviembre de 2026, "Visa principal" con corte el 8, tope de $2.000.000 y un
   extracto abierto (corte 8 de diciembre) con "A pagar" de $1.300.000 (65%), **When** el usuario
   registra una compra de hoy de $600.000 a 1 cuota sin interés, **Then** recibe una sola alerta,
   la del 90%: "Visa principal: llevas el 95% del tope de este ciclo"; el 70% queda también
   marcado como avisado en ese ciclo.
2. **Given** el mismo ciclo después del escenario 1 (95%), **When** el usuario registra otra compra
   que deja el uso en 102%, **Then** recibe "Visa principal: superaste el tope de este ciclo
   (102%)".
3. **Given** el mismo ciclo con los tres umbrales ya avisados, **When** el usuario registra más
   compras, **Then** no recibe más alertas de tope de esa tarjeta en ese ciclo.
4. **Given** un ciclo al 75% con el 70% ya avisado, **When** el usuario borra o edita una compra y
   el uso baja a 60%, y luego registra otra que lo sube a 72%, **Then** no recibe de nuevo la
   alerta del 70% (una vez por umbral y ciclo).
5. **Given** un ciclo al 65%, **When** el usuario edita una compra existente y el uso pasa a 80%,
   **Then** recibe la alerta del 70%.
6. **Given** el ciclo siguiente (corte 8 de enero), **When** una compra lleva su uso al 70% o más,
   **Then** recibe la alerta del 70% aunque en el ciclo anterior ya la hubiera recibido.
7. **Given** una compra con fecha pasada cuyas cuotas caen todas en extractos ya cerrados, **When**
   el usuario la registra, **Then** el uso del tope del extracto abierto no cambia y no hay alerta.
8. **Given** una compra a 6 cuotas, **When** se registra, **Then** solo cuenta para la alerta la
   cuota que cae en el extracto abierto (con su interés estimado), como en el uso del tope de la
   spec 003.
9. **Given** que el envío del push falla o el usuario no tiene dispositivos registrados, **When**
   registra la compra, **Then** la compra se guarda igual, sin error, y la alerta aparece en su
   historial.

---

### User Story 3 - Recordatorios de corte y de pago de tarjetas (Priority: P1)

Como usuario quiero que Corte me recuerde, unos días antes, cuándo corta cada tarjeta y cuánto y
hasta cuándo tengo que pagarla, para no pagar tarde.

**Why this priority**: es la regla 5 de "Cupo, tope y alertas" y el objetivo central del MVP
("nunca pagar tarde").

**Independent Test**: con tarjetas con distintos días de corte, de pago y de anticipación, fijar el
"hoy" del servidor en varias fechas y comprobar qué recordatorios se generan a las 7:00.

**Acceptance Scenarios**:

1. **Given** "Visa principal" con corte el 8, recordatorio de corte de 2 días y $1.900.000
   acumulados en el ciclo, **When** son las 7:00 del 6 de diciembre de 2026 en la zona del
   usuario, **Then** llega "Visa principal: el corte es en 2 días (8 dic). Llevas $1.900.000 en
   este ciclo."
2. **Given** la misma tarjeta, **When** son las 7:00 del 7 de diciembre, **Then** no llega
   recordatorio de corte (el del 6 no se repite y no hay otro para ese corte).
3. **Given** una tarjeta con recordatorio de corte de 0 días y corte el 8, **When** son las 7:00
   del 8, **Then** llega "…el corte es hoy (8 dic)…".
4. **Given** el extracto con corte 8 de diciembre y fecha límite 25 de diciembre, "A pagar"
   $1.950.000, no pagado, y recordatorio de pago de 3 días, **When** son las 7:00 del 22 de
   diciembre, **Then** llega "Visa principal: paga $1.950.000 hasta el 25 dic (faltan 3 días)."
5. **Given** ese extracto marcado como pagado el 20 de diciembre, **When** son las 7:00 del 22,
   **Then** no llega recordatorio de pago.
6. **Given** una tarjeta con corte el 20, fecha límite el 22 y recordatorio de pago de 3 días,
   **When** el día que tocaría (19) es anterior o igual al corte, **Then** el recordatorio de pago
   llega a las 7:00 del 21, el día siguiente al corte, con el "A pagar" ya cerrado.
7. **Given** una tarjeta con corte el 31, **When** el mes es febrero de 2027, **Then** el corte es
   el 28 de febrero y el recordatorio de 2 días llega el 26 de febrero.
8. **Given** un extracto por pagar con "A pagar" de $0, o una tarjeta sin nada acumulado en el
   ciclo, **When** llega el día del recordatorio, **Then** no se envía el recordatorio de pago o de
   corte correspondiente.
9. **Given** una tarjeta archivada, **When** llega el día de cualquiera de sus recordatorios,
   **Then** no se envía ninguno.
10. **Given** un usuario que cambia su zona horaria (spec 001), **When** llega el día siguiente,
    **Then** los recordatorios llegan a las 7:00 de la zona nueva.

---

### User Story 4 - Recordatorios de pagos recurrentes (Priority: P2)

Como usuario quiero que Corte me recuerde mis pagos fijos unos días antes de que venzan, con su
nombre y su monto.

**Why this priority**: completa lo que quedó pendiente en la spec 005; depende de los recordatorios
diarios de la historia 3.

**Independent Test**: con pagos recurrentes de distintos días de anticipación, pagados,
pendientes, pausados y eliminados, fijar el "hoy" del servidor y comprobar qué recordatorios se
generan.

**Acceptance Scenarios**:

1. **Given** "Celular" $65.000 con vencimiento el 28 de diciembre de 2026, Pendiente y con
   recordatorio de 2 días, **When** son las 7:00 del 26 de diciembre, **Then** llega "Celular:
   $65.000 vence el 28 dic (en 2 días)."
2. **Given** esa ocurrencia marcada como pagada el 24 de diciembre, **When** son las 7:00 del 26,
   **Then** no llega recordatorio.
3. **Given** el formulario de un pago recurrente (nuevo o editado), **When** el usuario lo abre,
   **Then** ve el campo "Recordar con anticipación" con 2 días por defecto, que acepta de 0 a 15; el
   detalle del pago muestra el valor elegido.
4. **Given** un pago recurrente Activo cuyo mes el usuario todavía no ha abierto en la app,
   **When** llega el día del recordatorio de su próximo vencimiento, **Then** el recordatorio llega
   igual.
5. **Given** un pago Pausado cuya ocurrencia del periodo actual se conservó Pendiente (spec 005),
   **When** llega el día de su recordatorio, **Then** llega; los periodos en que está pausado no
   tienen recordatorio.
6. **Given** un pago eliminado, **When** llega el día que hubiera tenido recordatorio, **Then** no
   llega nada.
7. **Given** un pago anual "SOAT" que vence el 10 de marzo de 2027 con recordatorio de 15 días,
   **When** son las 7:00 del 23 de febrero de 2027, **Then** llega su recordatorio.

---

### User Story 5 - Recordatorios agrupados, a las 7:00 y sin repetirse (Priority: P1)

Como usuario quiero recibir los recordatorios del día juntos a una hora fija de la mañana y nunca
el mismo dos veces, para que no me molesten.

**Why this priority**: sin esta regla los recordatorios se vuelven ruido y el usuario los desactiva.

**Independent Test**: preparar un día con varios recordatorios de distintos tipos y un día con
uno solo; correr el envío dos veces el mismo día y comprobar cuántos push llegan.

**Acceptance Scenarios**:

1. **Given** un día con un recordatorio de corte de "Visa principal" y uno del pago recurrente
   "Internet", **When** son las 7:00, **Then** llega un solo push "Tienes 2 recordatorios hoy" que
   menciona ambos, y el historial muestra los dos por separado.
2. **Given** un día con un solo recordatorio, **When** son las 7:00, **Then** llega ese
   recordatorio solo, con su propio texto.
3. **Given** que los recordatorios del día ya se enviaron, **When** el envío diario corre otra vez
   ese día (por ejemplo, tras reiniciar el servidor), **Then** no llega ningún push repetido.
4. **Given** que el servidor no estuvo disponible a las 7:00, **When** vuelve más tarde ese mismo
   día, **Then** envía los recordatorios pendientes de ese día una sola vez; los de días que ya
   pasaron no se envían.
5. **Given** que el usuario cambia los días de anticipación de una tarjeta después de recibir el
   recordatorio de un corte, **When** llega la nueva fecha calculada para ese mismo corte, **Then**
   no recibe un segundo recordatorio de ese corte.
6. **Given** un usuario con dos dispositivos registrados, **When** son las 7:00, **Then** el mismo
   push llega a los dos y el historial lo muestra una sola vez.

---

### User Story 6 - Abrir la pantalla desde la notificación (Priority: P2)

Como usuario quiero que, al tocar una notificación, la app me lleve a lo que me está avisando.

**Why this priority**: convierte el aviso en acción (pagar, revisar el ciclo) con un toque.

**Independent Test**: tocar cada tipo de notificación con la app cerrada, en segundo plano y
abierta, y comprobar la pantalla que se abre.

**Acceptance Scenarios**:

1. **Given** una alerta de tope o un recordatorio de corte, **When** el usuario la toca, **Then**
   se abre el detalle de esa tarjeta.
2. **Given** un recordatorio de pago, **When** el usuario lo toca, **Then** se abre el detalle de
   ese extracto.
3. **Given** un recordatorio de un pago recurrente, **When** el usuario lo toca, **Then** se abre
   el detalle de esa ocurrencia (el pago del mes).
4. **Given** un push agrupado de varios recordatorios, **When** el usuario lo toca, **Then** se
   abre el historial de notificaciones.
5. **Given** la app cerrada por completo, **When** el usuario toca una notificación, **Then** la app
   abre y llega a esa misma pantalla.
6. **Given** que lo avisado ya no existe (tarjeta archivada, pago recurrente eliminado, extracto que
   ya no existe), **When** el usuario toca la notificación, **Then** se abre el historial con el
   mensaje "Esto ya no está disponible".
7. **Given** un dispositivo cuya sesión ya no es de ese usuario, **When** alguien toca una
   notificación vieja de ese usuario, **Then** la app no muestra ningún dato de él: pide iniciar
   sesión o abre el inicio de quien tiene la sesión.

---

### User Story 7 - Historial de notificaciones (Priority: P2)

Como usuario quiero ver desde el inicio las notificaciones de los últimos 30 días, aunque haya
borrado los push o no tenga el permiso activado.

**Why this priority**: es el botón de notificaciones del diseño del inicio y el respaldo de quien
no activó los push.

**Independent Test**: generar alertas y recordatorios en distintas fechas y comprobar el historial
desde la campana.

**Acceptance Scenarios**:

1. **Given** el inicio, **When** el usuario toca la campana del saludo, **Then** se abre
   "Notificaciones" con sus alertas y recordatorios de los últimos 30 días, de la más reciente a la
   más antigua, cada una con título, texto y fecha ("Hoy, 7:00", "Ayer, 15:42", "23 nov, 7:00").
2. **Given** el historial, **When** el usuario toca una notificación, **Then** se abre la misma
   pantalla que al tocar el push (historia 6).
3. **Given** un usuario sin permiso de notificaciones, **When** registra una compra que cruza un
   umbral o llega un día de recordatorio, **Then** la notificación aparece igual en su historial.
4. **Given** una notificación de hace 31 días, **When** el usuario abre el historial, **Then** ya no
   aparece.
5. **Given** un usuario sin notificaciones en los últimos 30 días, **When** abre el historial,
   **Then** ve "Sin notificaciones en los últimos 30 días".

---

### User Story 8 - Notificación de prueba (Priority: P3)

Como usuario quiero comprobar desde Perfil que las notificaciones me llegan a este teléfono.

**Why this priority**: ayuda a diagnosticar permisos o configuración, pero no aporta avisos reales.

**Independent Test**: en Perfil, con y sin permiso, tocar "Enviar notificación de prueba" y
comprobar el resultado.

**Acceptance Scenarios**:

1. **Given** notificaciones "Activadas" en este dispositivo, **When** el usuario toca "Enviar
   notificación de prueba", **Then** ve "Te enviamos una notificación de prueba" y en menos de un
   minuto le llega a este dispositivo "Corte: las notificaciones funcionan".
2. **Given** notificaciones "Desactivadas" o "Sin activar", **When** el usuario mira Perfil,
   **Then** el botón no está disponible y la fila indica cómo activarlas.
3. **Given** que el envío falla, **When** el usuario toca el botón, **Then** ve "No pudimos enviar
   la notificación. Intenta de nuevo." y puede reintentar.
4. **Given** varios toques seguidos, **When** el usuario insiste, **Then** se envía como máximo una
   prueba cada 30 segundos y el botón lo indica mientras espera.
5. **Given** una notificación de prueba, **When** el usuario abre el historial, **Then** no aparece.

---

### User Story 9 - Varios dispositivos, cierre de sesión y eliminación de la cuenta (Priority: P1)

Como usuario quiero recibir los avisos en todos los teléfonos donde uso Corte, y que un teléfono
donde cerré sesión o eliminé la cuenta deje de recibirlos.

**Why this priority**: evita que un teléfono compartido o vendido siga mostrando datos financieros
de alguien.

**Independent Test**: registrar dos dispositivos del mismo usuario, comprobar que ambos reciben;
cerrar sesión en uno, eliminar la cuenta y cambiar de usuario en el mismo teléfono.

**Acceptance Scenarios**:

1. **Given** un usuario con la app en dos teléfonos con notificaciones activadas, **When** se
   genera una alerta o un recordatorio, **Then** llega a los dos.
2. **Given** esos dos teléfonos, **When** el usuario cierra sesión en uno, **Then** ese teléfono
   deja de recibir sus notificaciones y el otro las sigue recibiendo.
3. **Given** un usuario que elimina su cuenta, **When** se genera cualquier aviso que hubiera sido
   suyo, **Then** no llega a ningún dispositivo y su historial se borra con la cuenta.
4. **Given** un teléfono donde el usuario A cerró sesión y el usuario B la inicia y activa las
   notificaciones, **When** se generan avisos de A y de B, **Then** ese teléfono recibe solo los de
   B.
5. **Given** una sesión que termina sin cerrar sesión desde la app (expiró, fue revocada o el
   administrador restableció la contraseña, spec 001), **When** se generan avisos de ese usuario,
   **Then** ese dispositivo no los recibe hasta que vuelva a iniciar sesión.
6. **Given** que el servicio de push informa que un dispositivo ya no existe (app desinstalada),
   **When** el servidor lo sabe, **Then** deja de enviarle y lo quita de los destinos del usuario.

---

### User Story 10 - Mis notificaciones son solo mías (Priority: P1)

Como usuario quiero que nadie reciba ni vea avisos con mis datos.

**Why this priority**: principio de aislamiento por usuario de la constitución; los avisos llevan
montos y nombres de tarjetas.

**Independent Test**: pruebas automáticas con dos usuarios.

**Acceptance Scenarios**:

1. **Given** dos usuarios A y B con dispositivos registrados, **When** se genera cualquier alerta
   o recordatorio de A, **Then** solo llega a dispositivos de A y solo aparece en el historial de A.
2. **Given** el historial, **When** B lo pide, **Then** solo ve sus propias notificaciones.
3. **Given** un dispositivo registrado por A, **When** B intenta quitarlo o enviarle una prueba
   sin tener la sesión en ese dispositivo, **Then** no afecta a A y no se revela nada de A.
   (Registrar un dispositivo requiere su identificador de push, que solo existe en el propio
   teléfono: registrarlo con otra cuenta es el cambio de usuario de la historia 9, escenario 4.)
4. **Given** una notificación de A, **When** B intenta abrir su destino, **Then** recibe la misma
   respuesta que para algo inexistente.

---

### Edge Cases

- **Compra que cruza los tres umbrales a la vez** (de 50% a 110%): llega una sola alerta, la del
  100%, y quedan marcados los tres umbrales de ese ciclo.
- **Uso exactamente en el umbral** (70% justo): cuenta como cruzado; 69,9% se redondea a 69% y no
  cuenta.
- **Tope cambiado en la tarjeta**: editar el tope (spec 002) no genera alertas por sí solo; la
  próxima compra o edición compara contra el tope nuevo, y los umbrales ya avisados en el ciclo
  siguen avisados.
- **Edición que mueve cuotas fuera del ciclo abierto** (por ejemplo, cambiar la fecha de la
  compra): se evalúa el ciclo abierto de la tarjeta antes y después del cambio; si el uso baja, no
  hay alerta. Una compra no cambia de tarjeta al editarla (spec 003).
- **Cambio de fechas de una tarjeta** (spec 002): si cambia la fecha del próximo corte, ese corte
  es otro y puede tener su propio recordatorio; el ya enviado no se repite para la misma fecha.
- **Corte o fecha límite en un día que no existe en el mes**: se usa el último día del mes (spec
  002) y el recordatorio se cuenta desde esa fecha.
- **Recordatorio que cae antes de hoy al crear la tarjeta o el pago**: no se envía uno atrasado; el
  primer recordatorio es el del próximo corte, fecha límite o vencimiento que aún esté a tiempo.
- **Extracto vencido sin pagar**: no recibe recordatorios después de la fecha límite (los avisos de
  mora son de la v2); sigue visible como Vencido en la app.
- **Día con 10 o más recordatorios**: el push agrupado muestra el número total y los primeros; el
  historial los tiene todos.
- **Alerta de tope a las 7:00 o cerca**: las alertas de tope son inmediatas y nunca se agrupan con
  los recordatorios del día.
- **Dispositivo sin soporte de push** (simulador o sin servicios del sistema): Perfil dice que este
  dispositivo no puede recibir notificaciones; el historial funciona igual.
- **Permiso revocado en los ajustes del sistema** con la app instalada: al volver a la app, Perfil
  muestra "Desactivadas" y el dispositivo deja de ser destino.
- **Sin conexión al activar el permiso**: el registro del dispositivo se reintenta la próxima vez
  que la app abra con conexión; Perfil no dice "Activadas" hasta que el servidor lo confirme.
- **Montos muy grandes** (máximo de la spec 002): el texto del push se arma completo; si el sistema
  lo corta en pantalla, el historial lo muestra entero.

## Requirements *(mandatory)*

### Functional Requirements

**Permiso y dispositivos**

- **FR-001**: Después de iniciar sesión o crear la cuenta, la app MUST mostrar una vez por
  dispositivo la explicación "Activa las notificaciones" con "Activar notificaciones" (que pide el
  permiso del sistema) y "Ahora no". También MUST mostrarla una vez a quien ya tenía la sesión
  iniciada al actualizar a esta versión. El permiso del sistema MUST NOT pedirse sin la
  explicación antes.
- **FR-002**: Negar el permiso o elegir "Ahora no" MUST NOT bloquear ninguna función de la app.
- **FR-003**: Perfil MUST mostrar el estado de las notificaciones de este dispositivo como texto
  ("Activadas", "Desactivadas", "Sin activar" o "No disponibles en este dispositivo") con su
  acción: "Activar" (pide el permiso) o "Abrir ajustes" (abre los ajustes del sistema de la app).
  El estado MUST actualizarse al volver a la app.
- **FR-004**: Con permiso concedido y sesión iniciada, el dispositivo MUST registrarse como destino
  del usuario, y MUST mantener al día su identificador de push cada vez que la app abre.
- **FR-005**: Un dispositivo MUST ser destino de un solo usuario a la vez y solo mientras tenga una
  sesión válida de ese usuario. Al cerrar sesión, al terminar la sesión por expiración o
  revocación, o al eliminar la cuenta, MUST dejar de recibir sus notificaciones.
- **FR-006**: Un usuario MUST poder tener varios dispositivos registrados; cada notificación MUST
  enviarse a todos.
- **FR-007**: Un dispositivo que el servicio de push reporte como no registrado MUST quitarse de los
  destinos del usuario.

**Alertas de tope**

- **FR-008**: Al registrar o editar una compra, el sistema MUST calcular el uso del tope del extracto
  abierto de la tarjeta antes y después del cambio y determinar qué umbrales (70%, 90%, 100%) se
  cruzaron y aún no se habían avisado en ese ciclo.
- **FR-009**: Si se cruzó al menos un umbral no avisado, MUST generarse una sola alerta, la del
  umbral más alto cruzado, y todos los umbrales cruzados MUST quedar marcados como avisados en ese
  ciclo. Un umbral avisado MUST NOT volver a avisarse en el mismo ciclo, aunque el uso baje y vuelva
  a subir.
- **FR-010**: El texto MUST nombrar la tarjeta y el uso real: "<tarjeta>: llevas el <p>% del tope de
  este ciclo" para 70% y 90%; "<tarjeta>: superaste el tope de este ciclo (<p>%)" para 100%.
- **FR-011**: Borrar una compra, editar el tope o las fechas de una tarjeta y archivar o restaurar
  una tarjeta MUST NOT generar alertas de tope.
- **FR-012**: Un fallo al generar o enviar una alerta MUST NOT impedir ni deshacer el registro o la
  edición de la compra, ni mostrar un error al usuario por esa causa.

**Recordatorios**

- **FR-013**: Recordatorio de corte: para cada tarjeta activa, el día (fecha del próximo corte − N
  de corte) MUST generarse un recordatorio con la fecha de corte y lo acumulado en el ciclo ("A
  pagar" del extracto abierto). Si lo acumulado es $0, MUST NOT generarse.
- **FR-014**: Recordatorio de pago: para cada extracto no pagado de una tarjeta activa, con "A
  pagar" mayor que $0, el día (fecha límite − N de pago) MUST generarse un recordatorio con el "A
  pagar" exacto y la fecha límite. Si ese día es anterior o igual a la fecha de corte del extracto,
  MUST generarse el día siguiente al corte. Un extracto pagado o vencido MUST NOT generar
  recordatorio de pago.
- **FR-015**: Recordatorio de pago recurrente: para cada ocurrencia no pagada de un pago no
  eliminado, el día (fecha de vencimiento − N del pago) MUST generarse un recordatorio con el nombre
  del pago, el monto esperado y la fecha de vencimiento. Cuentan las ocurrencias que el pago tiene o
  tendrá según la spec 005 (las de pagos Activos y las conservadas al pausar), aunque el usuario no
  haya abierto ese mes.
- **FR-016**: El pago recurrente MUST tener "días de anticipación del recordatorio", entero de 0 a
  15, por defecto 2, editable al crearlo y al editarlo y visible en su detalle. Los pagos que ya
  existían toman 2.
- **FR-017**: Los recordatorios del día MUST enviarse a las 7:00 en la zona horaria del usuario. Si
  el envío no ocurrió a esa hora, MUST hacerse en cuanto sea posible ese mismo día local; los
  recordatorios de un día que ya terminó MUST NOT enviarse.
- **FR-018**: Si un usuario tiene varios recordatorios el mismo día, MUST recibir un solo push
  ("Tienes <n> recordatorios hoy") que los resume; cada recordatorio MUST quedar por separado en el
  historial. Con uno solo, el push es ese recordatorio.
- **FR-019**: Cada recordatorio MUST enviarse como máximo una vez: uno por tipo y por corte (de
  corte), por extracto (de pago) y por ocurrencia (de pago recurrente), aunque cambien los días de
  anticipación o el envío diario se repita.
- **FR-020**: Los recordatorios MUST NOT generarse para tarjetas archivadas, pagos eliminados ni
  días ya pasados (no hay recordatorios atrasados).

**Destino al tocar**

- **FR-021**: Al tocar un push o una fila del historial, la app MUST abrir: el detalle de la tarjeta
  (alerta de tope y recordatorio de corte), el detalle del extracto (recordatorio de pago), el
  detalle de la ocurrencia (recordatorio de pago recurrente) o el historial (push agrupado). MUST
  funcionar con la app cerrada, en segundo plano o abierta.
- **FR-022**: Si el destino ya no existe o no es del usuario con sesión, la app MUST abrir el
  historial con "Esto ya no está disponible" y MUST NOT mostrar datos de otro usuario.

**Historial**

- **FR-023**: El botón de notificaciones del saludo del inicio MUST abrir el historial: alertas y
  recordatorios del usuario de los últimos 30 días, del más reciente al más antiguo, con título,
  texto y fecha y hora en su zona. Sin notificaciones, MUST decir "Sin notificaciones en los últimos
  30 días".
- **FR-024**: Toda alerta y recordatorio MUST quedar en el historial aunque el usuario no tenga
  dispositivos registrados o el envío falle. Las notificaciones de más de 30 días MUST dejar de
  mostrarse y borrarse.

**Notificación de prueba**

- **FR-025**: Perfil MUST tener "Enviar notificación de prueba", disponible solo con el estado
  "Activadas", que envía un push a este dispositivo y confirma el resultado con un mensaje. MUST
  limitarse a una prueba cada 30 segundos por dispositivo. La prueba MUST NOT quedar en el
  historial.

**Reglas, aislamiento, dominio y diseño**

- **FR-026**: El cálculo de umbrales cruzados, fechas de recordatorio (incluido N = 0, días que no
  existen en el mes, cambio de mes y de año, y el ajuste al día siguiente al corte de FR-014) y
  montos MUST vivir en el dominio, con el "hoy" del servidor en la zona del usuario, y con pruebas
  de esos casos borde.
- **FR-027**: Toda notificación MUST generarse solo con datos del usuario dueño y enviarse solo a sus
  dispositivos; el historial, el registro de dispositivos y la prueba MUST limitarse al usuario de
  la sesión. MUST existir pruebas automáticas con dos usuarios para cada operación.
- **FR-028**: Los montos en los textos MUST ser pesos enteros con separador de miles, como en las
  specs anteriores, y las fechas en formato corto ("8 dic").
- **FR-029**: La explicación del permiso, la fila de Perfil, el botón de prueba y el historial MUST
  seguir `docs/design-system.md` (tokens del tema, contraste AA, áreas táctiles de al menos 44,
  estados escritos) y ser accesibles con VoiceOver y TalkBack (cada notificación del historial se
  lee como una frase: título, texto y fecha).

### Key Entities

- **Dispositivo**: pertenece a un usuario y a una de sus sesiones; identificador de push,
  plataforma (iOS o Android) y cuándo se vio por última vez. Desaparece al terminar la sesión, al
  eliminar la cuenta o cuando el servicio de push lo reporta como no registrado.
- **Notificación**: pertenece a un usuario; tipo (alerta de tope, recordatorio de corte, de pago o
  de pago recurrente), título, texto, destino (tarjeta, extracto u ocurrencia), fecha de creación y
  una clave que impide repetirla (tarjeta + ciclo + umbral; tarjeta + corte; extracto; ocurrencia).
  Se borra a los 30 días o con la cuenta.
- **Umbral avisado** (puede ser parte de la notificación): tarjeta, ciclo (fecha de corte) y umbral
  (70, 90 o 100); marca los umbrales cruzados aunque solo se haya enviado la alerta del más alto.
- **Tarjeta** (spec 002): ya tiene los días de anticipación de corte y de pago.
- **Pago recurrente** (spec 005): incorpora los días de anticipación de su recordatorio.
- **Envío diario** (derivado): por usuario y día local, los recordatorios que tocan y si ya se
  enviaron.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con tope de $2.000.000 y $1.300.000 acumulados, registrar $600.000 genera exactamente
  una alerta (la del 90%) y deja marcados el 70% y el 90%; en el 100% de las pruebas, ningún umbral
  se avisa dos veces en el mismo ciclo.
- **SC-002**: Con corte el 8 y recordatorio de 2 días, el recordatorio de corte llega el 6 entre
  las 7:00 y las 7:15 de la zona del usuario, y el 7 no llega ninguno.
- **SC-003**: En el 100% de las pruebas, un extracto pagado no genera recordatorio de pago y una
  ocurrencia pagada no genera recordatorio de pago recurrente.
- **SC-004**: Ejecutar el envío diario varias veces el mismo día produce 0 push repetidos.
- **SC-005**: Una alerta de tope llega a los dispositivos registrados en menos de 1 minuto después
  de guardar la compra, con el dispositivo conectado.
- **SC-006**: Registrar o editar una compra nunca falla por un problema al enviar notificaciones (0
  compras perdidas en pruebas con el envío caído).
- **SC-007**: En las pruebas con dos usuarios, el 100% de las notificaciones llegan solo a los
  dispositivos y al historial de su dueño, y el 100% de los intentos de leer o tocar datos ajenos se
  rechazan como inexistentes.
- **SC-008**: Después de cerrar sesión o eliminar la cuenta, ese dispositivo recibe 0
  notificaciones del usuario.
- **SC-009**: Un usuario nuevo pasa de iniciar sesión a tener las notificaciones activadas en menos
  de 30 segundos, y quien las niega usa la app sin ningún bloqueo.
- **SC-010**: Tocar una notificación lleva a la pantalla correcta en el 100% de los tipos, con la app
  cerrada, en segundo plano y abierta.
- **SC-011**: La cobertura de las pruebas del dominio sigue en al menos 95%.

## Assumptions

- **Agrupar umbrales**: la regla 3 de "Cupo, tope y alertas" dice "un push por cada umbral cruzado"
  y el criterio de aceptación pide una sola alerta al cruzar 70% y 90% con una compra. Se resuelve
  así: una compra genera como máximo una alerta, la del umbral más alto que cruzó, y todos los
  umbrales cruzados quedan avisados. Compras distintas pueden generar alertas distintas en el mismo
  ciclo (70% con una, 90% con otra).
- **Texto con el uso real**: la alerta muestra el porcentaje real (95%), no el del umbral (90%),
  como en el ejemplo "llevas el 92%".
- **Recordatorio de pago antes del corte**: si los días de anticipación ponen el recordatorio de
  pago antes del corte (cuando el corte y la fecha límite están muy cerca), se envía el día
  siguiente al corte, porque antes el "A pagar" no es definitivo.
- **Sin recordatorio en $0**: no se recuerda un corte sin nada acumulado ni un extracto con "A
  pagar" de $0; no hay nada que hacer.
- **Recuperación del envío diario**: si el servidor no envió a las 7:00, envía apenas pueda dentro
  del mismo día local; no envía recordatorios de días pasados.
- **Prueba solo a este dispositivo**: "Enviar notificación de prueba" comprueba el dispositivo
  donde se toca, no los demás del usuario, y no se guarda en el historial.
- **Historial sin leídas**: el historial no marca notificaciones como leídas ni muestra un contador
  en la campana; eso queda para la v2.
- **Datos en la pantalla bloqueada**: los push muestran nombre de la tarjeta y montos; ocultarlos en
  la pantalla bloqueada queda para la v2 (el sistema operativo ya permite ocultar el contenido).
- **Días de anticipación existentes**: las tarjetas ya guardan los suyos (spec 002, 0–15); los pagos
  recurrentes existentes toman 2.
- **Mora**: no hay recordatorios después de la fecha límite de un extracto vencido; los avisos de
  mora son de la v2.
- **Servicio de push**: el envío usa el servicio que fija la constitución (Expo Push). Sus
  credenciales se preparan fuera de esta spec, como infraestructura, y los push remotos solo se
  pueden probar en una versión instalada de la app, no en la app genérica de pruebas.
- **Fuera de alcance (v2)**: preferencias por tipo de notificación, horario configurable, silenciar
  por un tiempo, correo o SMS, avisos de mora, contador de no leídas y ocultar datos en la pantalla
  bloqueada.
