# Research: Tarjetas y dominio de ciclos

Fase 0 de [plan.md](./plan.md). Las decisiones de stack vienen del usuario; aquí se concretan y se
registran los puntos delicados. Consultado el 2026-11-21: `facebook/hermes/doc/IntlAPIs.md`, tipos
de `expo-router` 58.0.32 (`Tabs`, `tabBar`) y una sonda ejecutada en Expo Go (Hermes) en el
simulador de iOS 18.

## R1. Fechas del dominio: strings ISO y aritmética propia

- **Decision**: la API pública del dominio usa fechas calendario como strings `'YYYY-MM-DD'`
  (tipo `IsoDate`). Internamente se convierten a `{ year, month, day }` y se opera con aritmética
  propia: años bisiestos, días del mes, sumar meses y un número de día absoluto (algoritmo
  "days from civil") para comparar y restar fechas. Sin `Date`, sin `Temporal` (Hermes no lo
  soporta) y sin librerías de fechas.
- **Rationale**: los strings ISO viajan tal cual en el JSON del API, se ordenan lexicográficamente y
  son legibles en las pruebas. Sin `Date` no hay horas ni zonas que corran el día (principio IV).
- **Alternatives considered**: `Date` en UTC (funciona, pero invita a mezclar horas y zonas);
  date-fns / dayjs (dependencia extra para unas pocas operaciones); `Temporal` (sin soporte en
  Hermes).

## R2. Reglas de ciclo (FR-001 a FR-005)

Con `clamp(año, mes, día)` = ese día del mes o el último día si el mes no lo tiene:

- **Corte de un mes**: `clamp(año, mes, díaCorte)`.
- **Corte de una fecha (FR-002)**: si `fecha <= corte del mes de la fecha`, ese corte; si no, el
  corte del mes siguiente. Equivale a "el primer corte igual o posterior a la fecha".
- **Fecha límite de un corte (FR-003)**: `clamp(mes del corte, díaLímite)` si es posterior al
  corte; si no, `clamp(mes siguiente, díaLímite)`. Coincide con la regla 2 del MVP salvo en el
  borde del ajuste de fin de mes (spec, Supuestos).
- **Próximo corte (FR-004)**: el corte de "hoy" según FR-002, con su fecha límite.
- **Próxima fecha límite (FR-005)**: la fecha límite del corte anterior a hoy si es igual o
  posterior a hoy; si no, la del próximo corte. El corte anterior es el corte del mes anterior al
  del próximo corte.
- **Pruebas**: además de los casos fijos de FR-008, una prueba exhaustiva compara el dominio con
  una implementación de referencia ingenua escrita en la prueba (recorre los días uno a uno con
  `Date.UTC`) para todos los días de corte y límite 1–31 y todas las fechas de 2027 y 2028 (año
  bisiesto). La prueba puede usar `Date`; el código del dominio no.

## R3. "Hoy" en la zona del usuario (fuera del dominio)

- **Decision**: "hoy" se calcula fuera del dominio con
  `new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)`
  y se arma `YYYY-MM-DD` con las partes `year`, `month` y `day`. Entra al dominio como parámetro.
- **Reloj inyectable**: el API lee la hora de un proveedor `Clock` (`src/common/clock.ts`, por
  defecto `new Date()`). Las e2e lo fijan en `2026-11-22T02:30:00Z` para afirmar fechas exactas
  (Bogotá 21, Madrid 22) sin depender de la hora real ni fallar cerca de la medianoche.
- **Dónde**: en el API (`src/common/today.ts`), que calcula el ciclo del detalle con el reloj del
  servidor y la zona del usuario. La app no lo necesita en esta spec: recibe `today` y las fechas
  del API y solo calcula los días restantes con el dominio (ver R7).
- **Verificación en Hermes (iOS)**: la sonda dio `month=11, day=21, year=2026` para Bogotá y
  `day=22` para Madrid en el mismo instante (UTC 2026-11-22 02:30), y `RangeError` para una zona
  inválida. Node 24 da lo mismo. La documentación de Hermes lista `Intl.DateTimeFormat` como
  soportado en ambas plataformas y no documenta limitaciones de `timeZone`. Android queda por
  verificar en el quickstart (B8); el emulador no completó la sonda.

## R4. Montos en pesos (FR-024)

- **Decision**: `formatCop(amount)` = `'$' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amount)`
  → `$5.000.000`. Se usa el estilo decimal y se antepone `$` en vez de `style: 'currency'`.
- **Rationale**: con `style: 'currency'` la salida es `$ 5.000.000`, con espacio duro, y el
  símbolo y el espacio dependen de los datos de la plataforma (iOS y el ICU de Android). El estilo
  decimal da el mismo resultado en Node y en Hermes iOS (`1.000`, `5.000.000`, `9.999.999.999`;
  verificado con la sonda) y coincide con el ejemplo de la spec.
- **Hermes**: `Intl.NumberFormat` está "Supported on both platforms". Las limitaciones
  documentadas son `notation`, `compactDisplay`, `signDisplay` y `style: 'unit'`, que no se usan.
  En Android la salida depende del ICU de la versión de Android; se verifica en el quickstart (B8).
- **Entrada de montos**: el campo acepta solo dígitos (teclado numérico), muestra el valor
  formateado al salir del campo y envía un entero.

## R5. Montos en el API: BIGINT ↔ number

- **Decision**: columnas `BIGINT` en PostgreSQL (`BigInt` en Prisma). En el JSON los montos viajan
  como `number` entero. El mapper convierte `bigint → number` con una verificación
  (`Number.isSafeInteger`, error 500 si no se cumple) y `number → bigint` al guardar. El máximo de
  la spec ($9.999.999.999) es mucho menor que `Number.MAX_SAFE_INTEGER` (≈ 9 × 10¹⁵).
