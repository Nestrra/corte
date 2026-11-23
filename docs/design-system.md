# Corte · Sistema de diseño

Referencia visual de la app. Las specs citan este documento en lugar de repetirlo.
Diseño de referencia: https://claude.ai/artifact/9ipVusGjR4hUvszf7tMRy7

## Reglas

1. Toda la UI usa tokens del tema. No se escriben colores, tamaños ni espaciados sueltos en los componentes.
2. El texto cumple contraste WCAG AA (4.5:1; 3:1 desde 24 px).
3. Las áreas táctiles miden mínimo 44 × 44 px.
4. Los montos usan números tabulares (`fontVariant: ['tabular-nums']`).
5. Los estados nunca se comunican solo con color: siempre llevan texto (Pagado, Pendiente, Vencido).
6. Modo oscuro: pendiente de diseño; los tokens se nombran por rol para poder agregarlo sin tocar componentes.

## Colores

| Token | Valor | Uso |
| --- | --- | --- |
| `bg` | `#F6F7F9` | Fondo de pantalla |
| `surface` | `#FFFFFF` | Paneles, listas, tab bar |
| `border` | `#E4E7EC` | Bordes de paneles |
| `divider` | `#F2F4F7` | Separadores dentro de listas |
| `text` | `#101828` | Texto principal |
| `textSecondary` | `#475467` | Etiquetas y texto secundario |
| `textTertiary` | `#667085` | Fechas, tabs inactivos |
| `primary` | `#4F46E5` | Acento: botón principal, barras de progreso |
| `primaryStrong` | `#3730A3` | Texto sobre `primarySoft`, tab activo |
| `primarySoft` | `#EEF0FF` | Botones secundarios, fondo de barras |
| `success` / `successSoft` | `#067647` / `#ECFDF3` | Pagado |
| `warning` / `warningSoft` | `#B54708` / `#FFFAEB` | Pendiente, próximo pago, tope ≥ 70% |
| `danger` / `dangerSoft` | `#B42318` / `#FEF3F2` | Vencido, tope ≥ 100% |
| `onPrimary` | `#FFFFFF` | Texto sobre `primary` (botón principal) |

### Colores de tarjeta

El usuario elige uno al crear la tarjeta. Se guarda la clave, no los valores. Cada tarjeta es un
degradado diagonal (`expo-linear-gradient`) del primer color, arriba a la izquierda, al segundo,
abajo a la derecha. Cada color define su texto principal (`text`) y secundario (`textSecondary`).

| Clave | Nombre | Degradado | `text` | `textSecondary` |
| --- | --- | --- | --- | --- |
| `negro` | Negro | `#111827` → `#4B5563` | `#FFFFFF` | `rgba(255,255,255,0.8)` |
| `morado` | Morado | `#4C1D95` → `#7E22CE` | `#FFFFFF` | `rgba(255,255,255,0.8)` |
| `amarillo` | Amarillo | `#F59E0B` → `#FDE047` | `#1F1300` | `rgba(31,19,0,0.8)` |
| `naranja` | Naranja | `#9A3412` → `#C2410C` | `#FFFFFF` | `rgba(255,255,255,0.95)` |
| `verde` | Verde | `#14532D` → `#15803D` | `#FFFFFF` | `rgba(255,255,255,0.95)` |
| `marron` | Marrón | `#451A03` → `#78350F` | `#FFFFFF` | `rgba(255,255,255,0.8)` |

Contraste calculado (WCAG) en el peor extremo de cada degradado: principal ≥ 5,02 y secundario
≥ 4,70 (AA). Con 80% de opacidad el secundario no alcanza 4,5 sobre el extremo claro de `naranja`
(3,85) ni de `verde` (3,82); por eso esos dos usan 95%.

| Clave | Principal (mín.) | Secundario (mín.) |
| --- | --- | --- |
| `negro` | 7,56 | 5,55 |
| `morado` | 6,98 | 4,98 |
| `amarillo` | 8,49 | 5,76 |
| `naranja` | 5,18 | 4,84 |
| `verde` | 5,02 | 4,70 |
| `marron` | 9,07 | 6,45 |

## Tipografía

Plus Jakarta Sans (600, 700) para títulos y montos; Inter (400, 500, 600) para el resto.

| Token | Fuente | Tamaño / línea | Peso |
| --- | --- | --- | --- |
| `amount` | Plus Jakarta Sans | 32 / 40 | 700 |
| `title` | Plus Jakarta Sans | 24 / 32 | 700 |
| `section` | Plus Jakarta Sans | 20 / 28 | 700 |
| `body` | Inter | 16 / 24 | 400 |
| `bodyStrong` | Inter | 15 / 22 | 600 |
| `secondary` | Inter | 14 / 20 | 400 |
| `caption` | Inter | 12 / 16 | 500 |
| `tab` | Inter | 11 / 14 | 500 (600 activo) |

## Espaciado y radios

- Escala de espaciado: `4, 8, 12, 16, 20, 24, 32, 48`. Margen lateral de pantalla: 20. Separación entre secciones: 28.
- Radios: `8` chips · `12` botones e inputs · `16` paneles · `24` tarjetas · `full` botones redondos.

## Interacción

| Token | Valor | Uso |
| --- | --- | --- |
| `interaction.pressedOpacity` | `0.7` | Opacidad de un control pulsado o deshabilitado (p. ej. `Button`) |
| `interaction.staleOpacity` | `0.85` | Valores de una simulación que se recalcula; solo sobre `text`, `textSecondary` y `primaryStrong` (siguen en AA: 5,17 el peor par). No se usa en avisos ni StatusChip |

## Componentes base

