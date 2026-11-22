# Contrato de UI: pestañas y tarjetas

Textos en español; solo tokens de `docs/design-system.md` (principio IX); errores con texto
([errors.md](./errors.md)). Montos con `formatCop` (`$5.000.000`) en `tabular-nums`; fechas como
"8 de diciembre de 2026".

## Navegación

```text
(app)                          Stack (Protected guard={!mustChangePassword})
├── (tabs)                     Tabs con TabBar propia: Inicio · Tarjetas · Perfil
│   ├── home                   pantalla temporal de la spec 001 (sin el botón "Perfil")
│   ├── cards                  carrusel + "Agregar tarjeta" + "Archivadas"
│   └── profile                perfil de la spec 001
├── card/new                   formulario (crear)
├── card/[id]                  detalle
├── card/[id]/edit             formulario (editar)
├── card/archived              lista de archivadas
├── timezone · delete-account  (spec 001)
└── change-password            fuera del Protected (spec 001)
```

## TabBar

Fondo `surface`, borde superior `border`. Tres pestañas con ícono (Ionicons) y etiqueta: activa en
`primary` con `tabActive` (peso 600), inactiva en `textSecondary` con `tab`. Cada pestaña es un
botón de al menos 44 × 44 con `accessibilityRole="tab"` y `accessibilityState={{ selected }}`.

## Pantallas

| Ruta | Contenido | Acciones |
| --- | --- | --- |
| `(tabs)/cards` | Título "Tarjetas". Con tarjetas: carrusel (CardCarousel) de tarjetas activas. Sin tarjetas: "Aún no tienes tarjetas" + texto de ayuda | "Agregar tarjeta" (primario) → `card/new`; "Archivadas (N)" (secundario, solo si N > 0) → `card/archived`; tocar una tarjeta → `card/[id]` |
| `card/new` y `card/[id]/edit` | Formulario: Nombre; Color (radio group de 6); Últimos 4 dígitos (opcional); Día de corte; Día límite de pago; Cupo total; Tope por ciclo; Recordar corte (días antes, 2); Recordar pago (días antes, 3) | "Guardar tarjeta" (primario); "Cancelar" (secundario) |
| `card/[id]` | CreditCardView; panel "Próximo corte: 8 de diciembre de 2026 · faltan 17 días"; "Fecha límite de ese corte: 25 de diciembre de 2026 · faltan 34 días"; datos: cupo total, tope por ciclo, recordatorios. Archivada: aviso "Tarjeta archivada" y datos de solo lectura | Activa: "Editar" (secundario), "Archivar" (texto `danger`, con confirmación). Archivada: "Restaurar" (primario) |
| `card/archived` | Lista de archivadas: punto o franja de su color, nombre y "**** 4821" | Tocar → `card/[id]` (solo lectura) |

Días restantes: 0 → "Hoy", 1 → "Mañana", N → "faltan N días".

## Componentes

- **CreditCardView**: proporción 1,586:1 (el ancho lo da quien la usa), radio `card` (24), degradado
  diagonal de `cardColors[color]`. Nombre (`bodyStrong`, `text` del color), "**** 4821"
  (`secondary`, `textSecondary`), etiqueta "Cupo disponible" (`caption`, `textSecondary`) y monto
  (`amount`, `text`), "Corte día 8 · Pago día 25" (`caption`, `textSecondary`). En amarillo el texto
  es oscuro. `accessibilityLabel` con todo el contenido. En el detalle mide pantalla − 40.
- **CardCarousel**: una tarjeta: ancho pantalla − 40, centrada, sin puntos. Varias: `FlatList`
  horizontal, ancho pantalla − 56, separación 20 (asoman 16 px de la siguiente), `snapToOffsets`
  alineados al margen izquierdo de 20; puntos debajo (activo `primary` y más ancho, inactivos
  `border`) con `accessibilityLabel` "Tarjeta 1 de 3".
- **ColorPicker**: `radiogroup` con 6 círculos de 44 con el degradado de cada color; el elegido con
  borde `text` y un ícono de check en el `text` del color; nombre accesible: Negro, Morado,
  Amarillo, Naranja, Verde, Marrón.
- **TextField** (spec 001) con teclado numérico para días, montos y recordatorios; los montos se
  muestran formateados al salir del campo.

## Comportamiento

- Validación local con las reglas de `@corte/domain` antes de enviar; errores del API por campo.
- Mientras se guarda: botón con indicador y deshabilitado. Si falla, se conserva lo escrito.
- Tras crear, editar, archivar o restaurar se invalida la lista y el detalle (TanStack Query).
- El detalle se vuelve a pedir al enfocarse la pantalla (cambio de zona horaria, nuevo día).
- `404` en el detalle → "No encontramos esa tarjeta" y botón para volver.