- **Alternatives considered**: montos como string en el JSON (más seguro para valores enormes,
  pero obliga a parsear en la app sin necesidad para estos rangos).

## R6. Modelo y restricciones

- **Decision**: modelo `Card` con `color` como enum `CardColor` de las 6 claves y montos `BigInt`.
  Las restricciones de rango se validan en el API (zod con las reglas del dominio) y además se
  declaran como `CHECK` a mano en la migración, como el `CHECK` del email en la spec 001: días
  1–31, recordatorios 0–15, montos entre 1 y 9.999.999.999, tope ≤ cupo, `last4` de 4 dígitos y
  nombre de 1 a 40 caracteres.
- **Índice**: `(user_id, archived_at, created_at)` para listar activas o archivadas en orden.

## R7. Endpoints y ciclo en el detalle

- **Decision**: `GET /cards` (activas), `GET /cards?archived=true` (archivadas), `POST /cards`,
  `GET /cards/:id`, `PATCH /cards/:id`, `POST /cards/:id/archive`, `POST /cards/:id/restore`
  ([contracts/cards.openapi.yaml](./contracts/cards.openapi.yaml)).
- `GET /cards/:id` incluye `cycle: { today, nextCutoff, nextCutoffDue, nextDue }`, calculado con el
  dominio, el reloj del servidor y la zona del usuario. La app muestra `nextCutoff` y
  `nextCutoffDue` (spec, historia 4) y calcula los días restantes con `daysBetween(today, fecha)`
  del dominio. `nextDue` (FR-005) queda disponible para las specs siguientes.
- **Ajuste a la spec**: FR-023 decía "la fecha actual del dispositivo"; pasa a "la fecha actual en
  la zona horaria del usuario", que da el API. Así la app y el API no pueden mostrar días
  distintos si el reloj del teléfono está mal.
- **Archivar y restaurar**: idempotentes (archivar una archivada o restaurar una activa responde
  200 sin cambios). `PATCH` sobre una archivada → 409 `CARD_ARCHIVED`.
- **Aislamiento**: toda consulta lleva `where: { id, userId }`. Una tarjeta inexistente, de otro
  usuario o con un id que no es UUID responde 404 `NOT_FOUND` con el mismo cuerpo (FR-018); el id
  se valida antes de consultar para no producir un 500.
- **PATCH parcial**: acepta cualquier subconjunto de campos; el tope se valida contra el cupo
  resultante (el enviado o el guardado). `last4: null` borra los últimos 4.

## R8. Navegación con pestañas

- **Decision**: grupo `(app)/(tabs)` con `Tabs` de expo-router y una `tabBar` propia
  (`components/TabBar.tsx`) con los tokens del sistema de diseño: tres pestañas (Inicio, Tarjetas,
  Perfil), ícono y etiqueta (`tab` / `tabActive`), activa en `primary` y con peso 600, área táctil
  ≥ 44. El botón central y Pagos se agregan en specs posteriores sin cambiar la estructura.
- Rutas: `(tabs)/home`, `(tabs)/cards`, `(tabs)/profile`. Las pantallas apiladas viven en el Stack
  de `(app)`: `card/new`, `card/[id]/index`, `card/[id]/edit`, `card/archived`, `timezone`,
  `delete-account` y `change-password`. Se usa el prefijo `card/` (singular) para que `/cards` (la
  pestaña) no choque con las rutas apiladas.
- El `Stack.Protected guard={!mustChangePassword}` de `(app)` envuelve `(tabs)` y las pantallas de
  tarjetas; `change-password` sigue fuera (spec 001). `anchor` de `(app)` = `(tabs)`. La ruta `/`
  sigue redirigiendo a `/home`.
- **Íconos**: `@expo/vector-icons` (Ionicons), dependencia nueva. Expo 58 ya no la trae como
  dependencia de `expo`. Es JS más fuentes, funciona en Expo Go y no agrega código nativo.
  Alternativa descartada: `expo-symbols`, que usa los símbolos de cada plataforma y daría íconos
  distintos en iOS y Android.

## R9. Carrusel

- **Decision**: `FlatList` horizontal con `snapToInterval` = ancho de tarjeta (300) + separación
  (12), `decelerationRate="fast"`, margen lateral de pantalla (20) para dejar ver la siguiente
  tarjeta, e indicador de puntos según `onMomentumScrollEnd`. Cada tarjeta es un `Pressable` con
  `accessibilityLabel` que lee nombre, últimos 4, cupo y días de corte y pago.

## R10. Formulario y selector de color

- **Decision**: `react-hook-form` + `zod` con las reglas de `@corte/domain` (mismas que el API,
  FR-011). Un esquema compartido por crear y editar. Selector de color como radio group:
  contenedor con `accessibilityRole="radiogroup"` y cada opción con `accessibilityRole="radio"`,
  `accessibilityState={{ checked }}`, nombre accesible (Índigo, Petróleo, …), tamaño ≥ 44 y la
  elegida marcada con un borde y un ícono de check (no solo color).

## R11. Cobertura del dominio ≥ 95% (FR-009)

- **Decision**: `coverage.thresholds` en `packages/domain/vitest.config.mts` con `lines`,
  `branches`, `functions` y `statements` en 95. `test:cov` falla si no se alcanza y el job
  `domain-test` de la CI ya ejecuta `test:cov`, así que no cambia el workflow.
