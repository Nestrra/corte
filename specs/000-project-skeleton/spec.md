# Feature Specification: Esqueleto del proyecto Corte

**Feature Branch**: `000-project-skeleton`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "Spec 000 — Esqueleto del proyecto Corte. Objetivo: dejar la base sobre la que se construyen todas las demás specs, sin ninguna funcionalidad de negocio todavía. Monorepo con api, mobile y domain; dominio listo para pruebas con cobertura; API con endpoint de salud público en /api/v1/health (estado, versión/commit, estado de la base de datos) y base local con un solo comando; API empaquetable como imagen de contenedor configurada solo por variables de entorno; app móvil iOS/Android con fuentes, tokens y componentes base de texto y botón, y pantalla temporal que muestra si hay conexión con el API; CI en cada PR con lint, typecheck, pruebas del dominio, e2e del API contra base real y construcción de imagen, bloqueando el merge si algo falla. Fuera de alcance: autenticación, entidades de negocio, despliegue al servidor y publicación en tiendas."

## User Scenarios & Testing *(mandatory)*

El actor de esta spec es el **desarrollador** del proyecto. No hay usuarios finales ni
funcionalidad de negocio todavía.

### User Story 1 - Levantar el API local y consultar su salud (Priority: P1)

Como desarrollador, clono el repositorio, instalo dependencias con un solo comando, levanto la
base de datos local con un solo comando, arranco el API con un solo comando y consulto
`/api/v1/health` para confirmar que el servicio y la base de datos responden.

**Why this priority**: es la base mínima sobre la que se construye todo el backend de las specs
siguientes y la única forma de comprobar que la configuración local funciona.

**Independent Test**: en un clon limpio, seguir el README hasta consultar el endpoint de salud y
recibir una respuesta sana; luego detener la base y recibir una respuesta degradada.

**Acceptance Scenarios**:

1. **Given** un clon limpio con los prerrequisitos del README instalados, **When** el
   desarrollador ejecuta el comando de instalación en la raíz, **Then** se instalan las
   dependencias de los tres paquetes sin errores.
2. **Given** la base de datos local levantada y el API corriendo, **When** se consulta
   `GET /api/v1/health` sin credenciales, **Then** responde HTTP 200 con estado `ok`, la versión
   desplegada (identificador del commit) y la base de datos marcada como disponible.
3. **Given** el API corriendo y la base de datos detenida, **When** se consulta
   `GET /api/v1/health`, **Then** responde HTTP 503 con estado `degraded`, la versión y la base de
   datos marcada como no disponible.
4. **Given** el API arrancado sin una variable de entorno obligatoria, **When** inicia, **Then**
   se detiene de inmediato con un mensaje que nombra la variable faltante.

---

### User Story 2 - Integración continua que bloquea merges rotos (Priority: P2)

Como desarrollador, abro un PR y la integración continua ejecuta automáticamente lint, verificación
de tipos, pruebas del dominio, pruebas e2e del API contra una base de datos real y la construcción
de la imagen del API. Si cualquier paso falla, el PR no se puede mergear.

**Why this priority**: la constitución (principio II) prohíbe hacer merge con CI en rojo; sin esta
puerta, ninguna spec posterior tiene garantía de calidad.

**Independent Test**: abrir un PR con una prueba deliberadamente rota y comprobar que la CI falla y
que el botón de merge queda bloqueado; corregirla y comprobar que se habilita.

**Acceptance Scenarios**:

1. **Given** un PR hacia `main`, **When** se abre o se actualiza, **Then** la CI ejecuta lint,
   typecheck, pruebas del dominio, pruebas e2e del API y construcción de la imagen.
2. **Given** un PR con una prueba que falla, **When** termina la CI, **Then** el resultado es
   fallido y el PR no se puede mergear.
3. **Given** un PR con todos los pasos en verde, **When** termina la CI, **Then** el PR se puede
   mergear.

---

### User Story 3 - Paquete de dominio listo para pruebas (Priority: P3)

Como desarrollador, ejecuto un solo comando en el paquete de dominio que corre sus pruebas
unitarias y muestra un reporte de cobertura, para empezar a escribir reglas de negocio con pruebas
primero en la siguiente spec.

**Why this priority**: habilita el principio I (dominio puro) y el II (pruebas primero) para las
specs de negocio, pero no aporta nada visible por sí solo.

**Independent Test**: ejecutar el comando de pruebas del dominio y verificar que termina con éxito
y muestra el porcentaje de cobertura.

**Acceptance Scenarios**:

1. **Given** el paquete de dominio sin reglas de negocio, **When** se ejecuta su comando de
   pruebas, **Then** corre al menos una prueba de humo, termina con éxito y reporta cobertura.
2. **Given** una prueba del dominio que falla, **When** se ejecuta el comando, **Then** termina con
   código de error distinto de cero.

---

### User Story 4 - App móvil que muestra la conexión con el API (Priority: P4)

Como desarrollador, arranco la app en un simulador iOS o emulador Android con un solo comando. La
app carga las fuentes y los tokens del sistema de diseño y muestra una pantalla temporal que
consulta el endpoint de salud del API configurado por entorno e indica "Conectado" o
"Sin conexión".

