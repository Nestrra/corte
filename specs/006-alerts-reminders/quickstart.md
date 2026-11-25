# Quickstart / Guía de validación: spec 006

Cómo comprobar de punta a punta las alertas y los recordatorios. Contratos en
[contracts/](./contracts/), modelo en [data-model.md](./data-model.md) y decisiones en
[research.md](./research.md).

Los bloques B1 a B7 se validan con pruebas automáticas o con `curl` contra el API local. Las e2e
fijan el reloj y usan un cliente de Expo falso, así que no dependen de la fecha real ni de la red.
El bloque B9 lo valida Raúl a mano en iOS y Android con un **development build nuevo**: esta spec
sube `version` a `0.1.0` por la configuración del plugin `expo-notifications` (R14). Los push
remotos no funcionan en Expo Go.

## Preparación

```bash
pnpm install                         # trae expo-server-sdk y @nestjs/schedule (R16)
pnpm db:up
pnpm --filter api db:migrate         # aplica la migración notifications
pnpm --filter api dev                # terminal 1 (JOBS_ENABLED=true por defecto)
```

```bash
API=http://localhost:3000/api/v1
TOKEN=$(curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ana","email":"ana6@ejemplo.com","password":"clave-segura-1"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
AUTH="Authorization: Bearer $TOKEN"
JSON='Content-Type: application/json'
```

## B1. Dominio (R1, R2)

```bash
pnpm --filter @corte/domain test:cov
```

**Esperado**: pasan `notifications.test.ts` y `calendar.test.ts`:
- umbrales: 65 → 95 da una alerta del 90 y marca 70 y 90; 50 → 110 da la del 100; exactamente
  70 cuenta; uno ya avisado no se repite;
- fechas: 8 dic − 2 = 6 dic; N = 0; corte el 31 en febrero de 2027 → 26 feb; 1 ene − 2 = 30
  dic; corte el 20 y límite el 22 con N = 3 → 21;
- exclusiones: extracto pagado o en $0;
- textos exactos de [push-messages.md](./contracts/push-messages.md);
- push agrupado con "y 2 más".

La cobertura sigue ≥ 95% (SC-011).

## B2. Dispositivos (historia 9, FR-004 a FR-007)

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/devices -H "$AUTH" -H "$JSON" \
  -d '{"token":"ExponentPushToken[local-prueba-1]","platform":"ios"}'          # 204
