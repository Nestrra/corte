# Feature Specification: Autenticación de Corte

**Feature Branch**: `001-auth`

**Created**: 2026-11-21

**Status**: Draft

**Reference**: `docs/mvp-spec.md` → HU-01 (y la sección "Decisiones": registro abierto y
restablecimiento de contraseña por el administrador, sin correo).

**Input**: User description: "Spec 001 — Autenticación de Corte (HU-01 del MVP). Registro con nombre, email y contraseña (registro abierto, email único sin distinguir mayúsculas, contraseña de mínimo 8 caracteres); inicio de sesión que se mantiene al cerrar y abrir la app y se renueva solo mientras se usa; cierre de sesión en este dispositivo; eliminación de la cuenta confirmando con la contraseña, con borrado permanente de todos los datos; ver y cambiar la zona horaria (por defecto America/Bogota). Como administrador, restablecer la contraseña de un usuario con un comando en el servidor, que genera una contraseña temporal mostrada una sola vez y obliga a cambiarla en el siguiente inicio de sesión. Reglas: límite de intentos en registro e inicio de sesión; los errores de login no revelan si el email existe; si la sesión expira o se revoca, la app vuelve al inicio de sesión sin perder el email escrito; las pantallas siguen docs/design-system.md. Fuera de alcance: login con Google o Apple, recuperación por correo, verificación de email, gestión de sesiones en varios dispositivos, tokens de push."

## User Scenarios & Testing *(mandatory)*

Actores: **usuario** (persona de la familia que usa la app) y **administrador** (quien opera el
servidor; no usa una pantalla de la app para sus tareas).

### User Story 1 - Registrarse y quedar dentro de la app (Priority: P1)

Como usuario nuevo, abro la app, elijo "Crear cuenta", escribo mi nombre, mi email y una
contraseña, y quedo dentro de la app sin pasos adicionales.

**Why this priority**: sin cuentas no existe ninguna otra funcionalidad del MVP; es la puerta de
entrada de todos los datos de cada persona.

**Independent Test**: con la app instalada desde cero, crear una cuenta y ver la pantalla de inicio
con el nombre del usuario.

**Acceptance Scenarios**:

1. **Given** la pantalla de registro, **When** el usuario envía nombre, email y contraseña válidos,
   **Then** se crea la cuenta con zona horaria America/Bogota y el usuario entra a la pantalla de
   inicio, que lo saluda por su nombre.
2. **Given** que ya existe una cuenta con `ana@ejemplo.com`, **When** alguien intenta registrarse
   con `Ana@Ejemplo.com`, **Then** el registro se rechaza indicando que ese email ya tiene cuenta.
3. **Given** la pantalla de registro, **When** el usuario envía una contraseña de menos de 8
   caracteres, un email con formato inválido o el nombre vacío, **Then** se le indica qué campo
   corregir y no se crea la cuenta.
4. **Given** demasiados intentos de registro seguidos desde el mismo origen, **When** se supera el
   límite, **Then** los nuevos intentos se rechazan con un mensaje que indica esperar antes de
   reintentar.

---

### User Story 2 - Iniciar sesión y mantenerla (Priority: P1)

Como usuario registrado, inicio sesión con mi email y contraseña. Si cierro la app y la vuelvo a
abrir, sigo dentro sin escribir nada; la sesión se renueva sola mientras uso la app.

**Why this priority**: es el uso diario de la app; sin sesión persistente el usuario tendría que
escribir su contraseña cada vez.

**Independent Test**: iniciar sesión, cerrar la app por completo, abrirla de nuevo y comprobar que
aparece la pantalla de inicio sin pedir credenciales.

**Acceptance Scenarios**:

1. **Given** una cuenta existente, **When** el usuario ingresa su email (con cualquier combinación
   de mayúsculas) y la contraseña correcta, **Then** entra a la pantalla de inicio.
