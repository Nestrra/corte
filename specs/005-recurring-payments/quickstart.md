# Quickstart / Guía de validación: spec 005

Cómo comprobar de punta a punta los pagos recurrentes. Contratos en [contracts/](./contracts/),
modelo en [data-model.md](./data-model.md), decisiones en [research.md](./research.md).

Las fechas de ejemplo suponen que **hoy es 23 de noviembre de 2026** en America/Bogota. Las e2e de
esta spec fijan el reloj en `HOME_NOW` (`2026-11-23T15:00:00Z`) y no dependen de la fecha real.

## Preparación

```bash
pnpm install
pnpm db:up
pnpm --filter api db:migrate        # aplica la migración recurring_payments
pnpm --filter api dev               # terminal 1
```

```bash
API=http://localhost:3000/api/v1
TOKEN=$(curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ana","email":"ana5@ejemplo.com","password":"clave-segura-1"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
AUTH="Authorization: Bearer $TOKEN"
JSON='Content-Type: application/json'
new() { curl -s -X POST $API/recurring -H "$AUTH" -H "$JSON" -d "$1" | node -pe 'JSON.parse(require("fs").readFileSync(0)).id'; }
```

## B1. Dominio (R1, R2)

```bash
pnpm --filter @corte/domain test:cov
```

**Esperado**: pasan las pruebas de `recurring.test.ts` (meses cortos, día 29/30/31, febrero
bisiesto y no bisiesto, anual con 29 de febrero, cambio de año, pausa, reanudación, estados,
totales y orden) y la cobertura sigue ≥ 95% (SC-009).

## B2. Vencimientos anclados (historia 1, escenarios 2 y 6; FR-002, SC-001)

```bash
P=$(new '{"name":"Seguro","amount":100000,"frequency":"monthly","firstDueDate":"2027-01-31"}')
for m in 2027-02 2027-03 2027-04; do curl -s "$API/recurring/occurrences?month=$m" -H "$AUTH" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).items.map(i=>i.dueDate).join()'; done
curl -s "$API/recurring/occurrences?month=2026-12" -H "$AUTH"
```

**Esperado**: `2027-02-28`, `2027-03-31`, `2027-04-30`. Diciembre de 2026 no tiene ocurrencias de
"Seguro" (primer vencimiento posterior). Un mes fuera de `bounds`
(`?month=2028-01`) responde 400 `VALIDATION_ERROR` con `month: OUT_OF_RANGE`.

## B3. Totales de noviembre (historia 2, escenarios 1 y 2; FR-012, SC-002)

```bash
ARR=$(new '{"name":"Arriendo","amount":1200000,"frequency":"monthly","firstDueDate":"2026-11-01"}')
INT=$(new '{"name":"Internet","amount":95000,"frequency":"monthly","firstDueDate":"2026-11-05"}')
new '{"name":"Gimnasio","amount":120000,"frequency":"monthly","firstDueDate":"2026-11-10"}' >/dev/null
CEL=$(new '{"name":"Celular","amount":65000,"frequency":"monthly","firstDueDate":"2026-11-28"}')
MONTH=$(curl -s "$API/recurring/occurrences?month=2026-11" -H "$AUTH")
occ() { echo "$MONTH" | node -pe "JSON.parse(require('fs').readFileSync(0)).items.find(i=>i.name==='$1').id"; }
curl -s -X POST $API/occurrences/$(occ Arriendo)/payment -H "$AUTH" >/dev/null
curl -s -X POST $API/occurrences/$(occ Internet)/payment -H "$AUTH" >/dev/null
curl -s "$API/recurring/occurrences?month=2026-11" -H "$AUTH"
```

**Esperado**: `totals` `{ total: 1480000, paid: 1295000, remaining: 185000 }`; `items` en orden
Gimnasio (`overdue`, `2026-11-10`), Celular (`pending`, `2026-11-28`), Arriendo e Internet
(`paid`).

## B4. Monto real y deshacer (historia 3; FR-009, FR-010)

```bash
C=$(occ Celular)
curl -s -X POST $API/occurrences/$C/payment -H "$AUTH" -H "$JSON" -d '{"amount":70000}'
curl -s "$API/recurring/occurrences?month=2026-11" -H "$AUTH" | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)).totals)'
curl -s -X DELETE $API/occurrences/$C/payment -H "$AUTH"
curl -s -X POST $API/occurrences/$C/payment -H "$AUTH" -H "$JSON" -d '{"amount":0}'
```

**Esperado**: la ocurrencia queda `paid` con `paidAmount` 70000 y `paidAt` `2026-11-23`; totales
`{ total: 1485000, paid: 1365000, remaining: 120000 }`; al deshacer vuelve a `pending` con
`paidAmount` null; el último responde 400 con `amount: OUT_OF_RANGE`.

## B5. Editar (historia 5; FR-004, SC-005)

```bash
curl -s -X PATCH $API/recurring/$ARR -H "$AUTH" -H "$JSON" -d '{"amount":1300000}'
curl -s "$API/recurring/occurrences?month=2026-11" -H "$AUTH"   # Arriendo sigue 1200000 pagado
curl -s "$API/recurring/occurrences?month=2026-12" -H "$AUTH"   # Arriendo 1300000
curl -s -X PATCH $API/recurring/$INT -H "$AUTH" -H "$JSON" -d '{"nextDueDate":"2026-12-20"}'
curl -s -X PATCH $API/recurring/$CEL -H "$AUTH" -H "$JSON" -d '{"nextDueDate":"2026-11-20"}'
```

**Esperado**: noviembre conserva Arriendo `paid` con 1200000; diciembre lo muestra con 1300000;
Internet vence el `2026-12-20` (`nextDueDate` del pago) y su noviembre pagado no cambia; el último
responde 400 con `nextDueDate: IN_PAST`.