curl -s -X POST $API/devices -H "$AUTH" -H "$JSON" -d '{"token":"abc","platform":"ios"}'
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $API/devices/current -H "$AUTH"   # 204
```

**Esperado**: 204; luego 400 `VALIDATION_ERROR` con `fields.token: INVALID_PUSH_TOKEN`; luego
204.

`devices.e2e-spec.ts` cubre además:
- el upsert del mismo token por otro usuario (el teléfono pasa a B);
- que `POST /auth/logout`, el cambio de contraseña (las otras sesiones), el restablecimiento por
  el administrador y `DELETE /me` quitan el destino;
- que una sesión expirada no recibe.

## B3. Alerta de tope (historia 2, criterio de la spec; FR-008 a FR-012, SC-001, SC-005, SC-006)

```bash
pnpm --filter api test:e2e -- budget-alerts
```

**Esperado**, con el reloj en `ALERTS_NOW` (`2026-11-25T15:00:00Z`, 25 nov en Bogotá), "Visa
principal" con corte el 8, tope de $2.000.000 y $1.300.000 en el extracto abierto:

- Registrar $600.000 a 1 cuota → **un** mensaje "Visa principal" / "Llevas el 95% del tope de
  este ciclo." a cada dispositivo activo; claves 70 y 90 en `notification_dispatches`.
- Otra compra que deja 102% → "Superaste el tope de este ciclo (102%)."; ninguna más después.
- Bajar a 60% y volver a 72% en el mismo ciclo → nada. El ciclo de enero → de nuevo la del 70%.
- Editar una compra de 65% a 80% → la del 70%. Borrar compras → nada.
- `FakePushClient` lanzando error → la compra responde 201 igual y la alerta está en `GET
  /notifications`.

A mano, con la terminal de la Preparación, después de registrar la compra:

```bash
curl -s $API/notifications -H "$AUTH"
```

**Esperado**: la alerta aparece en el historial aunque no haya un teléfono real registrado.

## B4. Recordatorios de tarjetas (historias 3 y 5; FR-013, FR-014, FR-017 a FR-020, SC-002 a SC-004)

```bash
pnpm --filter api test:e2e -- reminders
```

**Esperado** (America/Bogota, el reloj mutable mueve la hora y se llama `runOnce()`):

| Reloj (UTC) | Hora local | Resultado |
| --- | --- | --- |
| `2026-12-06T11:59Z` | 6:59 | nada |
| `2026-12-06T12:00Z` | 7:00 | "El corte es en 2 días (8 dic). Llevas $1.900.000 en este ciclo." |
| otra vez el mismo día | — | nada (un solo `daily_digest`) |
| `2026-12-07T12:00Z` | 7:00 | nada |
| `2026-12-22T12:00Z` | 7:00 | "Paga $1.950.000 hasta el 25 dic (faltan 3 días)." (si el extracto se pagó el 20: nada) |

- Con corte el 20, límite el 22 y N = 3 → el recordatorio llega el 21.
- Con $0 acumulado o la tarjeta archivada → nada.
- Un usuario en Europe/Madrid recibe a las 7:00 de Madrid.
- Dos recordatorios el mismo día → un push "Tienes 2 recordatorios hoy" y dos filas en el
  historial.
- Un `runOnce()` el día siguiente no envía lo del día anterior.

Prueba manual con el reloj real (opcional, con `JOBS_ENABLED=true`): crea una tarjeta cuyo día
de corte sea pasado mañana, con recordatorio de corte de 2 días y una compra en el ciclo. Antes
de 15 minutos después de la siguiente ejecución posterior a las 7:00 locales, `GET
/notifications` muestra el recordatorio de corte. Si ya pasó de las 7:00, aparece en la
siguiente ejecución.

## B5. Recordatorios de pagos recurrentes (historia 4; FR-015, FR-016)

```bash
curl -s -X POST $API/recurring -H "$AUTH" -H "$JSON" \
  -d '{"name":"Celular","amount":65000,"frequency":"monthly","firstDueDate":"2026-12-28","remindDays":16}'
curl -s -X POST $API/recurring -H "$AUTH" -H "$JSON" \
  -d '{"name":"Celular","amount":65000,"frequency":"monthly","firstDueDate":"2026-12-28"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).remindDays'