2. **Given** credenciales incorrectas (email inexistente o contraseña equivocada), **When** intenta
   iniciar sesión, **Then** ve el mismo mensaje genérico en ambos casos ("Email o contraseña
   incorrectos") y el email escrito se conserva en el formulario.
3. **Given** una sesión iniciada, **When** el usuario cierra la app y la abre otra vez dentro del
   periodo de inactividad permitido, **Then** sigue dentro sin volver a escribir credenciales.
4. **Given** una sesión que expiró o fue revocada, **When** el usuario abre la app o hace una
   acción, **Then** vuelve a la pantalla de inicio de sesión con su email ya escrito y un mensaje
   que explica que debe iniciar sesión de nuevo.
5. **Given** demasiados intentos fallidos de inicio de sesión para un mismo email u origen,
   **When** se supera el límite, **Then** los siguientes intentos se rechazan temporalmente,
   incluso con la contraseña correcta, con un mensaje que indica esperar.

---

### User Story 3 - Cerrar sesión en este dispositivo (Priority: P2)

Como usuario, cierro sesión desde mi perfil y la app vuelve a la pantalla de inicio de sesión.
La sesión cerrada ya no sirve para nada.

**Why this priority**: necesario para dispositivos compartidos o cambiados, pero la app es usable
sin él durante las primeras pruebas.

**Independent Test**: iniciar sesión, cerrar sesión y comprobar que esa sesión ya no permite
ninguna acción, aunque se intente reutilizar.

**Acceptance Scenarios**:

1. **Given** una sesión iniciada, **When** el usuario elige "Cerrar sesión", **Then** vuelve a la
   pantalla de inicio de sesión y, al reabrir la app, no entra automáticamente.
2. **Given** una sesión cerrada, **When** alguien intenta reutilizar sus credenciales de sesión,
   **Then** el sistema la rechaza.
3. **Given** el mismo usuario con sesión abierta en otro dispositivo, **When** cierra sesión en
   este, **Then** la sesión del otro dispositivo sigue activa.

---

### User Story 4 - Ver y cambiar la zona horaria (Priority: P2)

Como usuario, veo en mi perfil la zona horaria con la que se calculan mis fechas (por defecto
America/Bogota) y puedo cambiarla eligiendo de una lista.

**Why this priority**: la constitución (principio IV) calcula las fechas de negocio en la zona del
usuario; debe existir antes de las specs de tarjetas y pagos, pero casi todos los usuarios
usarán el valor por defecto.

**Independent Test**: abrir el perfil, ver "America/Bogota", cambiarla a otra zona, cerrar y abrir
la app y comprobar que se conserva.

**Acceptance Scenarios**:

1. **Given** una cuenta nueva, **When** el usuario abre su perfil, **Then** ve su nombre, su email
   y la zona horaria "America/Bogota".
2. **Given** el perfil, **When** el usuario busca y elige otra zona horaria válida, **Then** se
   guarda y se muestra la nueva zona.
3. **Given** una zona horaria que no existe, **When** se intenta guardar, **Then** se rechaza y se
   conserva la anterior.

---

### User Story 5 - Eliminar mi cuenta (Priority: P2)

Como usuario, elimino mi cuenta desde el perfil confirmando con mi contraseña. Todos mis datos se
borran de forma permanente y ya no puedo volver a entrar con esa cuenta.

**Why this priority**: requisito de las tiendas de aplicaciones para publicar, y derecho del usuario
sobre sus datos; no es necesario para el uso diario.

**Independent Test**: crear una cuenta, eliminarla y comprobar que iniciar sesión con ella falla
con el mensaje genérico y que el email se puede volver a registrar.

**Acceptance Scenarios**:

1. **Given** el perfil, **When** el usuario elige "Eliminar cuenta", **Then** la app explica que la
   acción es permanente y borra todos sus datos, y pide su contraseña para confirmar.
2. **Given** la confirmación con la contraseña correcta, **When** el usuario confirma, **Then** la
   cuenta y todos sus datos se borran, todas sus sesiones dejan de servir y la app vuelve a la
   pantalla de inicio de sesión.
3. **Given** una contraseña incorrecta en la confirmación, **When** el usuario confirma, **Then**
   no se borra nada y se le indica que la contraseña es incorrecta.
4. **Given** una cuenta eliminada, **When** se intenta iniciar sesión con ella, **Then** se rechaza
   con el mismo mensaje genérico de credenciales incorrectas.

---

### User Story 6 - Cambiar mi contraseña desde el perfil (Priority: P2)

Como usuario, cambio mi contraseña desde el perfil escribiendo la actual y la nueva. Se usa la
misma pantalla del cambio obligatorio, que en este caso también pide la contraseña actual. Mi
sesión en este dispositivo sigue activa y las de los demás dispositivos dejan de servir.

**Why this priority**: permite al usuario proteger su cuenta si sospecha que alguien conoce su
contraseña, sin depender del administrador; no es necesario para el uso diario.

**Independent Test**: con sesión abierta en dos dispositivos, cambiar la contraseña en uno y
comprobar que ese sigue dentro, que el otro vuelve al inicio de sesión y que solo la contraseña
nueva funciona.

**Acceptance Scenarios**:

1. **Given** el perfil, **When** el usuario elige "Cambiar contraseña", **Then** ve la pantalla de
   cambio de contraseña con los campos contraseña actual, contraseña nueva y confirmación.
2. **Given** la contraseña actual correcta y una nueva válida y distinta de la actual, **When**
   confirma, **Then** la contraseña cambia, sigue dentro de la app en este dispositivo y las
   sesiones de sus otros dispositivos dejan de servir.
3. **Given** una contraseña actual incorrecta, **When** confirma, **Then** no cambia nada, se le
   indica que la contraseña actual es incorrecta y el intento cuenta para el límite de intentos.
4. **Given** una contraseña nueva igual a la actual, de menos de 8 caracteres o que no coincide con
   la confirmación, **When** confirma, **Then** se le indica qué corregir y no cambia nada.
5. **Given** el cambio realizado, **When** intenta iniciar sesión con la contraseña anterior,
   **Then** se rechaza con el mensaje genérico de credenciales incorrectas.

---

### User Story 7 - Restablecer una contraseña desde el servidor (Priority: P3)

Como administrador, ejecuto un comando en el servidor con el email de un usuario que olvidó su
contraseña. El comando genera una contraseña temporal y la muestra una sola vez; se la entrego al
usuario por fuera de la app. Al iniciar sesión con ella, la app lo obliga a definir una contraseña
nueva antes de dejarlo usar cualquier otra función.

**Why this priority**: sin recuperación por correo (fuera de alcance), es la única forma de
recuperar una cuenta; se usa pocas veces.

**Independent Test**: ejecutar el comando para una cuenta, iniciar sesión con la contraseña
temporal, comprobar que solo se ofrece cambiar la contraseña, cambiarla y entrar con la nueva.

**Acceptance Scenarios**:

1. **Given** un email registrado, **When** el administrador ejecuta el comando de restablecimiento,
   **Then** se muestra una contraseña temporal una sola vez, la contraseña anterior deja de
   funcionar y todas las sesiones abiertas de ese usuario dejan de servir.
2. **Given** un email que no existe, **When** el administrador ejecuta el comando, **Then** el
   comando informa que no hay cuenta con ese email y no cambia nada.
3. **Given** un usuario con contraseña temporal, **When** inicia sesión con ella, **Then** la app
   solo le muestra la pantalla para definir una contraseña nueva; cualquier otra acción se rechaza
   hasta que la cambie.
4. **Given** la pantalla de cambio obligatorio, **When** el usuario define una contraseña nueva
   válida y distinta de la temporal, **Then** entra a la pantalla de inicio, y en adelante solo la
   contraseña nueva funciona.

---

### Edge Cases

- **Espacios y mayúsculas en el email**: se ignoran los espacios al inicio y al final y no se
  distinguen mayúsculas, tanto al registrarse como al iniciar sesión.
- **Contraseñas**: se respetan tal como se escriben (sin recortar espacios); máximo 128
  caracteres.
- **Sin conexión al iniciar sesión o registrarse**: se muestra un error de conexión y se conservan
  los datos escritos, salvo la contraseña.
- **Sin conexión al abrir la app con una sesión guardada**: la app no cierra la sesión por falta de
  red; lo intenta de nuevo cuando vuelve la conexión.
- **Sesión revocada mientras la app está abierta** (por cierre de sesión en otro lugar, eliminación
  de la cuenta o restablecimiento): la siguiente acción lleva a la pantalla de inicio de sesión con
  el email ya escrito.
- **Varios dispositivos**: se puede tener sesión en más de un dispositivo a la vez; cada cierre de
  sesión afecta solo al dispositivo donde se hace. No hay pantalla para ver o cerrar las sesiones
  de otros dispositivos.
- **Eliminación con sesiones en otros dispositivos**: todas dejan de servir de inmediato.
- **Contraseña nueva igual a la actual o a la temporal**: se rechaza; la nueva debe ser distinta.
- **Cambio voluntario con sesiones en otros dispositivos**: esas sesiones dejan de servir de
  inmediato; la del dispositivo donde se hizo el cambio continúa.
- **Usuario que cierra la app en la pantalla de cambio obligatorio**: al volver, sigue en esa
  pantalla hasta cambiar la contraseña.
- **Acceso a datos de otro usuario**: cualquier intento de leer o modificar el perfil o la zona
  horaria de otra persona se rechaza como si el recurso no existiera.

## Requirements *(mandatory)*

### Functional Requirements

**Registro**

- **FR-001**: Cualquier persona MUST poder crear una cuenta con nombre, email y contraseña, sin
  invitación.
- **FR-002**: El nombre MUST tener entre 1 y 80 caracteres después de quitar espacios al inicio y
  al final.
- **FR-003**: El email MUST tener formato válido, se MUST guardar sin espacios externos y en
  minúsculas, y MUST ser único sin distinguir mayúsculas.
- **FR-004**: La contraseña MUST tener entre 8 y 128 caracteres.
- **FR-005**: Al crear la cuenta, el sistema MUST asignar la zona horaria America/Bogota e iniciar
  sesión automáticamente.

**Inicio de sesión y sesión**

- **FR-006**: El usuario MUST poder iniciar sesión con email (sin distinguir mayúsculas) y
  contraseña.
- **FR-007**: Ante credenciales incorrectas, el sistema MUST responder con el mismo mensaje y el
  mismo comportamiento, exista o no el email, sin que el tiempo de respuesta permita distinguir
  un caso del otro.
- **FR-008**: La sesión MUST conservarse al cerrar y abrir la app, y MUST renovarse sola mientras
  el usuario use la app, sin pedirle credenciales.
- **FR-009**: Una sesión sin uso durante 30 días seguidos MUST expirar.
- **FR-010**: Cada renovación de sesión MUST invalidar las credenciales de sesión anteriores; si
  se detecta la reutilización de unas ya invalidadas, el sistema MUST revocar la sesión completa.
- **FR-011**: Cuando la sesión expira o se revoca, la app MUST llevar al usuario a la pantalla de
  inicio de sesión con su email ya escrito y un mensaje que explique que debe volver a entrar.
- **FR-012**: El usuario MUST poder tener sesiones simultáneas en varios dispositivos.

**Límite de intentos**

- **FR-013**: El sistema MUST limitar los intentos de inicio de sesión: tras 5 intentos fallidos
  para un mismo email en 15 minutos, o 20 solicitudes de inicio de sesión desde un mismo origen
  en 15 minutos, MUST rechazar los siguientes durante 15 minutos, incluso si las credenciales son
  correctas.
- **FR-014**: El sistema MUST limitar el registro a 5 intentos por origen cada hora.
- **FR-015**: Las confirmaciones con contraseña (eliminar cuenta, cambio de contraseña obligatorio
  o voluntario) MUST contar dentro del límite de intentos de inicio de sesión del usuario.
- **FR-016**: Al superar un límite, el mensaje MUST indicar que se debe esperar antes de
  reintentar, sin revelar si el email existe.

**Cierre de sesión**

- **FR-017**: El usuario MUST poder cerrar sesión en el dispositivo actual; esa sesión MUST quedar
  inutilizable de inmediato, sin afectar las de otros dispositivos.

**Perfil y zona horaria**

- **FR-018**: El usuario MUST poder ver su nombre, email y zona horaria.
- **FR-019**: El usuario MUST poder cambiar su zona horaria eligiendo de la lista de zonas
  horarias estándar (identificadores como America/Bogota); cualquier otro valor MUST rechazarse.

**Eliminación de la cuenta**

- **FR-020**: El usuario MUST poder eliminar su cuenta desde la app después de una advertencia
  explícita de que es permanente, confirmando con su contraseña actual.
- **FR-021**: Al eliminar la cuenta, el sistema MUST borrar de forma permanente la cuenta y todos
  los datos asociados a ella (incluidos los que agreguen specs futuras) y revocar todas sus
  sesiones.
- **FR-022**: Tras la eliminación, el email MUST quedar libre para un nuevo registro.

**Restablecimiento por el administrador**

- **FR-023**: El administrador MUST poder restablecer la contraseña de un usuario, identificado
  por su email, con un comando ejecutado en el servidor; no existe pantalla ni endpoint público
  para esta acción.
- **FR-024**: El comando MUST generar una contraseña temporal aleatoria de al menos 12
  caracteres, mostrarla una única vez y no guardarla en texto plano en ningún lugar.
- **FR-025**: El restablecimiento MUST invalidar la contraseña anterior y revocar todas las
  sesiones del usuario.
- **FR-026**: Un usuario que inicia sesión con una contraseña temporal MUST quedar restringido a
  definir una contraseña nueva; el sistema MUST rechazar cualquier otra acción hasta entonces.
- **FR-027**: La contraseña nueva MUST cumplir FR-004 y ser distinta de la temporal.

**Cambio voluntario de contraseña**

- **FR-028**: El usuario MUST poder cambiar su contraseña desde el perfil indicando la contraseña
  actual, la nueva y su confirmación, en la misma pantalla del cambio obligatorio.
- **FR-029**: La contraseña nueva MUST cumplir FR-004, ser distinta de la actual y coincidir con su
  confirmación; si la contraseña actual es incorrecta, no se cambia nada.
- **FR-030**: Al cambiar la contraseña, el sistema MUST revocar todas las demás sesiones del usuario
  y mantener activa la del dispositivo donde se hizo el cambio.

**Aislamiento y seguridad**

- **FR-031**: Cada usuario MUST poder leer y modificar solo sus propios datos; el acceso a datos de
  otro usuario MUST rechazarse sin revelar si existen (principio III).
- **FR-032**: Las contraseñas MUST almacenarse solo como hash con argon2 (principio V); nunca en
  texto plano ni en registros.
- **FR-033**: Los registros del sistema MUST NOT contener contraseñas, contraseñas temporales ni
  credenciales de sesión.

**Pantallas**

- **FR-034**: La app MUST incluir las pantallas de inicio de sesión, registro, cambio de contraseña
  (una sola pantalla para el cambio obligatorio y el voluntario; en el voluntario pide además la
  contraseña actual), inicio (temporal, con saludo y acceso al perfil) y perfil (datos, zona
  horaria, cambiar contraseña, cerrar sesión y eliminar cuenta), siguiendo `docs/design-system.md` (principio IX) y con textos
  en español.
- **FR-035**: La pantalla temporal de conexión de la spec 000 MUST reemplazarse por el flujo de
  autenticación: sin sesión se muestra el inicio de sesión; con sesión, la pantalla de inicio.

### Key Entities

- **Usuario**: persona con cuenta. Atributos: nombre, email (único, en minúsculas), contraseña
  protegida, zona horaria (por defecto America/Bogota), indicador de "debe cambiar la contraseña",
  fechas de creación y actualización. Es dueño de todos los datos que agreguen specs futuras.
- **Sesión**: acceso de un usuario desde un dispositivo. Atributos: usuario, fecha de inicio,
  última renovación, expiración por inactividad, estado (activa o revocada). Un usuario puede
  tener varias sesiones.
- **Intento de acceso**: registro de intentos fallidos usado para aplicar los límites por email y
  por origen dentro de una ventana de tiempo. No se muestra al usuario.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario nuevo completa el registro y llega a la pantalla de inicio en menos de
  1 minuto.
- **SC-002**: En el 100 % de las pruebas, cerrar y reabrir la app con una sesión activa deja al
  usuario dentro sin pedir credenciales.
- **SC-003**: En el 100 % de las pruebas, una sesión cerrada, expirada o revocada no permite
  ninguna acción.
- **SC-004**: En el 100 % de las pruebas de aislamiento, un usuario no puede leer ni modificar los
  datos de otro.
- **SC-005**: Tras 5 intentos fallidos para un mismo email, el sexto intento se rechaza aunque la
  contraseña sea correcta, y vuelve a permitirse pasados 15 minutos.
- **SC-006**: Las respuestas a un inicio de sesión fallido son indistinguibles (mismo mensaje)
  entre un email inexistente y una contraseña equivocada.
- **SC-007**: En el 100 % de las pruebas, una cuenta eliminada no puede iniciar sesión y no deja
  ningún dato asociado.
- **SC-008**: Tras un restablecimiento, el usuario solo puede usar la app después de cambiar la
  contraseña temporal; la contraseña anterior y la temporal dejan de funcionar.
- **SC-009**: Cuando la sesión expira, el usuario vuelve a la pantalla de inicio de sesión con su
  email ya escrito en el 100 % de los casos.
- **SC-010**: Tras un cambio voluntario de contraseña, en el 100 % de las pruebas la sesión del
  dispositivo actual sigue funcionando, las de los otros dispositivos no permiten ninguna acción y
  solo la contraseña nueva permite iniciar sesión.

## Assumptions

- **Referencia**: `docs/mvp-spec.md` (HU-01). Si este documento y la spec difieren, gana la spec.
  La spec añade al MVP el cambio voluntario de contraseña y el cambio obligatorio tras un
  restablecimiento.
- **Inactividad de 30 días**: la sesión dura mientras se use la app y expira tras 30 días sin uso;
  es un equilibrio habitual en apps personales de finanzas. La duración exacta de cada credencial
  de sesión es una decisión técnica del plan.
- **Límites de intentos**: 5 fallos por email o 20 por origen en 15 minutos para el inicio de
  sesión, y 5 registros por origen por hora, son valores iniciales razonables para uso familiar;
  se pueden ajustar sin cambiar la spec si resultan molestos.
- **Registro revela si el email ya tiene cuenta**: es necesario para que el usuario entienda por qué
  no puede registrarse; el riesgo de enumeración se mitiga con el límite de registro. La regla de
  no revelar la existencia del email aplica al inicio de sesión y a los límites.
- **Contraseña temporal sin vencimiento**: sirve hasta que el usuario la cambie; el administrador
  puede generar otra si se pierde. Su uso obliga al cambio inmediato.
- **Sin cambio de nombre ni de email**: no se pidieron; quedan en la lista de v2 (principio VI).
- **Zona horaria**: la lista son los identificadores estándar de zonas horarias; cambiarla afecta
  los cálculos futuros de fechas (aún no hay datos que dependan de ella).
- **Pantalla de inicio temporal**: saluda al usuario y da acceso al perfil; la pantalla de inicio
  real (tarjetas y pagos) llega con specs posteriores. La pantalla de conexión de la spec 000
  desaparece.
- **Administrador**: es quien tiene acceso al servidor; no existe un rol de administrador dentro de
  la app.
- **Fuera de alcance**: login con Google o Apple, recuperación por correo, verificación de email,
  pantalla de gestión de sesiones en varios dispositivos y tokens de notificaciones push.
