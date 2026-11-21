# Contrato de UI: pantalla temporal de conexión

Ruta: `/` (expo-router, `src/app/index.tsx`). Se reemplazará por la pantalla de inicio en una spec
posterior. Textos en español (principio VIII); solo tokens del tema (principio IX).

## Contenido

| Elemento | Componente / token | Texto |
| --- | --- | --- |
| Título | `Text` variant `title` | "Corte" |
| Estado | `Text` variant `section` | "Comprobando conexión…" · "Conectado" · "Sin conexión" |
| Detalle | `Text` variant `secondary` | API URL configurada, o "Falta configurar EXPO_PUBLIC_API_URL" |
| Acción | `Button` variant `primary` | "Reintentar" (deshabilitado y con indicador mientras consulta) |

## Comportamiento

1. Al montar la pantalla se consulta `GET {EXPO_PUBLIC_API_URL}/api/v1/health` con timeout de 5 s.
2. Si la respuesta (200 o 503) cumple el esquema `HealthReport` → "Conectado".
3. Error de red, timeout, respuesta no JSON o fuera de esquema, u otro código HTTP → "Sin conexión".
4. "Reintentar" repite la consulta; no hay reintentos automáticos.
5. Si falta `EXPO_PUBLIC_API_URL` no se hace la consulta y se muestra "Sin conexión" con el aviso.

## Accesibilidad y diseño

- El estado siempre es texto; el color (`success` / `danger` de los tokens) es solo refuerzo.
- Contraste WCAG AA para todos los textos sobre el fondo del tema.
- Área táctil del botón ≥ 44 × 44.
- El texto de estado se anuncia al lector de pantalla cuando cambia (`accessibilityLiveRegion="polite"` en Android, `accessibilityRole="text"`).
