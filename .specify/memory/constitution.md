<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0
Tipo de cambio: MINOR (se añade un principio nuevo; ningún principio existente se elimina ni
se redefine).

Principios modificados: ninguno.
Principios añadidos:
- IX. Sistema de diseño

Secciones añadidas: ninguna (solo el principio IX).
Secciones modificadas:
- Flujo de desarrollo: la revisión de PR verifica también el principio IX en cambios de UI.

Secciones eliminadas: ninguna.

Plantillas dependientes: no se modifican en este comando. Revisar que el "Constitution Check" de
.specify/templates/plan-template.md contemple los 9 principios al ejecutar /speckit-plan.

TODOs diferidos: ninguno. docs/design-system.md existe y es coherente con este principio.

Este comentario es material de revisión temporal; elimínalo antes de hacer commit.
-->

# Constitución de Corte

Corte es una app móvil multiusuario para controlar tarjetas de crédito por ciclo de corte,
compras a cuotas, extractos, alertas y pagos recurrentes, pensada para uso personal y familiar.

## Core Principles

### I. Dominio puro

- Toda la lógica de fechas de corte, fechas límite de pago, cuotas e intereses MUST vivir en
  `packages/domain`, escrita en TypeScript estricto y sin I/O (sin red, base de datos, sistema de
  archivos, reloj del sistema ni variables de entorno; la fecha "hoy" y la zona horaria se
  reciben como parámetros).
- `packages/domain` MUST ser la única fuente de esos cálculos: `apps/api` y `apps/mobile` lo
  importan y MUST NOT reimplementar ni duplicar esas reglas.

**Razón**: un solo lugar puro y determinista para las reglas financieras evita que la app y el
API muestren resultados distintos y permite probarlas de forma exhaustiva y rápida.

### II. Pruebas primero en dominio y API (NO NEGOCIABLE)

- Cada regla de negocio de `packages/domain` MUST tener pruebas unitarias escritas antes o junto
  con su implementación, incluyendo casos borde de calendario: febrero (28 y 29 días), meses de
  30 días y días de corte o pago 29, 30 y 31.
- Cada endpoint de `apps/api` MUST tener pruebas e2e que se ejecuten contra una base de datos de
  prueba PostgreSQL real (no mocks de la base).
- MUST NOT hacerse merge de ningún PR con CI en rojo.

**Razón**: los errores en fechas y montos se traducen en pagos tardíos o cifras falsas; solo las
pruebas sistemáticas de bordes los detectan antes de llegar al usuario.

### III. Aislamiento por usuario (NO NEGOCIABLE)

- Toda consulta y mutación sobre datos de usuario MUST filtrar por el `user_id` obtenido del
  token autenticado; MUST NOT confiarse en identificadores de usuario enviados por el cliente.
- Cada recurso expuesto por el API MUST tener pruebas e2e que verifiquen que un usuario no puede
  leer, listar, modificar ni eliminar datos de otro usuario.

**Razón**: la app es multiusuario y maneja información financiera de varias personas de una
familia; una fuga entre cuentas es el fallo más grave posible.

### IV. Dinero y fechas

- Los montos MUST representarse en pesos colombianos (COP) como enteros: `BIGINT` en PostgreSQL y
  enteros en el código. MUST NOT usarse tipos de punto flotante para dinero.
- Las fechas de negocio (fecha de corte, fecha límite, fecha de compra, vencimiento de cuota,
  fecha de pago recurrente) MUST almacenarse como `DATE` sin hora.
- Las fechas de negocio MUST calcularse en la zona horaria del usuario, que por defecto es
  `America/Bogota`.
- Todo interés calculado MUST presentarse en la UI explícitamente como estimado.

**Razón**: los enteros eliminan errores de redondeo; separar fecha de hora evita corrimientos de
día por zona horaria; los intereses reales dependen del banco, por lo que la app no puede
garantizarlos.

### V. Seguridad

- Las contraseñas MUST almacenarse con hash argon2.
- La autenticación MUST usar JWT de acceso de vida corta y refresh tokens que se rotan en cada
  uso (el token usado queda invalidado).
- Los endpoints de login y registro MUST tener límite de intentos (rate limiting).
- Los secretos MUST provenir solo de variables de entorno y MUST NOT versionarse en el
  repositorio.
