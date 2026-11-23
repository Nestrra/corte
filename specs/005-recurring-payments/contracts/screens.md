# Contrato de UI: pagos recurrentes

Textos en español; solo tokens de `docs/design-system.md` (principio IX); errores con texto
(`specs/003-purchases/contracts/errors.md` y los códigos de
[recurring.openapi.yaml](./recurring.openapi.yaml)). Montos con `formatCop` en `tabular-nums`;
fechas cortas "10 nov" en listas y largas "10 de noviembre de 2026" en los detalles. Los estados
siempre van escritos. Decisiones en [research.md](../research.md).

## Navegación

```text
(tabs)/home                      + RecurringSection debajo del resumen o de EmptyCards
(tabs)/cards                     sin cambios
(tabs)/register                  sin cambios (botón central)
(tabs)/payments                  nueva pestaña "Pagos" (ícono calendar / calendar-outline)
(tabs)/profile                   sin cambios
recurring/index                  "Mis pagos"
recurring/new                    "Nuevo pago"
recurring/[id]/index             "Pago" (detalle)
recurring/[id]/edit              "Editar pago"
occurrence/[id]/index            "Pago del mes" (detalle de la ocurrencia)
occurrence/[id]/pay              hoja "Marcar pagado" (presentation: formSheet)
```

## Pantallas

| Ruta | Contenido | Acciones |
| --- | --- | --- |
| `home` (sección) | SectionHeader "Pagos de noviembre" + "Nuevo". MonthOverview del mes actual (`Summary.recurring`) | "Nuevo" → `recurring/new`; fila → `occurrence/[id]` |
| `home` sin pagos | SectionHeader y texto "Agrega tus pagos fijos" / "Arriendo, servicios, suscripciones: te mostramos cuánto falta cada mes" | "Nuevo" |
| `home` con pagos y nada este mes | "Sin pagos este mes" y StatTiles en $0 | "Nuevo" |
| `payments` | Título "Pagos". MonthNavigator ("‹ noviembre de 2026 ›"). MonthOverview del mes (`GET /recurring/occurrences?month=`). Botón secundario "Mis pagos" | ‹ / › cambian de mes (deshabilitados en `bounds`); fila → `occurrence/[id]`; "Mis pagos" → `recurring/index` |
| `payments` cargando / error | Indicador "Cargando pagos" / QueryError con "Reintentar"; al cambiar de mes se conserva el mes anterior hasta que llegue el nuevo | — |
| `recurring/index` | SectionHeader "Mis pagos" + "Nuevo". Lista: nombre, "Mensual · día 5" / "Anual · 10 mar", monto esperado y "Activo" o "Pausado" escrito. Vacía: "Agrega tus pagos fijos" | Fila → `recurring/[id]`; "Nuevo" → `recurring/new` |
| `recurring/new` | RecurringForm: Nombre, Monto esperado, Frecuencia (Mensual / Anual, radio), Primer vencimiento (DateField) | "Guardar pago" (primario) → vuelve a la pantalla de origen; "Cancelar" |
| `recurring/[id]` | Nombre, monto esperado, frecuencia con su día, estado y "Próximo vencimiento 5 dic" (o "Pausado: no genera pagos nuevos") | "Editar" → `recurring/[id]/edit`; "Pausar" / "Reanudar"; "Eliminar" (texto `danger`) con confirmación "¿Eliminar Gimnasio? Se borran sus pagos pendientes y se conserva lo que ya pagaste." |
| `recurring/[id]/edit` | RecurringForm con Nombre, Monto, Frecuencia y "Próximo vencimiento" (prellenado con `nextDueDate`, o hoy si está pausado). Nota: "Los cambios de monto y fecha aplican desde hoy; lo pagado no cambia." | "Guardar cambios"; "Cancelar" |
| `occurrence/[id]` | Nombre, fecha larga, StatusChip, "Esperado $65.000" y, si está pagada, "Pagado $70.000 el 23 de noviembre de 2026". Si el pago fue eliminado: "Este pago fue eliminado" | No pagada: "Marcar pagado" → `occurrence/[id]/pay`. Pagada (pago no eliminado): "Deshacer pago". "Ver pago" → `recurring/[id]` si no fue eliminado |
| `occurrence/[id]/pay` (hoja) | "Marcar pagado · Celular". Campo "Monto pagado" prellenado con el esperado y editable (teclado numérico) | "Confirmar pago" (primario) → cierra la hoja; "Cancelar" |

## Componentes nuevos o ampliados

- **StatTile**: etiqueta (`textSecondary`), monto (`amount`, tabular, se ajusta al ancho) y línea
  secundaria opcional. En MonthOverview: "Total del mes" y "Pagado" lado a lado; debajo,
  "Faltan $185.000" (o "Todo pagado" si es 0 y hay pagos).
- **RecurringRow** (ListRow del diseño): nombre y fecha corta a la izquierda; monto y StatusChip a
  la derecha. Fila tocable ≥ 44. Etiqueta accesible: "Gimnasio, 10 de noviembre, $120.000,
  vencido".
- **MonthOverview**: StatTiles + "Faltan" + lista de RecurringRow en un ListPanel; vacío: "Sin pagos
  este mes". Se usa en el inicio y en la pestaña.
- **MonthNavigator**: botones "Mes anterior" y "Mes siguiente" (íconos `chevron-back` /
  `chevron-forward`, 44 × 44, deshabilitados fuera de `bounds` con `accessibilityState`) y el mes
  como encabezado en una región `polite`.
- **RecurringSection**: SectionHeader + MonthOverview o la invitación.
- **RecurringForm**: campos con validación del dominio (mismos códigos que el API); frecuencia como
  opciones de radio ≥ 44.
- **StatusChip**: + `pending` ("Pendiente", `warning` sobre `warningSoft`, 5,20).
- **TabBar**: + `payments` con ícono `calendar` / `calendar-outline`.

## Accesibilidad

- Cada fila se lee como una frase (nombre, fecha, monto, estado); los StatTiles como "Total del
  mes, $1.480.000".
- El cambio de mes se anuncia ("noviembre de 2026").
- La hoja de pagar enfoca el campo de monto y se cierra con el gesto nativo o "Cancelar".
