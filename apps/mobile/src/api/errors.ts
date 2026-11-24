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
  | 'CARD_ARCHIVED'
  | 'STATEMENT_OPEN'
  | 'RECURRING_DELETED'
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
  // specs/002-cards/contracts/errors.md
  NOT_FOUND: 'No encontramos esa tarjeta',
  CARD_ARCHIVED: 'Restaura la tarjeta para editarla',
  // specs/003-purchases/contracts/errors.md
  STATEMENT_OPEN: 'Este extracto aún no corta; podrás pagarlo después del corte',
  // specs/005-recurring-payments/contracts/recurring.openapi.yaml
  RECURRING_DELETED: 'Este pago fue eliminado; lo pagado no se puede deshacer',
};

// specs/003-purchases/contracts/errors.md: the same codes read differently on purchase and
// statement screens.
export const PURCHASE_NOT_FOUND_TEXT = 'No encontramos esa compra';
export const STATEMENT_NOT_FOUND_TEXT = 'No encontramos ese extracto';
export const CARD_ARCHIVED_PURCHASES_TEXT = 'Restaura la tarjeta para cambiar sus compras';
export const RECURRING_NOT_FOUND_TEXT = 'No encontramos ese pago';

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

// Card fields (specs/002-cards/contracts/errors.md). Keyed by form field, so `name` of a card
// gets its own texts through `cardFieldErrorText`.
const dayTexts = { OUT_OF_RANGE: 'Elige un día del 1 al 31', REQUIRED: 'Elige un día del 1 al 31' };
const reminderTexts = { OUT_OF_RANGE: 'Entre 0 y 15 días', REQUIRED: 'Entre 0 y 15 días' };
const cardFieldTexts: Record<string, Record<string, string>> = {
  name: { REQUIRED: 'Escribe un nombre', TOO_LONG: 'Máximo 40 caracteres' },
  color: { INVALID: 'Elige un color', REQUIRED: 'Elige un color' },
  last4: { INVALID_FORMAT: 'Deben ser 4 dígitos' },
  cutoffDay: dayTexts,
  dueDay: dayTexts,
  creditLimit: {
    OUT_OF_RANGE: 'Escribe un cupo mayor que 0',
    REQUIRED: 'Escribe un cupo mayor que 0',
  },
  cycleBudget: {
    OUT_OF_RANGE: 'Escribe un tope mayor que 0',
    REQUIRED: 'Escribe un tope mayor que 0',
    EXCEEDS_CREDIT_LIMIT: 'El tope no puede superar el cupo',
  },
  remindCutoffDays: reminderTexts,
  remindDueDays: reminderTexts,
  // spec 003 FR-006
  annualRate: {
    OUT_OF_RANGE: 'Escribe una tasa entre 0 y 100',
    TOO_MANY_DECIMALS: 'Máximo 2 decimales',
  },
};

// Purchase fields (specs/003-purchases/contracts/errors.md).
const purchaseFieldTexts: Record<string, Record<string, string>> = {
  amount: {
    OUT_OF_RANGE: 'Escribe un valor mayor que 0',
    REQUIRED: 'Escribe un valor mayor que 0',
  },
  concept: { REQUIRED: 'Escribe un concepto', TOO_LONG: 'Máximo 60 caracteres' },
  purchaseDate: {
    INVALID: 'Elige una fecha válida',
    IN_FUTURE: 'La fecha no puede ser posterior a hoy',
    TOO_OLD: 'La fecha no puede ser de hace más de 6 años',
  },
  installmentCount: {
    OUT_OF_RANGE: 'Elige de 1 a 72 cuotas',
    REQUIRED: 'Elige de 1 a 72 cuotas',
  },
};

// Recurring payment fields (specs/005-recurring-payments/data-model.md → Validación).
const recurringAmountTexts = {
  OUT_OF_RANGE: 'Escribe un monto mayor que 0',
  REQUIRED: 'Escribe un monto mayor que 0',
};
const recurringFieldTexts: Record<string, Record<string, string>> = {
  name: { REQUIRED: 'Escribe un nombre', TOO_LONG: 'Máximo 40 caracteres' },
  amount: recurringAmountTexts,
  frequency: { REQUIRED: 'Elige la frecuencia', INVALID: 'Elige la frecuencia' },
  firstDueDate: {
    REQUIRED: 'Elige la fecha del primer vencimiento',
    INVALID: 'Elige una fecha válida',
    TOO_OLD: 'La fecha no puede ser anterior a este mes',
    TOO_FAR: 'La fecha no puede ser de más de 12 meses',
  },
  nextDueDate: {
    REQUIRED: 'Elige la fecha del próximo vencimiento',
    INVALID: 'Elige una fecha válida',
    IN_PAST: 'La fecha no puede ser anterior a hoy',
    TOO_FAR: 'La fecha no puede ser de más de 12 meses',
    BEFORE_LAST_DUE: 'Al cambiar la frecuencia, elige una fecha posterior al último vencimiento',
  },
};

/** Spanish text for a recurring payment field error code (spec 005). */
export function recurringFieldErrorText(field: string, code: string): string {
  return recurringFieldTexts[field]?.[code] ?? 'Revisa este campo';
}

/** Spanish text for a purchase field error code (specs/003-purchases/contracts/errors.md). */
export function purchaseFieldErrorText(field: string, code: string): string {
  return purchaseFieldTexts[field]?.[code] ?? 'Revisa este campo';
}

/** Spanish text for a card field error code (specs/002-cards/contracts/errors.md). */
export function cardFieldErrorText(field: string, code: string): string {
  return cardFieldTexts[field]?.[code] ?? 'Revisa este campo';
}

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
  'CARD_ARCHIVED',
  'STATEMENT_OPEN',
  'RECURRING_DELETED',
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