```

**Esperado**: el primero responde 400 con `fields.remindDays: OUT_OF_RANGE`; el segundo da `2`.
`firstDueDate` debe estar entre el 1.º del mes actual y hoy + 12 meses (spec 005).

`reminders.e2e-spec.ts` comprueba además:
- `2026-12-26T12:00Z` → "Celular" / "$65.000 vence el 28 dic (en 2 días)." aunque nadie abrió
  diciembre;
- pagada el 24 → nada;
- un pago pausado con la ocurrencia del periodo conservada → sí; un pago eliminado → nada;
- "SOAT" del 10 mar de 2027 con 15 días → el 23 feb.

## B6. Historial y prueba (historias 7 y 8; FR-023 a FR-025)

```bash
pnpm --filter api test:e2e -- notifications
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/notifications/test -H "$AUTH"
```

**Esperado**:
- e2e: el historial devuelve solo los últimos 30 días, de la más reciente a la más antigua, con
  un máximo de 200, y la limpieza borra las de más de 30 días.
- La prueba:
  - sin dispositivo → 409 `DEVICE_NOT_REGISTERED`;
  - con dispositivo → 202 `{ "sent": 1 }`, solo a los tokens de esta sesión;
  - una segunda prueba antes de 30 s → 429 `TEST_RATE_LIMITED` con `retryAfterSeconds`;
  - si Expo falla → 502 `PUSH_FAILED`;
  - nunca aparece en el historial.
- Con `curl` y un token inventado, Expo rechaza el envío, así que el 202 solo se ve en las e2e o
  con un teléfono real.

## B7. Receipts y limpieza (FR-007; R7, R8)

```bash
pnpm --filter api test:e2e -- push-receipts
```

**Esperado**:
- Un ticket con `DeviceNotRegistered` borra el dispositivo enseguida.
- Un receipt con `DeviceNotRegistered`, revisado 15 minutos después, también lo borra.
- Los tickets revisados o de más de 24 horas se borran, igual que los dispositivos cuya sesión
  ya no está activa.

## B8. Aislamiento y calidad (historia 10; FR-027, SC-007, SC-008)

```bash
pnpm --filter api test:e2e -- notifications-isolation
pnpm lint && pnpm typecheck && pnpm format:check
pnpm --filter api test && pnpm --filter api test:e2e
```

**Esperado**:
- Con dos usuarios, ninguna notificación de A llega a dispositivos de B ni aparece en su
  historial.
- `DELETE /devices/current` y `POST /notifications/test` de B no tocan los dispositivos de A.
- Los destinos de A (`/cards/:id`, `/statements/:id`, `/occurrences/:id`) responden 404 a B.
- Lint, tipos, formato, pruebas unitarias y todas las e2e pasan.

## B9. App en iOS y Android (manual, development build; historias 1 a 9)

Necesita las credenciales de push en EAS (README → "Credenciales de push") y un build nuevo de
`development` con `version` 0.1.0:

```bash
cd apps/mobile
npx eas-cli build --profile development --platform android
npx eas-cli build --profile development --platform ios
```

Con el build instalado, el API de staging o el local (`EXPO_PUBLIC_API_URL`) y `pnpm --filter
mobile start --clear`:

1. **Explicación** (historia 1): instala, crea una cuenta y comprueba que aparece "Activa las
   notificaciones". "Activar notificaciones" muestra el permiso del sistema; acéptalo y llegas
   al inicio. Cierra sesión y vuelve a entrar: no aparece de nuevo.
2. **Negar** (historia 1, escenarios 3, 5 y 6): en otro teléfono o reinstalando, niega el
   permiso. La app funciona igual; Perfil dice "Desactivadas" con "Abrir ajustes". Actívalo en
   los ajustes, vuelve a la app: dice "Activadas".
3. **Prueba** (historia 8): en Perfil toca "Enviar notificación de prueba". Llega "Corte / Las
   notificaciones funcionan." en menos de un minuto; un segundo toque espera 30 s.
4. **Alerta de tope** (historia 2): con una tarjeta de tope $2.000.000 y $1.300.000 en el ciclo,
   registra $600.000. Llega la alerta del 95% en menos de 1 minuto desde que tocas "Guardar"
   (mídelo con el reloj: SC-005). Al tocarla se abre el detalle de la tarjeta.
5. **Historial** (historia 7): toca la campana del inicio. Está la alerta con "Hoy, HH:MM";
   tocarla abre la tarjeta. Archiva la tarjeta y toca de nuevo: "Esto ya no está disponible".
6. **App cerrada** (historia 6, escenario 5): cierra la app por completo, envía una prueba desde
   el otro teléfono con la misma cuenta o espera un recordatorio. Al tocarlo, la app abre en el
   destino.
7. **Varios dispositivos** (historia 9): con la misma cuenta en dos teléfonos, una alerta llega a
   los dos. Cierra sesión en uno: deja de recibir y el otro sigue.
8. **Pagos recurrentes** (historia 4): crea un pago y comprueba "Recordar con anticipación" (2
   por defecto, de 0 a 15) y "Recordatorio: 2 días antes" en el detalle.
9. **Accesibilidad y diseño** (FR-029): con VoiceOver y TalkBack, cada fila del historial se lee
   como una frase. La campana, la fila de Perfil y los botones miden 44 o más. Los estados de
   Perfil están escritos.
