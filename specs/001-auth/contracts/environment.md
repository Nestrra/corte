# Variables de entorno nuevas (API)

Se suman a las de `specs/000-project-skeleton/contracts/environment.md`.

| Variable | Obligatoria | Por defecto | Validación | Ejemplo local |
| --- | --- | --- | --- | --- |
| `JWT_SECRET` | Sí | — | Mínimo 32 caracteres. Con `APP_ENV=production`, se rechaza el valor de `.env.example` | `dev-only-change-me-0123456789abcdef` |
| `TRUST_PROXY` | No | `0` | Entero ≥ 0: saltos de proxy de confianza para tomar la IP de `X-Forwarded-For` | `0` |

- `JWT_SECRET` firma los access tokens; cambiarlo invalida todos los access tokens vigentes (los
  refresh tokens siguen sirviendo y emiten tokens nuevos). En producción se genera con, por
  ejemplo, `openssl rand -base64 48` y se entrega solo por entorno.
- Duraciones fijas (no configurables): access token 15 min; sesión 30 días de inactividad.
- E2e: las pruebas fijan su propio `JWT_SECRET` de prueba.
