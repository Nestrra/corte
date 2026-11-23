# Contrato de UI: inicio, botón central y simulador

Textos en español; solo tokens de `docs/design-system.md` (principio IX); errores con texto
(`specs/003-purchases/contracts/errors.md`). Montos con `formatCop` en `tabular-nums`; fechas
cortas "25 nov" en el inicio y largas "8 de diciembre de 2026" en la simulación y la confirmación.
Todo interés lleva "estimado". Los estados y niveles siempre van escritos, no solo con color.
Decisiones en [research.md](../research.md).

## Navegación

```text
(tabs)/home                      inicio (reemplaza el temporal de la spec 001)
(tabs)/cards                     sin cambios
(tabs)/register                  ruta vacía: el TabBar la dibuja como botón central (R8)
(tabs)/profile                   sin cambios
purchase/new?cardId=             registrar compra con selector y simulación (R9)
card/[id]/purchases/new          se elimina; el detalle de la tarjeta abre purchase/new?cardId=
```

## Pantallas

| Ruta | Contenido | Acciones |
| --- | --- | --- |
| `home` con tarjetas | "Hola, <nombre>" (título). SectionHeader "Mis tarjetas" + "Agregar". CardCarousel de las activas (`GET /summary`). CycleSummary de la tarjeta al frente | "Agregar" → `card/new`; tocar una tarjeta → `card/[id]`; filas del resumen (abajo) |
| `home` sin tarjetas | Saludo y EmptyCards: "Agrega tu primera tarjeta" y "Así sabrás cuánto y cuándo pagar cada tarjeta" | "Agregar tarjeta" (primario) → `card/new` |
| `home` cargando / error | Indicador con etiqueta "Cargando inicio" / QueryError con "Reintentar" | — |
| `purchase/new` | CardPicker arriba ("Tarjeta · Visa Oro ·· 1234 · Cambiar"). PurchaseForm (spec 003) con SimulationPanel entre "Sin intereses" y los botones | "Guardar compra" (primario); "Cancelar" (secundario, sale sin guardar) |
| `purchase/new` sin tarjetas activas | EmptyCards | "Agregar tarjeta" → `card/new` (reemplaza la pantalla) |
| Confirmación al registrar | La de la spec 003 | "Ver compra" → reemplaza por `purchase/[id]`; "Listo" → `router.back()` (pestaña o detalle de origen) |

## Componentes

- **TabBar** (cambio): Inicio, Tarjetas, botón central y Perfil. Botón central: círculo de 56
  (`layout.tabCenterButton`, token nuevo), fondo `primary`, ícono `add` en `onPrimary`, sin
  texto visible, `accessibilityRole="button"`, etiqueta "Registrar compra". Toque →
  `router.push({ pathname: '/purchase/new', params: { cardId: frontCardId } })`.
- **CycleSummary**: panel `surface` con tres filas tocables (≥ 44, `accessibilityRole="button"`):
  - **Próximo pago**: "$850.000" (`bodyStrong`), "Paga hasta 25 nov · En 2 días". Urgencia
    (`paymentUrgency`): `soon` → fondo `warningSoft` y chip "Pronto" (`warning`); `overdue` → fondo
    `dangerSoft`, chip "Vencido" (`danger`) y "Hace 3 días". Sin pago: "Sin pagos pendientes" (no
    tocable). Toque → `statement/[statementId]`.
  - **Próximo corte**: "8 dic · En 15 días". No tocable.
  - **Ciclo actual**: "Tope del ciclo (estimado)", "75% · $1.500.000 de $2.000.000" y ProgressBar;
    desde 100% agrega "Superaste el tope". Toque → `card/[id]/statements`.
  - Encabezado "Resumen de <tarjeta>" (`accessibilityRole="header"`) dentro de una región
    `accessibilityLiveRegion="polite"`, para anunciar el cambio al deslizar.
  - Etiquetas accesibles como frases: "Próximo pago: 850.000 pesos, paga hasta el 25 de
    noviembre, en 2 días, pronto".
