# Contrato de UI: compras y extractos

Textos en español; solo tokens de `docs/design-system.md` (principio IX); errores con texto
([errors.md](./errors.md)). Montos con `formatCop` en `tabular-nums`; fechas como "8 de diciembre
de 2026"; tasa como "26,82% EA". Todo interés y todo total con interés lleva la marca
"(estimado)" o "estimado" en texto.

## Navegación (se agrega al Stack de `(app)`, dentro del Protected)

```text
card/[id]                        detalle (spec 002, ampliado)
card/[id]/purchases/index        compras de la tarjeta
card/[id]/purchases/new          formulario (registrar)
purchase/[id]/index              detalle de la compra con su plan
purchase/[id]/edit               formulario (editar)
card/[id]/statements             extractos de la tarjeta
statement/[id]                   detalle del extracto, pagar / deshacer
```

## Pantallas

| Ruta | Contenido | Acciones |
| --- | --- | --- |
| `card/[id]` (cambios) | CreditCardView con el cupo disponible real (negativo: "−$300.000" y texto "Superaste el cupo"). Panel nuevo: "Deuda total $1.200.000"; "Tope del ciclo: 45% · $900.000 de $2.000.000" (sobre 100%: "Superaste el tope"); "Tasa: 26,82% EA" o "Sin tasa". Los paneles de la spec 002 siguen igual | Activa: "Registrar compra" (primario) → `purchases/new`; "Compras" y "Extractos" (secundarios); "Editar", "Archivar" (spec 002). Archivada: "Compras", "Extractos" y "Restaurar" |
| `card/[id]/purchases/new` y `purchase/[id]/edit` | Valor (teclado numérico); Concepto; Fecha (DateField, por defecto hoy del API); Cuotas (1–72, por defecto 1); interruptor "Sin intereses" (apagado). Si la tarjeta tiene tasa y hay más de 1 cuota sin "Sin intereses": "Se aplicará 26,82% EA (estimado)". En edición, la tasa es la guardada en la compra | "Guardar compra" (primario); "Cancelar" (secundario) |
| Confirmación al registrar | Diálogo o banner: "Primera cuota en el extracto del 8 de diciembre de 2026 · se paga el 25 de diciembre de 2026" | "Ver compra" → `purchase/[id]`; "Listo" → vuelve al detalle de la tarjeta |
| `card/[id]/purchases/index` | Lista: concepto, fecha, valor y "3 cuotas" / "1 cuota". Vacía: "Aún no hay compras" | Tocar → `purchase/[id]`; "Registrar compra" si la tarjeta está activa |
| `purchase/[id]` | Concepto, valor, fecha, cuotas, "Sin intereses" o tasa. Plan: por cuota "1 de 3", extracto "Corte 8 dic 2026 · paga 25 dic 2026", abono, interés (estimado) y StatusChip del extracto | Tarjeta activa: "Editar" (secundario), "Borrar" (texto `danger`, con confirmación). Archivada: solo lectura |
| `card/[id]/statements` | Lista (orden del API): StatementRow con fecha de corte, "Paga hasta 25 dic 2026", "A pagar $X" (+ "estimado" si `hasInterest`) y StatusChip. Vacía: "Aún no hay extractos" e invitación a registrar una compra | Tocar → `statement/[id]` |
| `statement/[id]` | Corte, fecha límite, StatusChip, "A pagar". Pagado: "Pagado el 20 de noviembre de 2026 · $X"; si `paidAmount ≠ total`: "Pagaste $X; con los cambios suma $Y". Lista de cuotas (InstallmentRow): concepto, "3 de 12", abono, interés (estimado) | Por pagar / Vencido: "Marcar como pagado" (primario, con confirmación que muestra el monto). Pagado: "Deshacer pago" (secundario, con confirmación). Abierto: texto "Podrás marcarlo pagado después del corte" |

## Formulario de tarjeta (cambio a spec 002)

Campo nuevo "Tasa de interés EA (%)", opcional, después del tope: teclado decimal, acepta coma o
punto ("26,82" o "26.82"), vacío = sin tasa. Ayuda: "La usamos para estimar intereses de compras
a cuotas".

## Componentes

- **StatusChip** (amplía el del sistema de diseño): Abierto (neutral: `textSecondary` sobre
  `surface`, borde `border`), Por pagar (`warning`), Vencido (`danger`), Pagado (`success`).
  Siempre con su texto; contraste AA.
- **StatementRow**: ListRow con fechas a la izquierda; monto y StatusChip a la derecha. Área
  táctil ≥ 44; `accessibilityLabel` con corte, fecha límite, monto (y "estimado") y estado.
- **InstallmentRow**: concepto y "k de n" a la izquierda; abono e "interés $X (estimado)" a la
  derecha.
- **DateField**: botón con la fecha en español que abre el selector nativo
  (`@react-native-community/datetimepicker`) con `maximumDate` = hoy y `minimumDate` = hoy − 72
  meses; área táctil ≥ 44.
- **PurchaseForm**: compartido por registrar y editar; react-hook-form + zod con las reglas de
  `@corte/domain`.

## Comportamiento

- Validación local con las reglas de `@corte/domain` antes de enviar; errores del API por campo.
- **Aviso de cupo (FR-012)**: antes de enviar, si el valor (o el aumento al editar) supera el
  cupo disponible del detalle: "Esta compra supera tu cupo disponible ($500.000). ¿Guardarla de
  todas formas?" con "Guardar" y "Cancelar".
- Mientras se guarda o se paga: botón con indicador y deshabilitado. Si falla, se conserva lo
  escrito.
- Tras registrar, editar, borrar, pagar o deshacer: se invalidan tarjetas, detalle de la tarjeta,
  compras, extractos y el detalle tocado (SC-005).
- Las pantallas de extractos y del detalle de tarjeta se vuelven a pedir al enfocarse (el estado
  depende de "hoy").
- `404` → "No encontramos esa compra/ese extracto" y botón para volver. `409 CARD_ARCHIVED` →
  texto de errors.md y se vuelve al detalle.
