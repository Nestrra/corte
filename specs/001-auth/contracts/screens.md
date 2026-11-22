# Contrato de UI: pantallas y navegación

Textos en español; solo tokens de `docs/design-system.md` (principio IX); errores siempre con
texto (ver [errors.md](./errors.md)).

## Navegación (expo-router, `Stack.Protected`)

```text
estado de sesión            pantallas accesibles
restoring  →  splash (sin rutas)
offline    →  "Sin conexión con el servidor" + "Reintentar" (no borra la sesión)
signedOut  →  (auth)/login · (auth)/register
signedIn   →  (app)/home · profile · timezone · change-password · delete-account
signedIn + mustChangePassword  →  solo (app)/change-password (modo obligatorio)
```

La ruta `/` (`app/index.tsx`) no pertenece a ningún grupo y nunca está protegida: redirige a
`/home` con sesión y a `/login` sin ella. Los grupos no tienen `index` propio, así que sin esta ruta
`/` no resolvería al cerrar la sesión ("Unmatched Route").

Al expirar o revocarse la sesión, el estado pasa a `signedOut` y expo-router lleva a `login` con
el último email ya escrito y un aviso ("Tu sesión expiró…" / "Tu sesión se cerró…").

## Pantallas

| Ruta | Contenido | Acciones |
| --- | --- | --- |
| `(auth)/login` | Título "Corte", campos Email y Contraseña, aviso de sesión expirada si aplica | "Iniciar sesión" (primario); "Crear cuenta" (secundario) → register |
| `(auth)/register` | Campos Nombre, Email, Contraseña (ayuda: "Mínimo 8 caracteres") | "Crear cuenta" (primario); "Ya tengo cuenta" (secundario) → login |
| `(app)/home` | Saludo "Hola, {nombre}" y nota de que el inicio completo llega pronto | "Perfil" (secundario) |
| `(app)/profile` | Nombre, email, zona horaria actual | "Zona horaria" → timezone; "Cambiar contraseña" → change-password; "Cerrar sesión" (secundario); "Eliminar cuenta" (texto en `danger`) → delete-account |
| `(app)/timezone` | Lista curada con búsqueda; la zona actual marcada con texto "Actual" | Tocar una zona la guarda y vuelve al perfil |
| `(app)/change-password` | Modo obligatorio: aviso "Debes cambiar tu contraseña temporal", campos Nueva y Confirmación. Modo voluntario: además "Contraseña actual" | "Guardar contraseña" (primario); en modo obligatorio también "Cerrar sesión" |
| `(app)/delete-account` | Advertencia: "Esta acción es permanente. Se borrarán tu cuenta y todos tus datos." y campo Contraseña | "Eliminar mi cuenta" (primario con fondo `danger`); "Cancelar" (secundario) |

## Comportamiento de formularios

- Validación local con zod usando los límites de `@corte/domain` antes de enviar; errores del API
  mapeados por campo.
- Mientras se envía: botón con indicador de carga y deshabilitado.
- Si hay error, se conservan los datos escritos excepto las contraseñas (se vacían).
- `TextField`: etiqueta visible, alto ≥ 44, radio 12, borde `border` (en error: `danger` + texto
  del error debajo), `secureTextEntry` para contraseñas, `autoCapitalize="none"` y teclado de
  email para el email.
