# Quickstart / Guía de validación: spec 002

Cómo comprobar de punta a punta las tarjetas y las reglas de ciclo. Contratos en
[contracts/](./contracts/), modelo en [data-model.md](./data-model.md).

## Preparación

```bash
pnpm install
pnpm db:up
pnpm --filter api db:migrate        # crea cards en corte_dev
pnpm --filter api dev               # terminal 1
```

```bash
API=http://localhost:3000/api/v1
# Registrar (o iniciar sesión) y guardar el access token
TOKEN=$(curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ana","email":"ana@ejemplo.com","password":"clave-segura-1"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
AUTH="Authorization: Bearer $TOKEN"
```

## B1. Dominio (US1, FR-008, FR-009)

```bash
pnpm --filter @corte/domain test:cov
```

**Esperado**: todo en verde y cobertura ≥ 95% en líneas, ramas, funciones y sentencias. Incluye los
casos de la historia 1 (corte 8 / pago 25 con compras del 8 y del 9 de noviembre, corte 31 en
febrero de 2027 y 2028, cambio de año) y la comparación exhaustiva contra la implementación de
referencia (R2). Si se baja un umbral de cobertura a propósito (por ejemplo, borrando una prueba),
el comando falla.

## B2. Crear y listar (US2, US3)

```bash
curl -s -X POST $API/cards -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":" Visa principal ","color":"petroleo","last4":"4821","cutoffDay":8,"dueDay":25,"creditLimit":5000000,"cycleBudget":2000000}'
curl -s $API/cards -H "$AUTH"
```

**Esperado**: 201 con `name: "Visa principal"`, `remindCutoffDays: 2`, `remindDueDays: 3`,
`availableCredit: 5000000`, `archivedAt: null`. La lista devuelve la tarjeta. Con `cutoffDay: 32`,
`last4: "48a1"`, `creditLimit: 0` o `cycleBudget` mayor que `creditLimit` → 400 con el campo y el
código de [errors.md](./contracts/errors.md).

## B3. Detalle con ciclo (US4)

```bash
curl -s $API/cards/<id> -H "$AUTH"
```

**Esperado**: `cycle.today` es la fecha de hoy en America/Bogota; con corte 8 y pago 25,
`nextCutoff` es el próximo día 8 (hoy si hoy es 8) y `nextCutoffDue` el 25 de ese mismo mes. Cambiar
la zona con `PATCH /me {"timezone":"Pacific/Honolulu"}` y repetir cerca de la medianoche de Bogotá:
`today` cambia según la zona.

## B4. Editar (US5)

- `PATCH /cards/<id> {"cutoffDay":15}` → 200; el detalle muestra el próximo corte con día 15.
- `PATCH {"cycleBudget":9000000}` (mayor que el cupo guardado) → 400 `EXCEEDS_CREDIT_LIMIT`.
- `PATCH {"last4":null}` → 200 con `last4: null`.

## B5. Archivar y restaurar (US6)

- `POST /cards/<id>/archive` → 200 con `archivedAt`; `GET /cards` ya no la lista;
  `GET /cards?archived=true` sí. Repetir el archivado → 200 sin cambios.
- `PATCH /cards/<id>` estando archivada → 409 `CARD_ARCHIVED`.
- `POST /cards/<id>/restore` → 200 con `archivedAt: null`; vuelve a `GET /cards` con los mismos
  datos.

## B6. Aislamiento (US7)

Registrar un segundo usuario (`beto@ejemplo.com`) y, con su token, pedir `GET`, `PATCH`,
`archive` y `restore` sobre la tarjeta de Ana → 404 `NOT_FOUND`, con el mismo cuerpo que
`GET /cards/00000000-0000-0000-0000-000000000000` y que `GET /cards/no-es-uuid`. Su `GET /cards` y
`GET /cards?archived=true` vienen vacíos. La tarjeta de Ana no cambia.

## B7. Pruebas automáticas

```bash
pnpm --filter api test
pnpm --filter api test:e2e          # incluye cards*.e2e-spec.ts y el aislamiento de tarjetas
```

## B8. App (iOS y Android, Expo Go)

`pnpm --filter mobile start` con `EXPO_PUBLIC_API_URL` como en la spec 000.

1. Con sesión: barra inferior con Inicio, Tarjetas y Perfil; la activa se distingue por texto en
   negrita además del color. Perfil funciona como en la spec 001 (zona horaria, cambio de
   contraseña, eliminar cuenta, cerrar sesión).
2. Tarjetas sin tarjetas → estado vacío y "Agregar tarjeta".
3. Agregar "Visa principal", petróleo, 4821, corte 8, pago 25, cupo 5000000, tope 2000000 →
   aparece en el carrusel con "**** 4821", "$5.000.000" y "Corte día 8 · Pago día 25".
   **Comprobar en Android** que el monto se ve como `$5.000.000` (R4).
4. Agregar una segunda tarjeta → el carrusel avanza de a una, deja ver el borde de la siguiente y
   los puntos indican la posición.
5. Tocar la tarjeta → detalle con el próximo corte, su fecha límite y "faltan N días" / "Hoy" /
   "Mañana", coherentes con el calendario. Cambiar la zona horaria en Perfil a una con otra fecha
   (por ejemplo Pacific/Kiritimati de noche en Bogotá) y volver → el detalle se recalcula.
6. Editar el corte a 15 → el carrusel y el detalle lo reflejan. Probar un tope mayor que el cupo →
   error en el campo.
7. Archivar (con confirmación) → desaparece del carrusel y aparece "Archivadas (1)"; abrirla →
   solo lectura con "Restaurar"; restaurar → vuelve al carrusel.
8. Selector de color con VoiceOver / TalkBack: anuncia el nombre del color y si está seleccionado.
9. Con la contraseña temporal pendiente (spec 001) no se ven las pestañas, solo el cambio de
   contraseña.

## B9. CI

En el PR, los 4 checks (`lint-typecheck`, `domain-test`, `api-e2e`, `docker-build`) en verde;
`domain-test` falla si la cobertura del dominio baja de 95%.
