# Quickstart / Guía de validación: spec 004

Cómo comprobar de punta a punta el inicio y el simulador. Contratos en [contracts/](./contracts/),
estructuras en [data-model.md](./data-model.md), decisiones en [research.md](./research.md).

Las fechas de ejemplo suponen que **hoy es 23 de noviembre de 2026** en America/Bogota. Las e2e de
esta spec fijan el reloj en `2026-11-23T15:00:00Z` (hoy = 23 de noviembre en Bogotá) y no dependen
de la fecha real; las de las specs anteriores siguen con `2026-11-22T02:30:00Z`.

## Preparación

```bash
pnpm install
pnpm db:up
pnpm --filter api db:migrate        # sin migraciones nuevas en esta spec
pnpm --filter api dev               # terminal 1
```

```bash
API=http://localhost:3000/api/v1
TOKEN=$(curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ana","email":"ana4@ejemplo.com","password":"clave-segura-1"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
AUTH="Authorization: Bearer $TOKEN"
CARD=$(curl -s -X POST $API/cards -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Visa","color":"verde","cutoffDay":8,"dueDay":25,"creditLimit":5000000,"cycleBudget":2000000,"annualRate":24}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
```

## B1. Dominio (R2, R5)

```bash
pnpm --filter @corte/domain test:cov
```

**Esperado**: pasan las pruebas nuevas de `simulation.test.ts` y de `statements.test.ts`
(`nextPayment`, `budgetLevel`, `paymentUrgency`) y la cobertura sigue ≥ 95% (SC-009).

## B2. Simular sin guardar (historia 1, escenario 1; FR-002, FR-005)

```bash
curl -s -X POST $API/cards/$CARD/simulate -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"amount":300000,"purchaseDate":"2026-11-23","installmentCount":3}'
curl -s $API/cards/$CARD/purchases -H "$AUTH"
curl -s $API/cards/$CARD/statements -H "$AUTH"
```

**Esperado**: 200 con 3 cuotas de `principal` 100000 en `2026-12-08` (`dueDate` `2026-12-25`),
`2027-01-08` y `2027-02-08`, intereses 5426, 3618 y 1809, `totalInterest` 10853 y
`statementStatus` `open` en las tres. Las listas de compras y extractos siguen vacías.

## B3. Tope al 105% (historia 1, escenario 2; FR-003, FR-008)

```bash
curl -s -X POST $API/cards/$CARD/purchases -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"amount":1500000,"concept":"Mercado","purchaseDate":"2026-11-23"}'
curl -s -X POST $API/cards/$CARD/simulate -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"amount":600000}'
```

**Esperado**: `cycleBudgetUsage` con `cutoffDate` `2026-12-08`, `amountBefore` 1500000,
`amountAfter` 2100000, `percentBefore` 75 y `percentAfter` 105; `availableCredit` `before` 3500000
y `after` 2900000.

## B4. Cupo negativo, ciclo siguiente y validaciones (FR-004, FR-006)

```bash
# Cupo: after = 3.500.000 − 4.000.000
curl -s -X POST $API/cards/$CARD/simulate -H "$AUTH" -H 'Content-Type: application/json' -d '{"amount":4000000}'
# Fecha pasada: cae en el corte del 8 de noviembre (no toca el tope del ciclo actual)
curl -s -X POST $API/cards/$CARD/simulate -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"amount":200000,"purchaseDate":"2026-11-05"}'
# Inválidos
curl -s -X POST $API/cards/$CARD/simulate -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"amount":0,"installmentCount":73,"purchaseDate":"2026-12-01"}'
```

**Esperado**: `availableCredit.after` −500000; con fecha 5 de noviembre, primera cuota en
`2026-11-08` con `statementStatus` `due` y `amountAfter` = `amountBefore`; el último responde 400
`VALIDATION_ERROR` con `amount` e `installmentCount`. La fecha futura (`purchaseDate` `IN_FUTURE`)
se valida después, con el "hoy" del usuario, y sale sola cuando el resto es válido (igual que al
registrar en la spec 003): `-d '{"amount":1,"purchaseDate":"2026-12-01"}'`.

## B5. Archivada, aislamiento y nada escrito (FR-006, FR-023, SC-002, SC-007)

```bash
pnpm --filter api test:e2e -- simulate summary home-isolation
```

**Esperado**: todo en verde: simular sobre una tarjeta archivada da 409 `CARD_ARCHIVED`; otro
usuario recibe 404 `NOT_FOUND` al simular sobre la tarjeta y no la ve en su `/summary`; tras
varias simulaciones, el número de compras, cuotas y extractos y el cupo no cambian; simular y
luego registrar la misma compra dan el mismo plan (SC-001).