- Swagger/OpenAPI MUST estar deshabilitado en producción y solo disponible en otros entornos.

**Razón**: se protegen datos financieros personales con controles estándar y verificables.

### VI. Simplicidad

- Solo se construye lo que está en la spec vigente.
- Cualquier idea, mejora o funcionalidad fuera de la spec vigente MUST registrarse en la lista de
  v2 en lugar de implementarse.

**Razón**: un proyecto personal avanza cuando el alcance es pequeño y terminado, no amplio y a
medias.

### VII. Configuración por entorno

- El mismo código y la misma imagen MUST ejecutarse en staging y en producción; lo único que
  cambia entre entornos son las variables de entorno.
- MUST NOT existir ramas, builds ni condicionales de código específicos de un entorno salvo los
  controlados por variables de entorno.

**Razón**: lo que se prueba en staging es exactamente lo que se despliega en producción.

### VIII. Convenciones de idioma y commits

- Código, identificadores, nombres de archivos, esquemas y mensajes de commit MUST estar en
  inglés.
- Los commits MUST seguir Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`,
  `refactor:`, etc.).
- La UI, las specs y la documentación MUST estar en español.

**Razón**: el código en inglés sigue el estándar del ecosistema; la UI y la documentación en
español sirven a los usuarios y al equipo reales.

### IX. Sistema de diseño

- Toda la UI de `apps/mobile` MUST seguir `docs/design-system.md`.
- Los componentes MUST usar solo tokens del tema (colores, tipografía, espaciado y radios) y
  MUST NOT contener valores sueltos (hex, tamaños, márgenes o radios escritos a mano).
- Todo texto MUST cumplir contraste WCAG AA: 4.5:1 en general y 3:1 para texto desde 24 px.
- Toda área táctil MUST medir como mínimo 44 × 44 px.
- Los montos MUST mostrarse con números tabulares.
- Los estados (por ejemplo vencido, pagado, próximo a vencer) MUST comunicarse siempre con texto;
  MUST NOT depender solo del color.

**Razón**: una UI consistente y accesible es más fácil de mantener y de usar por toda la
familia, y en una app de dinero los montos alineados y los estados inequívocos evitan errores
de lectura.

## Restricciones técnicas

- **Monorepo**: pnpm workspaces con `apps/api`, `apps/mobile` y `packages/domain`.
- **API**: NestJS + Prisma 7 + PostgreSQL 17.
- **App móvil**: Expo (React Native) con TypeScript, expo-router, TanStack Query y Zustand.
- **Notificaciones**: Expo Push.
- **CI**: GitHub Actions.
- **TypeScript**: modo estricto en todos los paquetes.
- **Fuera de alcance**: la infraestructura del servidor (hosting, redes, aprovisionamiento) no
  forma parte de las specs.

Cambiar cualquier elemento de este stack requiere una enmienda a esta constitución.

## Flujo de desarrollo

- Cada spec se desarrolla en su propia rama.
- Todo cambio entra a `main` mediante un PR con CI en verde (lint, typecheck, pruebas unitarias
  del dominio y pruebas e2e del API).
- La revisión de cada PR MUST verificar el cumplimiento de los principios de esta constitución,
  en especial II (pruebas), III (aislamiento) y IV (dinero y fechas), y IX (sistema de diseño)
  en todo cambio de UI.

## Governance

- Esta constitución prevalece sobre cualquier otra práctica, guía o spec del proyecto. Si una
  spec o plan la contradice, gana la constitución.
- **Enmiendas**: la constitución solo se modifica mediante una enmienda explícita, en un PR
  dedicado, que describa el cambio, su motivo y su impacto en specs, planes o código existentes.
- **Versionado** (semántico):
  - MAJOR: eliminación o redefinición incompatible de un principio o de una regla de gobierno.
  - MINOR: nuevo principio o sección, o ampliación material de una guía existente.
  - PATCH: aclaraciones, redacción o correcciones sin cambio semántico.
- **Cumplimiento**: cada plan (`/speckit-plan`) MUST pasar el "Constitution Check"; cualquier
  desviación MUST justificarse por escrito en el plan o resolverse antes de implementar.

**Version**: 1.1.0 | **Ratified**: 2026-11-21 | **Last Amended**: 2026-11-21
