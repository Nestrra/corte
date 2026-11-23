# Spec MVP — Corte: tarjetas de crédito y pagos recurrentes

Documento de referencia del producto. Las specs de Spec Kit (`specs/NNN-*`) lo citan por historia (HU-01…HU-08).
Si una spec o la constitución lo contradicen, ganan ellas.

## Visión

App móvil multiusuario que dice, para cada tarjeta de crédito, cuánto hay que pagar, en qué fecha y en qué extracto cae una compra nueva. También lleva el control de los pagos recurrentes del mes.

El problema: con corte el 8 y pago el 25, una compra del día 9 se paga 46 días después y una del día 8 solo 17. Con varias tarjetas y compras a cuotas se pierde la cuenta, aparecen intereses o se olvida un pago fijo.

El objetivo del MVP es que el usuario nunca pague tarde ni se pase de su tope sin enterarse.

## Alcance

El MVP cubre tarjetas, compras a cuotas, extractos, alertas y pagos recurrentes como módulo aparte. El bolsillo queda para la v2.

**Entra en el MVP**

- Registro, login con JWT (access + refresh) y eliminación de cuenta desde la app (exigida por App Store).
- Varias tarjetas por usuario, cada una con nombre, color, día de corte, día límite, cupo y tope por ciclo.
- Registro de compras con valor, concepto, fecha, número de cuotas y tasa opcional.
- Extractos por tarjeta calculados automáticamente, con opción de marcarlos como pagados.
- Simulador "si compro hoy": en qué extracto cae, cuándo se paga y el plan de cuotas.
- Alertas push al 70%, 90% y 100% del tope y recordatorios antes del corte y de la fecha límite.
- Pagos recurrentes: crear, marcar pagado, pausar, reanudar y eliminar, con recordatorio.
- Pantalla de inicio con el resumen de todas las tarjetas y los pagos recurrentes próximos (ver `docs/design-system.md`).

**Fuera del MVP (v2 o después)**

- Saldo del bolsillo y si cubre el próximo extracto.
- Pagos recurrentes cargados a una tarjeta.
- Compras en dólares, avances, pago mínimo e intereses por mora.
- Login con Google o Apple, estadísticas y categorías avanzadas.
- Importar extractos o leer notificaciones del banco.
- Ajustar las fechas de corte y de pago por fines de semana y festivos de Colombia.

## Historias de usuario

| ID | Historia | Criterios de aceptación |
| --- | --- | --- |
| HU-01 | Como usuario quiero registrarme, iniciar sesión y borrar mi cuenta. | Email único y contraseña de mínimo 8 caracteres. La sesión se renueva sola con el refresh token. Borrar la cuenta elimina todos sus datos. |
| HU-02 | Como usuario quiero registrar varias tarjetas con su corte, fecha límite, cupo y tope. | Los días van de 1 a 31. Puedo editar y archivar una tarjeta. Cambiar las fechas solo afecta los extractos que no han cerrado. |
| HU-03 | Como usuario quiero registrar una compra con valor, concepto, fecha y cuotas. | La fecha por defecto es hoy y las cuotas por defecto son 1. Al guardar, veo en qué extracto cae la primera cuota y cuándo se paga. |
| HU-04 | Como usuario quiero ver los extractos de cada tarjeta con su total y fecha límite. | Cada extracto lista sus cuotas y su estado: abierto, por pagar, pagado o vencido. Puedo marcarlo como pagado y deshacerlo. |
| HU-05 | Como usuario quiero simular una compra antes de hacerla. | Ingreso valor, fecha y cuotas, y veo el extracto donde cae, la fecha de pago, el plan de cuotas y el % del tope que quedaría usado. |
| HU-06 | Como usuario quiero que me avisen si me acerco a mi tope o si se acerca un corte o un pago. | Recibo un push al pasar el 70%, el 90% y el 100% del tope, una vez por umbral y ciclo. Recibo recordatorios N días antes del corte y de la fecha límite. |
| HU-07 | Como usuario quiero llevar mis pagos recurrentes. | Creo un pago con nombre, monto, frecuencia y día de vencimiento. Cada periodo aparece como Pendiente y puedo marcarlo pagado, pausar el pago o eliminarlo. |
| HU-08 | Como usuario quiero un inicio con el resumen de todo. | Por tarjeta veo lo acumulado en el ciclo, el % del tope, los días al corte y el próximo pago. También veo los recurrentes del mes con total y pagado. |

