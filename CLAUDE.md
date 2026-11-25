# Corte — contexto para Claude Code

App móvil para controlar tarjetas de crédito por ciclo de corte, compras a cuotas, extractos, simulador y pagos recurrentes. Uso personal y familiar. Se desarrolla con Spec-Driven Development (GitHub Spec Kit).

## Leer primero

- `.specify/memory/constitution.md` — reglas no negociables (9 principios). Prevalece sobre todo.
- `docs/mvp-spec.md` — producto, historias HU-01…HU-08, reglas de negocio y orden de specs.
- `docs/design-system.md` — tokens, componentes y pantallas. Toda la UI lo sigue.
- `specs/NNN-*/` — spec, plan, tasks y quickstart de cada funcionalidad.
- `README.md` — comandos, CI, imágenes y builds.

## Stack

Monorepo pnpm: `packages/domain` (TS puro, sin I/O, Vitest, cobertura ≥ 95 %), `apps/api` (NestJS + Prisma 7.10.1 fijado + PostgreSQL 17), `apps/mobile` (Expo + expo-router + TanStack Query + Zustand, EAS Build/Update). Node 24.

## Flujo de trabajo

- Spec Kit con guion: `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-analyze`, `/speckit-implement`.
- Una rama y un PR por spec (`NNN-nombre`). `main` está protegida: PR obligatorio y 4 checks (lint-typecheck, domain-test, api-e2e, docker-build). Merge con squash.
- Cambios de infraestructura o tooling van fuera de Spec Kit en ramas `chore/...`.
- Implementar por tramos: dominio → API (con e2e, incluidas las de aislamiento) → app. La app la valida Raúl a mano en iOS y Android (bloques B del quickstart).
- No hacer commit ni push si no se pidió; al terminar un tramo, resumir y esperar.
- Código, identificadores y commits en inglés (Conventional Commits). UI, specs y docs en español.

## Estado (actualizar al cerrar cada paso)

- Specs cerradas: 000 esqueleto, 001 auth, 002 tarjetas, 003 compras/cuotas/extractos, 004 inicio y simulador, 005 pagos recurrentes, 006 alertas y recordatorios.
- CI publica `ghcr.io/nestrra/corte-api` y `corte-migrate` (públicas) en cada push a `main`.
- Staging desplegado en el homelab: `https://corte-api-staging.nrcintelligence.io` (stack en el servidor `~/stacks/corte-staging`, se actualiza con `./deploy.sh`). Producción todavía no.
- EAS configurado (proyecto `@nestrra/corte`, perfiles development/preview/production en `apps/mobile/eas.json`).
- iOS declara cifrado exento (`ITSAppUsesNonExemptEncryption: false`).
- Credenciales de push cargadas en EAS (`googleServicesFile` desde la variable de archivo `GOOGLE_SERVICES_JSON`; `google-services.json` en `.gitignore`; clave FCM V1 y llave APNs). Pasos en el README, "Credenciales de push".
- Push (spec 006): app en `version` 0.1.0 con development builds de iOS y Android validados (B9). El API corre el job de notificaciones cada 15 minutos y debe ser una sola instancia (`JOBS_ENABLED`, README → "Alertas y recordatorios").
- Runtime version con política `appVersion` (`fingerprint` fallaba en EAS por el archivo secreto de `GOOGLE_SERVICES_JSON`).
- Siguiente: mergear el PR de la spec 006, desplegarla en staging y luego producción.

## Notas prácticas

- Local: `pnpm db:up`, `pnpm --filter api dev`, `pnpm --filter mobile start --clear` (con dev client instalado; `--go` para Expo Go).
- `apps/mobile/.env`: `http://localhost:3000` para iOS, `http://10.0.2.2:3000` para el emulador Android; reiniciar Metro con `--clear` al cambiarlo.
- Restablecer contraseña: `pnpm --filter api admin:reset-password <email>` (local, con el API arrancado) o `docker exec <contenedor> node dist/cli/reset-password.js <email>`.
- Runtime version = `version` de `apps/mobile/app.config.ts` (política `appVersion`). Todo cambio nativo (plugins, paquetes con código nativo, permisos, config nativa) exige subir `version` y hacer un build nuevo de EAS; si no, un `eas update` puede llegar a builds sin ese código nativo. Detalle en el README, "Versión de runtime".
- Intereses de cuotas: estimado simple con tasa EA de la tarjeta; el interés por días es v2.
