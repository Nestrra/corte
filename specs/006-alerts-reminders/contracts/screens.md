# Contrato de UI: alertas y recordatorios

Textos en español. Solo se usan tokens de `docs/design-system.md` (principio IX). Los estados van
siempre escritos. Las áreas táctiles miden 44 o más. Decisiones en
[research.md](../research.md) R10 a R14.

## Navegación

```text
(app)/notifications-intro      nueva: "Activa las notificaciones" (modal, sin encabezado); una vez por dispositivo
(app)/notifications            nueva: "Notificaciones" (historial)
(tabs)/home                    + botón de campana junto al saludo → notifications
(tabs)/profile                 + fila "Notificaciones" y botón "Enviar notificación de prueba"
recurring/new, recurring/[id]/edit   + campo "Recordar con anticipación"
recurring/[id]/index           + "Recordatorio: 2 días antes"
```

Rutas que abre una notificación (R10):

| Destino | Ruta |
| --- | --- |
| `card` | `card/[id]` |
| `statement` | `statement/[id]` |
| `occurrence` | `occurrence/[id]` |
| `history` | `notifications` |

Si el recurso responde 404, se abre `notifications` con el aviso "Esto ya no está disponible".

## Pantallas

| Ruta | Contenido | Acciones |
| --- | --- | --- |
| `notifications-intro` | Título "Activa las notificaciones". Texto: "Te avisamos cuando te acerques al tope de una tarjeta, unos días antes del corte y de la fecha límite, y antes de cada pago fijo. Puedes cambiarlo cuando quieras en Perfil." | "Activar notificaciones" (Button primario) → permiso del sistema → inicio; "Ahora no" (Button secundario) → inicio |
| `notifications` | Lista de NotificationRow, de la más reciente a la más antigua | Fila → destino (R10). Arrastrar para refrescar |
| `notifications` vacía | "Sin notificaciones en los últimos 30 días" | — |
| `notifications` con aviso | Banner `warningSoft` "Esto ya no está disponible" arriba de la lista | Se cierra al salir |
| `profile` (fila) | "Notificaciones" con el estado escrito a la derecha | Según el estado (abajo) |
| `profile` (botón) | Button secundario "Enviar notificación de prueba" | Solo con estado Activadas |

### Estado en Perfil

| Estado | Texto | Color | Acción |
| --- | --- | --- | --- |
| `granted` y registrado | Activadas | `success` sobre `surface` | — |
| `denied` | Desactivadas | `warning` sobre `surface` (5,43) | "Abrir ajustes" → ajustes del sistema |
| `undetermined` | Sin activar | `textSecondary` | "Activar" → permiso del sistema |
| `unavailable` | No disponibles en este dispositivo | `textSecondary` | — |
| `granted` sin confirmar (sin conexión o falla de red al pedir el token) | Activando… | `textSecondary` | Se reintenta al abrir la app o volver a ella. Es un estado transitorio (spec FR-003) |

### Prueba

| Momento | Mensaje |
| --- | --- |
| Enviada (202) | "Te enviamos una notificación de prueba" |
| 409 | "Activa las notificaciones para recibir la prueba" |
| 429 | El botón queda deshabilitado con "Espera <s> s" |
| 502 o sin red | "No pudimos enviar la notificación. Intenta de nuevo." |

## Componentes nuevos (se documentan en `docs/design-system.md`)

- **NotificationRow**:
  - **Contenido**: título (`bodyStrong`), texto (`secondary`, `textSecondary`, hasta 3 líneas)
    y fecha a la derecha (`caption`, `textTertiary`): "Hoy, 7:00", "Ayer, 15:42" o "23 nov,
    7:00".
  - **Ícono por tipo** (`@expo/vector-icons`, ya instalado): `alert-circle-outline` en
    `warning` para la alerta de tope, `cut-outline` para el corte, `card-outline` para el pago
    y `calendar-outline` para el pago recurrente.
  - Fila de alto mínimo 44.
  - **Lectura accesible**: "Visa principal, llevas el 95% del tope de este ciclo, hoy a las
    7:00".
- **BellButton**: botón redondo de 44 × 44 con `notifications-outline` en `primaryStrong`, junto
  al saludo del inicio. Su etiqueta accesible es "Notificaciones" y no muestra contador
  (supuesto "Historial sin leídas").
- **PermissionIntro**: la pantalla `notifications-intro`: ícono `notifications-outline` grande en
  `primary` sobre `primarySoft`, título `title`, texto `body` y los dos Button al pie.
- **NotificationStatusRow**: fila de Perfil con la etiqueta, el estado escrito y la acción
  (texto `primaryStrong`, área de 44).
- **RecurringForm**: campo "Recordar con anticipación" igual que "Recordar corte" en CardForm:
  número de días de 0 a 15 con la ayuda "0 = el mismo día".

No hay tokens nuevos. Los pares de contraste ya están medidos en el sistema de diseño.

## Push en primer plano

Con la app abierta, el push se muestra como banner con sonido (`setNotificationHandler`) y el
historial se refresca.