- **CreditCardView**: proporción 1,586:1 (formato de tarjeta bancaria), radio 24, degradado del color de tarjeta con su `text` y `textSecondary`. Muestra nombre, últimos 4 dígitos, cupo disponible y "Corte día X · Pago día Y". Toque → detalle de la tarjeta.
- **CardCarousel**: con una sola tarjeta, ancho = pantalla − 40, centrada. Con varias, ancho = pantalla − 56 y separación de 20, de modo que asoman 16 px de la siguiente; snap alineado al margen izquierdo de 20 (la última descansa en el margen derecho). Indicador de puntos (el activo más ancho).
- **CycleSummary** (spec 004): panel del ciclo de la tarjeta al frente: próximo pago (monto, "Paga hasta 25 nov", días restantes), próximo corte y "Tope del ciclo (estimado)" con su barra. El próximo pago con 5 días o menos lleva fondo `warningSoft` y chip "Pronto" (`warning` sobre `surface`, 5,43); vencido, fondo `dangerSoft` y chip "Vencido" (`danger` sobre `surface`, 6,57); los textos sobre esos fondos pasan 7,07 o más. Desde 100% dice "Superaste el tope". El encabezado "Resumen de <tarjeta>" se anuncia al deslizar. Filas tocables ≥ 44.
- **ProgressBar**: alto 8, fondo `primarySoft`, relleno `primary`; `warning` desde 70% y `danger` desde 100% (`budgetLevel` de `@corte/domain`). Rol `progressbar` con el porcentaje real en la etiqueta; el porcentaje siempre va escrito junto a la barra.
- **SimulationPanel** (spec 004): "Si la registras": primera cuota, tope del ciclo antes → después con su barra, cupo disponible después, intereses estimados y el plan (InstallmentRow con StatusChip). Avisos de tope y cupo superados en `danger` sobre `dangerSoft`. Mientras recalcula muestra los últimos valores atenuados con `interaction.staleOpacity` y "Actualizando…", sin spinner; la atenuación solo se aplica a cifras, fechas y barra (`text`, `textSecondary`, `primaryStrong`: 5,17 el peor par a 0,85), nunca a avisos ni StatusChip.
- **CardPicker** (spec 004): fila con la tarjeta elegida ("Visa ·· 1234") y "Cambiar", que despliega las tarjetas activas como opciones de radio. Filas ≥ 44.
- **EmptyCards** (spec 004): "Agrega tu primera tarjeta", texto y botón "Agregar tarjeta"; en el inicio y en "Registrar compra" sin tarjetas.
- **StatTile**: etiqueta, monto y línea secundaria (Total del mes, Pagado).
- **ListRow**: nombre y fecha a la izquierda; monto y StatusChip a la derecha.
- **StatusChip**: Pagado (`success`), Pendiente (`warning`), Vencido (`danger`). Los extractos
  (spec 003) agregan Abierto (neutral: `textSecondary` sobre `surface`, borde `border`) y Por pagar
  (`warning`); el estado siempre va escrito. Contraste del texto sobre su fondo: Abierto 7,69;
  Por pagar 5,20; Vencido 6,05; Pagado 5,40.
- **SectionHeader**: título de sección y botón secundario con ícono + ("Agregar", "Nuevo").
- **Button**: primario (`primary`, texto blanco) y secundario (`primarySoft`, texto `primaryStrong`), alto 44.
- **TabBar**: Inicio, Tarjetas, botón central "Registrar compra" (56 px, `primary`), Pagos, Perfil.
  Se construye por partes: la spec 002 trae Inicio, Tarjetas y Perfil; la spec 004, el botón
  central (`layout.tabCenterButton`, ícono `add` en `onPrimary`, 6,29; etiqueta accesible
  "Registrar compra"), que abre el registro con la tarjeta al frente del inicio; Pagos llega en la
  spec 005, sin cambiar los tokens.

## Pantalla de inicio

1. Saludo y botón de notificaciones.
2. "Mis tarjetas" + botón Agregar, carrusel de tarjetas.
3. CycleSummary de la tarjeta al frente.
4. "Pagos de <mes>" + botón Nuevo, StatTiles de total y pagado, lista de pagos recurrentes ordenada: vencidos, pendientes, pagados.
5. TabBar fija.

## Tokens (para `apps/mobile/src/theme`)

```ts
export const colors = {
  bg: '#F6F7F9', surface: '#FFFFFF', border: '#E4E7EC', divider: '#F2F4F7',
  text: '#101828', textSecondary: '#475467', textTertiary: '#667085',
  primary: '#4F46E5', primaryStrong: '#3730A3', primarySoft: '#EEF0FF',
  success: '#067647', successSoft: '#ECFDF3',
  warning: '#B54708', warningSoft: '#FFFAEB',
  danger: '#B42318', dangerSoft: '#FEF3F2',
  onPrimary: '#FFFFFF',
} as const;

export const cardColors = {
  negro: { gradient: ['#111827', '#4B5563'], text: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.8)' },
  morado: { gradient: ['#4C1D95', '#7E22CE'], text: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.8)' },
  amarillo: { gradient: ['#F59E0B', '#FDE047'], text: '#1F1300', textSecondary: 'rgba(31,19,0,0.8)' },
  naranja: { gradient: ['#9A3412', '#C2410C'], text: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.95)' },
  verde: { gradient: ['#14532D', '#15803D'], text: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.95)' },
  marron: { gradient: ['#451A03', '#78350F'], text: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.8)' },
} as const;
export const cardGradient = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 48 } as const;
export const radius = { chip: 8, control: 12, panel: 16, card: 24, full: 999 } as const;
// en layout: cardAspectRatio: 1.586, cardPeek: 16, tabCenterButton: 56
export const interaction = { pressedOpacity: 0.7, staleOpacity: 0.85 } as const;
```