## Reglas de negocio

Toda la lógica de fechas y montos vive en `packages/domain` (constitución, principio I).

**Ciclos y extractos**

1. Una compra con día de fecha menor o igual al día de corte entra en el corte de ese mes. Si es mayor, entra en el corte del mes siguiente.
2. Si el día límite es mayor que el día de corte, la fecha límite cae en el mismo mes del corte. Si no, cae en el mes siguiente.
3. Si el día configurado no existe en el mes (31 en febrero), se usa el último día del mes.
4. Los extractos se guardan en la base (corte, fecha límite, estado) y se crean a medida que una cuota los necesita.
5. Estados: **abierto** antes del corte, **por pagar** entre el corte y la fecha límite, **pagado** cuando el usuario lo marca y **vencido** si pasa la fecha límite sin pagar.
6. Si el usuario cambia las fechas de una tarjeta, los extractos abiertos se recalculan y sus cuotas se reasignan. Los extractos cerrados no cambian.

**Cuotas**

1. La cuota k de una compra (k = 1..n) cae en el extracto que está k − 1 ciclos después del de la compra.
2. Abono a capital = floor(valor / n) (sin decimales, hacia abajo). El residuo se suma a la última cuota, así la suma de los abonos es exactamente el valor (spec 003, confirmado con un extracto real de Davivienda).
3. Interés de la cuota k = saldo de capital antes de la cuota × tasa mensual. Con tasa 0 (o a 1 cuota) no hay interés.
4. La tasa se ingresa efectiva anual y se convierte a mensual con EM = (1 + EA)^(1/12) − 1. La app la muestra como **estimado**: el banco liquida por días.
5. Los montos se guardan como enteros en pesos colombianos (COP).

**Cupo, tope y alertas**

1. Uso del tope = suma de las cuotas del extracto abierto ÷ tope del ciclo.
2. Cupo disponible = cupo − capital pendiente de todas las cuotas no pagadas.
3. Al registrar una compra, el API calcula el uso del tope y envía un push por cada umbral cruzado (70%, 90%, 100%), una sola vez por umbral y ciclo.
4. Si una compra supera el cupo disponible, la app avisa pero deja guardarla.
5. Un job diario a las 7:00 en la zona del usuario envía los recordatorios: N días antes del corte (por defecto 2) y antes de la fecha límite (por defecto 3), con el monto exacto.

**Pagos recurrentes**

1. Son un módulo aparte y no suman al total de ninguna tarjeta.
2. Frecuencias del MVP: mensual y anual.
3. Cada periodo genera una ocurrencia con estado Pendiente. Al marcarla pagada se puede registrar el monto real.
4. Pausar detiene la creación de ocurrencias nuevas. Eliminar borra el pago y sus ocurrencias futuras, pero conserva el historial pagado.
5. Una ocurrencia pendiente con fecha pasada se muestra como vencida.

Todas las fechas se calculan en la zona horaria del usuario (por defecto America/Bogota).

## Modelo de datos (orientativo)

Cada spec define su parte en su `data-model.md`; esta tabla es la visión de conjunto.