**Why this priority**: valida la cadena completa app → API y deja listos los cimientos visuales
(fuentes, tokens, componentes de texto y botón) para las pantallas de las siguientes specs.

**Independent Test**: con el API corriendo, abrir la app y ver "Conectado"; detener el API, pulsar
"Reintentar" y ver "Sin conexión".

**Acceptance Scenarios**:

1. **Given** el API corriendo en la URL configurada, **When** se abre la app, **Then** la pantalla
   temporal muestra "Conectado".
2. **Given** el API detenido o inalcanzable, **When** se abre la app o se pulsa "Reintentar",
   **Then** la pantalla muestra "Sin conexión".
3. **Given** la app abierta, **When** se renderiza la pantalla temporal, **Then** sus textos usan
   las fuentes del sistema de diseño (Plus Jakarta Sans para títulos, Inter para el resto) y el
   botón "Reintentar" usa el componente base de botón.
4. **Given** la app arrancada en iOS y en Android, **When** se abre, **Then** funciona igual en
   ambas plataformas.

---

### User Story 5 - API empaquetado como imagen de contenedor (Priority: P5)

Como desarrollador, construyo una imagen de contenedor del API y la ejecuto pasando solo variables
de entorno, de modo que la misma imagen sirva para staging y producción (principio VII).

**Why this priority**: prepara el despliegue futuro, que está fuera del alcance de esta spec; hoy
solo se necesita que la imagen se construya y arranque.

**Independent Test**: construir la imagen, ejecutarla con las variables de entorno de la base local
y consultar el endpoint de salud del contenedor.

**Acceptance Scenarios**:

1. **Given** el repositorio, **When** se construye la imagen del API, **Then** termina sin errores.
2. **Given** la imagen construida y las variables de entorno apuntando a una base disponible,
   **When** se ejecuta el contenedor, **Then** el endpoint de salud responde HTTP 200 con la
   versión del commit con que se construyó o se configuró.
3. **Given** la imagen, **When** se inspecciona su contenido, **Then** no contiene secretos ni
   archivos de variables de entorno con valores reales.

---

### Edge Cases

- **Base de datos que no responde (cuelga)**: el endpoint de salud MUST responder en un tiempo
  máximo acotado (ver FR-006) marcando la base como no disponible, sin quedarse esperando.
- **Versión no configurada**: si no se proporciona el identificador del commit, el endpoint de
  salud reporta la versión como `unknown` en lugar de fallar.
- **Variable obligatoria faltante o inválida**: el API no arranca y el mensaje nombra la variable.
- **URL del API no configurada en la app**: la app muestra "Sin conexión" y un mensaje que indica
  que falta configurar la URL, sin cerrarse.
- **API lento**: si el endpoint de salud no responde dentro del tiempo límite de la app, se muestra
  "Sin conexión".
- **API responde degradado (base caída)**: la app muestra "Conectado", porque el API es
  alcanzable; el detalle de la base no forma parte de esta pantalla.
- **Emulador Android y `localhost`**: el README explica qué URL usar para alcanzar el API local
  desde el emulador Android y desde un dispositivo físico.
- **Fuentes que no cargan**: la app no se cierra; mantiene la pantalla de carga mientras cargan y,
  si fallan, continúa con la fuente del sistema.

## Requirements *(mandatory)*

### Functional Requirements

**Monorepo**

- **FR-001**: El repositorio MUST contener tres paquetes: API, app móvil y dominio, instalables con
  un solo comando desde la raíz.
- **FR-002**: Cada paquete MUST poder ejecutarse (o, en el dominio, probarse) con un solo comando
  documentado en el README.
- **FR-003**: El repositorio MUST incluir comandos de lint y verificación de tipos que cubran los
  tres paquetes, con tipado estricto.

**Dominio**

- **FR-004**: El paquete de dominio MUST tener un comando que ejecute sus pruebas unitarias y
  genere un reporte de cobertura, y MUST NOT tener dependencias de I/O (principio I).

**API**

- **FR-005**: El API MUST exponer `GET /api/v1/health`, público (sin autenticación), que devuelva:
  estado del servicio (`ok` o `degraded`), versión desplegada (identificador del commit o
  `unknown`) y disponibilidad de la base de datos.
- **FR-006**: El endpoint de salud MUST responder HTTP 200 con estado `ok` cuando la base responde,
  y HTTP 503 con estado `degraded` cuando no responde o tarda más de 2 segundos en hacerlo.
- **FR-007**: El repositorio MUST permitir levantar una base de datos local para desarrollo con un
  solo comando, y otra para pruebas e2e.
- **FR-008**: El API MUST leer toda su configuración (conexión a base de datos, puerto, entorno,
  versión) de variables de entorno, validarla al arrancar y negarse a iniciar si falta o es
  inválida alguna variable obligatoria.
- **FR-009**: El repositorio MUST incluir un archivo de ejemplo de variables de entorno, sin
  valores secretos reales, y MUST NOT versionar archivos con secretos (principio V).