- **ProgressBar**: alto 8, radio completo, fondo `primarySoft`; relleno `primary` / `warning` /
  `danger` según `budgetLevel`; ancho `min(percent, 100)%`. `accessibilityRole="progressbar"`,
  `accessibilityValue={{ min: 0, max: 100, now: min(percent, 100) }}` y etiqueta con el porcentaje
  real.
- **CardCarousel** (cambio): prop opcional `onActiveChange(card)`; se llama al montar, al terminar
  el deslizamiento y cuando la lista cambia. Solo el inicio la usa (fija la tarjeta al frente).
- **CardPicker**: fila tocable (≥ 44) con el nombre y "·· 1234" de la tarjeta elegida y "Cambiar";
  al tocarla despliega las activas como opciones (`accessibilityRole="radio"`,
  `accessibilityState.checked`), cada una ≥ 44. Con una sola tarjeta, no muestra "Cambiar".
- **SimulationPanel** (debajo de "Sin intereses"):
  - Título "Si la registras" (`accessibilityRole="header"`).
  - "Primera cuota en el corte del 8 de diciembre de 2026 · se paga el 25 de diciembre de 2026".
    Si el extracto de la primera cuota no está abierto, se agrega su estado con StatusChip.
  - "Tope del ciclo (estimado): 75% → 105%" con ProgressBar del después y "$2.100.000 de
    $2.000.000". Si la compra no toca el ciclo actual: "No cambia el tope de este ciclo".
  - "Cupo disponible después: −$300.000".
  - "Intereses estimados: $112.450" (o "Sin intereses").
  - Plan: InstallmentRow por cuota ("Corte 8 dic 2026 · paga 25 dic 2026", "1 de 3", abono,
    interés estimado y StatusChip del extracto).
  - Avisos (fondo `dangerSoft`, texto `danger`, `accessibilityLiveRegion="polite"`): "Con esta
    compra superas el tope del ciclo" (percentAfter ≥ 100) y "Con esta compra superas tu cupo
    disponible" (after < 0). No impiden guardar.
  - Datos incompletos o inválidos: una línea `textSecondary` con lo que falta ("Escribe el valor
    para simular", "Las cuotas van de 1 a 72", "La fecha no puede ser futura").
  - Primera vez, sin valores previos: texto "Calculando…" (sin spinner). Recalculando: se ven los
    últimos valores atenuados (`interaction.staleOpacity`, 0,85) con "Actualizando…" y
    `accessibilityState.busy`, sin spinner; los avisos y los StatusChip no se atenúan (AA). Una
    respuesta de datos anteriores nunca reemplaza la de los datos actuales (R7).
  - Error: "No pudimos simular la compra" y "Reintentar" (no bloquea "Guardar").
- **EmptyCards**: título, texto y botón "Agregar tarjeta"; se usa en el inicio y en `purchase/new`.

## Comportamiento

- **Inicio**: `GET /summary` con clave `['summary']`; se vuelve a pedir al enfocarse y cuando la app
  vuelve a primer plano (R11). La tarjeta al frente se guarda en `front-card-store` (R6); si ya no
  existe, se usa la primera.
- **Invalidación** (FR-021, R11): toda mutación de compras (registrar, editar, borrar), pagos
  (marcar pagado, deshacer) y tarjetas (crear, editar, archivar, restaurar) invalida
  `['summary']`, siempre a través de `invalidateCardLedger` o `invalidateCards`.
- **Simulación**: se pide 350 ms después del último cambio de valor, fecha, cuotas, "Sin intereses"
  o tarjeta, solo con datos válidos según el esquema local (R7). Clave `['simulation', cardId,
  input]`. El concepto no interviene.
- **Cambiar de tarjeta**: conserva lo escrito; la nota de la tasa, el aviso de cupo al guardar
  (spec 003 FR-012) y la simulación usan la tarjeta nueva.
- **Guardar**: igual que la spec 003 (`POST /cards/:id/purchases` con la tarjeta elegida).
- **Salir sin guardar**: "Cancelar" o volver; no se pregunta nada porque no se creó nada (FR-010).