| Tabla | Campos clave | Notas |
| --- | --- | --- |
| `users` | id, name, email, password_hash, timezone, created_at | Hash con argon2. Al borrar la cuenta se borra todo en cascada. |
| `refresh_tokens` | id, user_id, token_hash, expires_at, revoked_at | Rotación en cada refresh. |
| `devices` | id, user_id, expo_push_token, platform | Un usuario puede tener varios dispositivos. |
| `cards` | id, user_id, name, color, last4, cutoff_day, due_day, credit_limit, cycle_budget, remind_cutoff_days, remind_due_days, archived_at | `color` es una clave de `cardColors`; `last4` es opcional. |
| `statements` | id, card_id, cutoff_date, due_date, paid_at, paid_amount | Único por (card_id, cutoff_date). `paid_at` es DATE (fecha de negocio); el estado se deriva de las fechas. |
| `purchases` | id, card_id, amount, concept, purchase_date, installment_count, no_interest, annual_rate | `annual_rate` es la tasa de la tarjeta al registrar (nula si no tiene). |
| `installments` | id, purchase_id, statement_id, number, principal, interest | La suma de los principal da el valor de la compra. |
| `alert_logs` | id, card_id, statement_id, kind, threshold, sent_at | Evita repetir un aviso en el mismo ciclo. |
| `recurring_payments` | id, user_id, name, amount, frequency, due_day, due_month, remind_days, paused_at | `due_month` solo aplica a la frecuencia anual. |
| `recurring_occurrences` | id, recurring_payment_id, due_date, status, paid_at, paid_amount | Estados: pending o paid. Vencida se deriva de la fecha. |

## API REST (orientativa)

Todo bajo `/api/v1`; salvo auth y health, pide JWT. Cada consulta filtra por el usuario del token.

| Método | Ruta | Qué hace |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login` | Crea la cuenta o inicia sesión y devuelve access y refresh token. |
| POST | `/auth/refresh`, `/auth/logout` | Rota el refresh token o lo revoca. |
| GET / PATCH / DELETE | `/me` | Perfil, zona horaria y eliminación de la cuenta. |
| POST / DELETE | `/devices`, `/devices/:id` | Registra o quita un token de push de Expo. |
| GET / POST | `/cards` | Lista o crea tarjetas. |
| GET / PATCH / DELETE | `/cards/:id` | Detalle, edición (recalcula extractos abiertos) o archivado. |
| POST | `/cards/:id/simulate` | Devuelve extracto, fecha de pago, plan de cuotas y % del tope. No guarda nada. |
| GET / POST | `/cards/:id/purchases` | Lista compras o registra una y genera sus cuotas. |
| GET / PATCH / DELETE | `/purchases/:id` | Detalle con el plan de cuotas, edición o borrado de una compra y sus cuotas. |
| GET | `/cards/:id/statements` | Extractos de la tarjeta con su total y estado. |
| GET | `/statements/:id` | Extracto con el detalle de cuotas. |
| POST / DELETE | `/statements/:id/payment` | Marca el extracto como pagado o lo deshace. |
| GET | `/summary` | Datos del inicio. |
| GET / POST | `/recurring` | Lista o crea pagos recurrentes. |
| PATCH / DELETE | `/recurring/:id` | Edita o elimina un pago recurrente. |
| POST | `/recurring/:id/pause`, `/recurring/:id/resume` | Pausa o reanuda. |
| GET | `/recurring/occurrences?from&to` | Ocurrencias en un rango de fechas. |
| POST / DELETE | `/occurrences/:id/payment` | Marca la ocurrencia como pagada o lo deshace. |

## Orden de specs

1. **000 — Esqueleto** (cerrada): monorepo, CI, health check, tema y pantalla de conexión.
2. **001 — Auth** (cerrada): HU-01.
3. **002 — Tarjetas y dominio de ciclos** (cerrada): HU-02.
4. **003 — Compras, cuotas y extractos** (cerrada): HU-03 y HU-04.
5. **004 — Simulador e inicio:** HU-05 y HU-08.
6. **005 — Alertas y recordatorios:** HU-06.
7. **006 — Pagos recurrentes:** HU-07.

La infraestructura del homelab (stacks, túnel, secretos, respaldos, deploy) va fuera de Spec Kit.

## Decisiones

- Nombre: **Corte**.
- Recuperar contraseña: sin email en el MVP; el administrador la restablece con un comando en el servidor.
- Registro abierto, sin código de invitación.
- Liquidación de cuotas confirmada con un extracto real de Davivienda (spec 003): abono fijo a capital con el residuo en la última cuota e interés sobre saldo; la app muestra el interés como estimado.
- Pendiente: estrategia de despliegue a producción y publicación en tiendas.