- **FR-010**: La documentación interactiva del API MUST estar disponible fuera de producción y
  deshabilitada en producción (principio V).
- **FR-011**: El endpoint de salud MUST tener pruebas e2e contra una base de datos real que cubran
  el caso con base disponible y el caso con base no disponible.

**Imagen de contenedor**

- **FR-012**: El API MUST poder empaquetarse como imagen de contenedor que se configura
  exclusivamente con variables de entorno; la misma imagen MUST servir para cualquier entorno
  (principio VII).
- **FR-013**: La imagen MUST NOT contener secretos ni archivos de variables de entorno con valores
  reales.

**App móvil**

- **FR-014**: La app MUST arrancar en iOS y Android con un solo comando de desarrollo.
- **FR-015**: La app MUST cargar las fuentes y definir los tokens del tema (colores, tipografía,
  espaciado y radios) tal como están en `docs/design-system.md`, antes de mostrar contenido.
- **FR-016**: La app MUST incluir los componentes base de texto (con las variantes tipográficas
  del sistema de diseño) y de botón (primario y secundario, alto mínimo 44), que usen solo tokens
  del tema (principio IX).
- **FR-017**: La app MUST mostrar una pantalla temporal que consulte el endpoint de salud al
  abrirse y al pulsar "Reintentar", y muestre "Conectado" si el API responde con un reporte de
  salud válido, o "Sin conexión" si no responde, responde algo inválido o tarda más de 5 segundos.
- **FR-018**: La URL del API MUST definirse por entorno, sin estar escrita en el código.
- **FR-019**: El estado de conexión MUST comunicarse con texto, no solo con color, y cumplir
  contraste WCAG AA (principio IX).

**Integración continua**

- **FR-020**: La CI MUST ejecutarse en cada PR hacia `main` y correr: lint, verificación de tipos,
  verificación de formato, pruebas del dominio, pruebas e2e del API contra una base de datos real y construcción de la
  imagen del API.
- **FR-021**: Si cualquier paso de la CI falla, el PR MUST quedar bloqueado para merge.

**Documentación**

- **FR-022**: El README MUST listar los prerrequisitos y los pasos para dejar API, base de datos y
  app corriendo en local, en español (principio VIII).

### Key Entities

- **Reporte de salud**: respuesta del endpoint de salud. Atributos: estado del servicio
  (`ok` / `degraded`), versión desplegada (commit o `unknown`), disponibilidad de la base de datos.
  No se persiste.
- **Configuración de entorno**: conjunto de variables que definen cómo corre cada pieza (conexión
  a la base, puerto, entorno, versión, URL del API en la app). Se valida al arrancar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un desarrollador con los prerrequisitos instalados pasa de clonar el repositorio a
  tener base de datos, API y app corriendo en local en menos de 15 minutos siguiendo solo el
  README.
- **SC-002**: El endpoint de salud responde correctamente en el 100 % de las ejecuciones de sus
  pruebas e2e: sano con la base disponible y degradado con la base caída.
- **SC-003**: Con la base de datos colgada, el endpoint de salud responde en 3 segundos o menos.
- **SC-004**: La app muestra "Conectado" o "Sin conexión" correctamente en el 100 % de las
  pruebas manuales en iOS y Android, y nunca tarda más de 6 segundos en mostrar el resultado.
- **SC-005**: El 100 % de los PR con una prueba rota quedan bloqueados para merge.
- **SC-006**: La misma imagen del API arranca en dos configuraciones de entorno distintas
  cambiando solo variables de entorno.
- **SC-007**: El repositorio no contiene ningún secreto real (verificable revisando el historial y
  los archivos versionados).

## Assumptions

- **Prerrequisitos fuera del tiempo de 15 minutos**: el desarrollador ya tiene instalados el
  runtime de JavaScript, el gestor de paquetes, un motor de contenedores y, para la app, el
  simulador iOS (macOS) o el emulador Android. El tiempo de SC-001 no incluye instalarlos.
- **Código HTTP del estado degradado**: se usa 503 para que un balanceador o monitor futuro
  detecte la falta de base de datos; el cuerpo sigue indicando `degraded`.
- **"Conectado" significa API alcanzable**: la app no distingue entre API sano y degradado en esta
  pantalla temporal.
- **Bloqueo de merge**: requiere configurar en el repositorio remoto una regla de protección de la
  rama `main` que exija la CI en verde; es un paso manual que el README documenta.
- **Cobertura**: en esta spec se reporta pero no se exige un umbral mínimo, porque el dominio aún no
  tiene reglas; el umbral se define cuando lleguen las primeras reglas de negocio.
- **Prueba de humo**: el dominio incluye una prueba mínima para que el comando de pruebas y el
  reporte de cobertura funcionen desde el primer día.
- **Pantalla temporal**: se reemplazará por la pantalla de inicio en una spec posterior; sus textos
  están en español.
- **Modo oscuro**: fuera de alcance, igual que en `docs/design-system.md`.
- **Fuera de alcance**: autenticación, cualquier entidad de negocio, despliegue al servidor y
  publicación en tiendas.
