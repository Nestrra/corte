# Quickstart / Guía de validación: spec 003

Cómo comprobar de punta a punta compras, cuotas y extractos. Contratos en
[contracts/](./contracts/), modelo en [data-model.md](./data-model.md), decisiones en
[research.md](./research.md).

Las fechas de ejemplo suponen que **hoy es 23 de noviembre de 2026** en America/Bogota; con otra
fecha, los estados cambian según la tabla de data-model.md → Estado. Las e2e usan el reloj fijo
`2026-11-22T02:30:00Z` (hoy = 21 de noviembre en Bogotá) y no dependen de la fecha real.

## Preparación

```bash
pnpm install
pnpm db:up
pnpm --filter api db:migrate        # agrega annual_rate, purchases, installments y statements
pnpm --filter api dev               # terminal 1
```

```bash
API=http://localhost:3000/api/v1
TOKEN=$(curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ana","email":"ana3@ejemplo.com","password":"clave-segura-1"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
AUTH="Authorization: Bearer $TOKEN"
CARD=$(curl -s -X POST $API/cards -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Visa","color":"verde","cutoffDay":8,"dueDay":25,"creditLimit":5000000,"cycleBudget":2000000,"annualRate":24}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
```

## B1. Dominio (historia 1, FR-001 a FR-005)

```bash
pnpm --filter @corte/domain test:cov
```

**Esperado**: todo en verde y cobertura ≥ 95%. Incluye: $3.090.000 a 30 cuotas → 30 × $103.000;
$4.765.548 a 60 → 59 × $79.425 y la última $79.473; $1.200.000 a 12 al 24% EA → intereses
$21.705, $19.896, $18.088 … $1.809; corte 8 / pago 25 desde el 9 de noviembre de 2026 a 3 cuotas
→ cortes 2026-12-08, 2027-01-08, 2027-02-08 con límites 25; corte 31 desde el 15 de enero de 2027
→ 31 ene, 28 feb, 31 mar; propiedades para n = 1..72 (suma de abonos = valor; interés 0 con 1
cuota, sin intereses, tasa nula o 0); `rescheduleInstallments` y `statementStatus` con sus bordes; y los 6 casos reales del extracto de
Davivienda (research.md R12, SC-003): cada cuota indicada cae en el corte 2026-10-08 con su
abono (por ejemplo, $3.090.000 a 30 desde el 2026-06-13 → cuota 4, $103.000). La compra de
$520.000 a 35 da saldo $460.572 frente a $460.571 del banco: diferencia aceptada de $1.

## B2. Tasa de la tarjeta (historia 8, FR-006)

- La tarjeta creada en la preparación devuelve `annualRate: 24`, `totalDebt: 0` y
  `availableCredit: 5000000`.
- `PATCH /cards/$CARD {"annualRate":26.82}` → 200 con `26.82`. `{"annualRate":100.5}` → 400
  `annualRate/OUT_OF_RANGE`; `{"annualRate":26.825}` → 400 `annualRate/TOO_MANY_DECIMALS`;
  `{"annualRate":null}` → 200 con `null`. Dejarla en 24 para lo que sigue.

## B3. Registrar una compra (historia 2, FR-008 a FR-011)

```bash
curl -s -X POST $API/cards/$CARD/purchases -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"amount":1200000,"concept":" Nevera ","purchaseDate":"2026-11-09","installmentCount":12}'
```

**Esperado**: 201 con `concept: "Nevera"`, `annualRate: 24`, `noInterest: false` y 12 cuotas: la
1 con `cutoffDate: "2026-12-08"`, `dueDate: "2026-12-25"`, `principal: 100000`,
`interest: 21705` y `statementStatus: "open"`; la 12 con corte `2027-11-08` e interés 1809.

- Sin `purchaseDate` ni `installmentCount` → fecha de hoy y 1 cuota con interés 0.
- `amount: 0`, `concept: "  "`, `installmentCount: 73`, `purchaseDate` mañana o de hace 7 años →
  400 con el campo y el código de [errors.md](./contracts/errors.md).
- `GET /cards/$CARD` → `totalDebt` = suma de los valores registrados, `availableCredit` =
  5.000.000 − `totalDebt`, `cycleBudgetUsage` del corte 2026-12-08 con `amount` = "A pagar" de ese
  extracto y su `percent`.
- Una compra mayor que el cupo disponible se guarda igual (201) y `availableCredit` queda negativo.

## B4. Extractos (historia 3, FR-015 a FR-018)

```bash
curl -s $API/cards/$CARD/statements -H "$AUTH"
curl -s $API/statements/<id> -H "$AUTH"
```

**Esperado**: un extracto por corte usado, sin duplicados; cada uno con `total` = suma de abonos e
intereses de sus cuotas y `hasInterest`. El del 2026-12-08 está `open`. El detalle lista cada
cuota con `concept`, `number` y `purchaseInstallmentCount` ("1 de 12"). Orden: no pagados por corte
ascendente, luego pagados por corte descendente.

## B5. Compras con fecha pasada y extractos pagados (FR-030, FR-031)

- Registrar `{"amount":600000,"concept":"Viaje","purchaseDate":"2026-09-20","installmentCount":3}`
  → cuotas en los cortes 2026-10-08 (límite 2026-10-25, ya pasó), 2026-11-08 (límite 2026-11-25)
  y 2026-12-08. El de octubre se crea `paid` con `paidAt` = hoy y `paidAmount` = su total; el de
  noviembre queda `due`; el de diciembre ya existía y sigue `open`.