## B6. Pausar y reanudar (historia 6; FR-005, FR-006)

```bash
GYM=$(curl -s $API/recurring -H "$AUTH" | node -pe 'JSON.parse(require("fs").readFileSync(0)).find(p=>p.name==="Gimnasio").id')
curl -s -X POST $API/recurring/$GYM/pause -H "$AUTH"
curl -s "$API/recurring/occurrences?month=2026-11" -H "$AUTH"   # Gimnasio sigue overdue
curl -s "$API/recurring/occurrences?month=2026-12" -H "$AUTH"   # sin Gimnasio
curl -s -X POST $API/recurring/$GYM/resume -H "$AUTH"
```

**Esperado**: al pausar, `status` `paused` y `nextDueDate` null; noviembre conserva Gimnasio
vencido y diciembre no lo tiene. Al reanudar hoy (23 nov, día 10 ya pasó) `nextDueDate` es
`2026-12-10` y noviembre no gana otra ocurrencia. Reanudar en otra fecha (con el día ya pasado o
no) se prueba en `recurring.e2e-spec.ts` con otro reloj.

## B7. Eliminar (historia 7; FR-007)

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $API/recurring/$GYM -H "$AUTH"
curl -s "$API/recurring/occurrences?month=2026-11" -H "$AUTH"
curl -s -X DELETE $API/occurrences/$(occ Arriendo)/payment -H "$AUTH"   # Arriendo no fue eliminado: 200
```

**Esperado**: 204; noviembre ya no tiene Gimnasio (estaba vencido, no pagado) y los totales bajan
a los de los demás; `GET /recurring/$GYM` da 404. Con un pago eliminado que tenía ocurrencias
pagadas, estas siguen en su mes con `paymentDeleted: true` y deshacerlas da 409
`RECURRING_DELETED` (en `occurrences.e2e-spec.ts`).

## B8. Inicio, aislamiento y concurrencia (FR-014, FR-021; SC-006, SC-007)

```bash
curl -s $API/summary -H "$AUTH" | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)).recurring.totals)'
pnpm --filter api test:e2e -- recurring occurrences recurring-isolation summary
```

**Esperado**: `summary.recurring` es la vista de `2026-11` (la misma de B3–B7) también sin
tarjetas; las e2e pasan: otro usuario recibe 404 en cada endpoint de pagos y ocurrencias y no ve
nada en su mes ni en su resumen; dos `GET` simultáneos del mismo mes no duplican ocurrencias;
ningún pago recurrente cambia el cupo ni los extractos de una tarjeta (SC-007).

## B9. Calidad

```bash
pnpm lint && pnpm format:check && pnpm typecheck
pnpm --filter api test && pnpm --filter api test:e2e
pnpm --filter mobile exec expo export --platform ios --platform android --output-dir /tmp/corte-export
```

**Esperado**: todo en verde y la app empaqueta en ambas plataformas.

## B10. App en iOS y Android (manual, historias 1 a 7; SC-003, SC-004, SC-008)

`pnpm --filter mobile start` con `EXPO_PUBLIC_API_URL` como en la spec 000, con los datos de B3.

1. **Barra inferior**: Inicio · Tarjetas · [Registrar compra] · Pagos · Perfil.
2. **Inicio**: debajo del resumen de tarjetas, "Pagos de noviembre" con "Nuevo", "Total del mes
   $1.480.000", "Pagado $1.295.000", "Faltan $185.000" y la lista Gimnasio (Vencido), Celular
   (Pendiente), Arriendo e Internet (Pagado). Cronometrar: saber cuánto falta y qué está vencido
   toma menos de 5 segundos sin tocar nada (SC-003).
3. **Marcar pagado**: tocar Celular → "Marcar pagado" → la hoja muestra $65.000; cambiar a $70.000
   y confirmar. El inicio muestra Pagado $1.365.000 y Faltan $120.000. Desde el inicio, marcar un
   pago toma menos de 10 segundos (SC-004). "Deshacer pago" lo devuelve a Pendiente.
4. **Pestaña Pagos**: ‹ y › recorren los meses; diciembre muestra los pagos activos como
   Pendientes; el botón › se deshabilita en noviembre de 2027 y ‹ en noviembre de 2026; el lector
   anuncia el mes nuevo.
5. **Mis pagos**: lista con "Mensual · día 1", montos y "Activo"/"Pausado". Crear "SOAT", anual,
   10 de marzo de 2027, en menos de 30 segundos (SC-004): aparece en marzo y no en otros meses.
6. **Editar**: subir Arriendo a $1.300.000 → noviembre (pagado) sigue en $1.200.000 y diciembre
   muestra $1.300.000.
7. **Pausar / reanudar / eliminar**: pausar Celular → diciembre ya no lo tiene; reanudarlo → vuelve
   desde su próximo vencimiento. Eliminar con la confirmación → desaparece de "Mis pagos" y de los
   meses siguientes; lo pagado sigue en su mes y su detalle dice "Este pago fue eliminado".
8. **Sin pagos / sin tarjetas**: con un usuario nuevo, el inicio muestra "Agrega tu primera
   tarjeta" y debajo "Agrega tus pagos fijos" con "Nuevo".
9. **Al día**: dejar la app abierta y volver otro día (o cambiar la zona horaria en Perfil): los
   estados se recalculan.
10. **Accesibilidad**: cada fila se lee "Gimnasio, 10 de noviembre, $120.000, vencido"; los estados
    se entienden sin color; todas las áreas táctiles ≥ 44; contraste AA.
11. **Android**: la hoja de pagar se abre y cierra con el gesto; montos `$1.480.000`.
