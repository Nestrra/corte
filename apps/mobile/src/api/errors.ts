/** Error codes of contracts/errors.md. */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'INVALID_PASSWORD'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'EMAIL_TAKEN'
  | 'SAME_PASSWORD'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export interface FieldError {
  field: string;
  code: string;
}

/** The API answered with an error body `{ statusCode, code, message, errors? }`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors: FieldError[];

  constructor(status: number, code: ApiErrorCode, fieldErrors: FieldError[] = []) {
    super(`API error ${status} ${code}`);
    // Keeps `instanceof` working when classes extending Error are transpiled.
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/** No answer from the API (offline, timeout, unreachable host or missing configuration). */
export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    Object.setPrototypeOf(this, NetworkError.prototype);
    this.name = 'NetworkError';
  }
}

export const NETWORK_ERROR_TEXT =
  'No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.';

const GENERIC_ERROR_TEXT = 'Algo salió mal. Inténtalo de nuevo.';

const codeTexts: Partial<Record<ApiErrorCode, string>> = {
  INVALID_CREDENTIALS: 'Email o contraseña incorrectos',
  SESSION_EXPIRED: 'Tu sesión expiró. Inicia sesión de nuevo.',
  SESSION_REVOKED: 'Tu sesión se cerró. Inicia sesión de nuevo.',
  INVALID_PASSWORD: 'La contraseña no es correcta',
  EMAIL_TAKEN: 'Ya existe una cuenta con ese email',
  SAME_PASSWORD: 'La contraseña nueva debe ser distinta de la actual',
  RATE_LIMITED: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
};

/** Spanish text for any error thrown by the API client. */
export function errorText(error: unknown): string {
  if (error instanceof NetworkError) return NETWORK_ERROR_TEXT;
  if (error instanceof ApiError) return codeTexts[error.code] ?? GENERIC_ERROR_TEXT;
  return GENERIC_ERROR_TEXT;
}

const passwordTexts: Record<string, string> = {
  REQUIRED: 'Escribe la contraseña',
  TOO_SHORT: 'Mínimo 8 caracteres',
  TOO_LONG: 'Máximo 128 caracteres',
};

const fieldTexts: Record<string, Record<string, string>> = {
  name: { REQUIRED: 'Escribe tu nombre', TOO_LONG: 'Máximo 80 caracteres' },
  email: { REQUIRED: 'Escribe tu email', INVALID_FORMAT: 'Escribe un email válido' },
  password: passwordTexts,
  newPassword: passwordTexts,
  currentPassword: { REQUIRED: 'Escribe tu contraseña actual' },
  timezone: { INVALID_TIMEZONE: 'Zona horaria no válida' },
};

/** Spanish text for a field error code (contracts/errors.md → mensajes por campo). */
export function fieldErrorText(field: string, code: string): string {
  return fieldTexts[field]?.[code] ?? 'Revisa este campo';
}

const KNOWN_CODES = new Set<string>([
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'TOKEN_EXPIRED',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'INVALID_PASSWORD',
  'PASSWORD_CHANGE_REQUIRED',
  'EMAIL_TAKEN',
  'SAME_PASSWORD',
  'RATE_LIMITED',
  'NOT_FOUND',
]);

/** Builds an ApiError from any response body, tolerating unexpected shapes. */
export function toApiError(status: number, body: unknown): ApiError {
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const code =
    typeof record.code === 'string' && KNOWN_CODES.has(record.code)
      ? (record.code as ApiErrorCode)
      : 'UNKNOWN';
  const fieldErrors = Array.isArray(record.errors)
    ? record.errors.filter(
        (item): item is FieldError =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as FieldError).field === 'string' &&
          typeof (item as FieldError).code === 'string',
      )
    : [];
  return new ApiError(status, code, fieldErrors);
}