## B6. Resumen del inicio (historia 2; FR-015)

```bash
curl -s -X POST $API/cards/$CARD/purchases -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"amount":850000,"concept":"Pasajes","purchaseDate":"2026-11-05"}'
curl -s $API/summary -H "$AUTH"
```

**Esperado**: `today` `2026-11-23`; una tarjeta con `nextPayment` del corte `2026-11-08`
(`dueDate` `2026-11-25`, `amount` 850000, `status` `due`, `daysLeft` 2); `nextCutoff`
`2026-12-08` con `daysLeft` 15; `cycleBudgetUsage` 1500000 y 75%. Un usuario sin tarjetas recibe
`cards: []`. El caso Vencido se prueba en `summary.e2e-spec.ts` moviendo el reloj.

## B7. Calidad

```bash
pnpm lint && pnpm format:check && pnpm typecheck
pnpm --filter api test && pnpm --filter api test:e2e
```

**Esperado**: todo en verde.

## B8. App en iOS y Android (manual, historias 1 a 5; SC-003 a SC-006, SC-008)

`pnpm --filter mobile start` con `EXPO_PUBLIC_API_URL` como en la spec 000, con los datos de B3 y B6.

1. **Inicio**: "Hola, Ana", "Mis tarjetas" con "Agregar", el carrusel y el resumen: "Próximo
   pago $850.000 · Paga hasta 25 nov · En 2 días" con "Pronto" en el color de alerta; "Próximo
   corte 8 dic · En 15 días"; "Tope del ciclo (estimado) 75% · $1.500.000 de $2.000.000" con la
   barra en alerta. Cronometrar: desde abrir la app, saber cuánto y cuándo pagar toma menos
   de 5 segundos sin tocar nada (SC-004).
2. **Deslizar**: con dos tarjetas, el resumen cambia a la del frente y VoiceOver/TalkBack anuncia
   "Resumen de <tarjeta>".
3. **Tocar**: el próximo pago abre su extracto; el ciclo actual abre los extractos de la tarjeta.
4. **Botón central** desde Inicio, Tarjetas y Perfil: abre "Registrar compra" con la tarjeta del
   frente; "Cambiar" lista las activas y al elegir otra se conservan los datos escritos. Si se
   archiva la tarjeta del frente desde su detalle y se toca el botón central sin pasar por el
   inicio, se preselecciona la primera activa.
5. **Simulación en vivo**: al escribir $600.000 aparece "Tope del ciclo (estimado): 75% → 105%",
   el aviso "Con esta compra superas el tope del ciclo" y el cupo después; con 3 cuotas el plan
   muestra 3 meses con interés estimado y el total. Responde en menos de 1 segundo tras dejar de
   escribir. Mientras recalcula, los valores anteriores se ven atenuados con "Actualizando…" (sin
   spinner); al escribir rápido el valor 1, 12, 120.000… el panel termina mostrando la última combinación.
   Con 72 cuotas, escribir en el valor sigue fluido mientras el plan se actualiza. Con el valor
   vacío dice "Escribe el valor para simular".
6. **Salir sin guardar**: "Cancelar" y volver; las cifras del inicio no cambian.
7. **Guardar**: confirmación de la spec 003; "Listo" vuelve a la pestaña de origen y el inicio
   muestra el nuevo tope sin recargar. Desde el detalle de la tarjeta, "Registrar compra" abre la
   misma pantalla con esa tarjeta y con simulación. Cronometrar: simular y registrar una compra
   a cuotas desde cualquier pestaña toma menos de 45 segundos (SC-005).
8. **Al día**: pagar el extracto del 8 de noviembre → el próximo pago dice "Sin pagos pendientes";
   deshacerlo → vuelve; editar el tope de la tarjeta → el porcentaje cambia; editar y borrar una
   compra, crear, archivar y restaurar una tarjeta → el inicio refleja cada cambio al volver.
9. **Sin tarjetas**: con un usuario nuevo, el inicio muestra "Agrega tu primera tarjeta" y el
   botón central también; al crearla, el inicio muestra el carrusel y el resumen.
10. **Accesibilidad**: el botón central se anuncia "Registrar compra, botón"; la barra se lee con
    su porcentaje; urgencia y avisos se entienden sin color; todas las áreas táctiles ≥ 44.
11. **Android**: montos como `$1.500.000` y `−$500.000`.
