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

### Colores de tarjeta

El usuario elige uno al crear la tarjeta. Se guarda la clave, no el hex.

| Clave | Valor |
| --- | --- |
| `indigo` | `#3730A3` |
| `petroleo` | `#0F4C5C` |
| `ciruela` | `#5B2A6E` |
| `grafito` | `#1F2937` |
| `bosque` | `#166534` |
| `terracota` | `#9A3412` |

Texto sobre tarjeta: blanco; secundario `rgba(255,255,255,0.8)`.

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

## Componentes base

- **CreditCardView**: 300 × 184, radio 24, color de tarjeta. Muestra nombre, últimos 4 dígitos, cupo disponible y "Corte día X · Pago día Y". Toque → detalle de la tarjeta.
- **CardCarousel**: scroll horizontal con snap, peek de la siguiente tarjeta e indicador de puntos.
- **CycleSummary**: panel del ciclo de la tarjeta al frente: próximo pago (monto, fecha, días restantes), próximo corte y barra del % del tope.
- **ProgressBar**: alto 8, fondo `primarySoft`, relleno `primary`; `warning` desde 70% y `danger` desde 100%.
- **StatTile**: etiqueta, monto y línea secundaria (Total del mes, Pagado).
- **ListRow**: nombre y fecha a la izquierda; monto y StatusChip a la derecha.
- **StatusChip**: Pagado (`success`), Pendiente (`warning`), Vencido (`danger`).
- **SectionHeader**: título de sección y botón secundario con ícono + ("Agregar", "Nuevo").
- **Button**: primario (`primary`, texto blanco) y secundario (`primarySoft`, texto `primaryStrong`), alto 44.
- **TabBar**: Inicio, Tarjetas, botón central "Registrar compra" (56 px, `primary`), Pagos, Perfil.

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
} as const;

export const cardColors = {
  indigo: '#3730A3', petroleo: '#0F4C5C', ciruela: '#5B2A6E',
  grafito: '#1F2937', bosque: '#166534', terracota: '#9A3412',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 48 } as const;
export const radius = { chip: 8, control: 12, panel: 16, card: 24, full: 999 } as const;
```