- `totalDebt` no incluye el abono de octubre.
- Registrar otra compra del 2026-09-25 → su primera cuota entra en el extracto de octubre, que
  sigue `paid` con el mismo `paidAmount`; su `total` sube y el detalle devuelve ambos valores.

## B6. Pagar y deshacer (historia 4, FR-019, FR-020)

- `POST /statements/<noviembre>/payment` → 200 `paid`, `paidAt` = hoy, `paidAmount` = total;
  `availableCredit` sube en la suma de sus abonos. Repetirlo → 200 sin cambios.
- `POST /statements/<diciembre>/payment` (abierto) → 409 `STATEMENT_OPEN`.
- `DELETE /statements/<noviembre>/payment` → 200 `due`, `paidAt` y `paidAmount` nulos; el cupo
  vuelve. Repetirlo → 200 sin cambios.

## B7. Editar y borrar (historia 6, FR-014, FR-022)

- `PATCH /purchases/<nevera> {"installmentCount":6}` → 6 cuotas de 200.000; los extractos de
  2027-06-08 a 2027-11-08 que solo tenían cuotas de esa compra desaparecen.
- `PATCH {"concept":"Nevera LG"}` → mismas cuotas (mismos `statementId`).
- Cambiar la tasa de la tarjeta a 30 y luego `PATCH {"amount":1500000}` → la compra conserva
  `annualRate: 24`.
- `DELETE /purchases/<nevera>` → 204; sus cuotas desaparecen y los extractos no pagados que
  quedan vacíos se borran; los pagados vacíos se conservan con `total: 0`.
- Archivar la tarjeta: `POST`, `PATCH` o `DELETE` de compras → 409 `CARD_ARCHIVED`; pagar y
  deshacer siguen funcionando. Restaurarla.

## B8. Cambio de fechas de la tarjeta (historia 7, FR-021)

- Con una compra del 2026-11-09 a 3 cuotas (cortes 8 de dic, ene y feb):
  `PATCH /cards/$CARD {"cutoffDay":15,"dueDay":2}` → sus cuotas pasan a 2026-12-15 (límite
  2027-01-02), 2027-01-15 (límite 2027-02-02) y 2027-02-15 (límite 2027-03-02); los extractos del 8
  que quedaron vacíos desaparecen.
- Los extractos con corte anterior a hoy (2026-10-08, 2026-11-08) conservan fechas, cuotas y
  estado.
- Cambiar solo `name`, `creditLimit` o `annualRate` no mueve cuotas.

## B9. Aislamiento (historia 9, FR-025)

Registrar a `beto3@ejemplo.com` y, con su token, pedir sobre los recursos de Ana: `GET` y `POST`
de `/cards/$CARD/purchases`, `GET`, `PATCH` y `DELETE` de `/purchases/<id>`,
`GET /cards/$CARD/statements`, `GET /statements/<id>` y `POST`/`DELETE` de
`/statements/<id>/payment` → 404 `NOT_FOUND` con el mismo cuerpo que
`GET /purchases/00000000-0000-0000-0000-000000000000` y que `GET /statements/no-es-uuid`. Los
datos de Ana no cambian.

## B10. Pruebas automáticas

```bash
pnpm --filter api test
pnpm --filter api test:e2e          # incluye purchases*, statements*, card-reschedule y aislamiento
```

## B11. App (iOS y Android, Expo Go)

`pnpm --filter mobile start` con `EXPO_PUBLIC_API_URL` como en la spec 000.

1. Editar una tarjeta: campo "Tasa de interés EA (%)" acepta "26,82"; el detalle muestra "Tasa:
   26,82% EA". Vacío → "Sin tasa".
2. Detalle de la tarjeta → "Registrar compra": fecha por defecto hoy, 1 cuota, "Sin intereses"
   apagado; con más de 1 cuota se ve "Se aplicará 26,82% EA (estimado)". El selector de fecha no
   deja elegir mañana. Guardar → confirmación con el extracto y la fecha de pago de la primera
   cuota.
3. Una compra mayor que el cupo disponible → aviso con el cupo; "Guardar" la guarda y el cupo se
   ve negativo con el texto "Superaste el cupo".
4. Carrusel y detalle muestran el cupo disponible real; el detalle, "Deuda total" y "Tope del
   ciclo: N% · $X de $Y", sin recargar (SC-005).
5. "Extractos": estados con texto (Abierto, Por pagar, Vencido, Pagado) y "estimado" junto a los
   totales con interés. Abrir uno → cuotas "k de n" con abono e interés (estimado).
6. Marcar pagado (con confirmación) y deshacer; el cupo cambia. En uno Abierto no aparece el botón.
7. "Compras" → detalle con su plan → Editar cuotas → el plan y los extractos cambian; Borrar (con
   confirmación) → desaparece.
8. Cambiar el corte de la tarjeta → los extractos abiertos muestran las fechas nuevas.
9. VoiceOver / TalkBack: StatusChip, StatementRow y el selector de fecha se leen con su texto.
   Contraste AA en los StatusChip y áreas táctiles ≥ 44 en filas, chips y DateField (SC-008).
10. Montos en Android con formato `$1.200.000` y negativos como `−$300.000`.

## B12. CI

En el PR, los 4 checks (`lint-typecheck`, `domain-test`, `api-e2e`, `docker-build`) en verde.
