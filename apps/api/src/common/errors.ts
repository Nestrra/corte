import { HttpException, HttpStatus } from '@nestjs/common';

/** Stable error codes of the API (contracts/errors.md). The app maps them to Spanish texts. */
export type ErrorCode =
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
  | 'CARD_ARCHIVED';

export interface FieldError {
  field: string;
  code: string;
}

export interface ErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  errors?: FieldError[];
}

/** An HTTP error whose body follows contracts/errors.md. */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly errors?: FieldError[],
  ) {
    const body: ErrorBody = { statusCode: status, code, message, ...(errors ? { errors } : {}) };
    super(body, status);
  }
}

/** Factory functions for the errors used across modules. */
export const AppErrors = {
  validation: (errors: FieldError[]) =>
    new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Validation failed', errors),
  invalidCredentials: () =>
    new AppException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid email or password'),
  tokenExpired: () =>
    new AppException(HttpStatus.UNAUTHORIZED, 'TOKEN_EXPIRED', 'Access token expired or invalid'),
  sessionExpired: () =>
    new AppException(HttpStatus.UNAUTHORIZED, 'SESSION_EXPIRED', 'Session expired'),
  sessionRevoked: () =>
    new AppException(HttpStatus.UNAUTHORIZED, 'SESSION_REVOKED', 'Session revoked'),
  invalidPassword: () =>
    new AppException(HttpStatus.UNAUTHORIZED, 'INVALID_PASSWORD', 'Password is incorrect'),
  passwordChangeRequired: () =>
    new AppException(
      HttpStatus.FORBIDDEN,
      'PASSWORD_CHANGE_REQUIRED',
      'A password change is required before continuing',
    ),
  emailTaken: () =>
    new AppException(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'An account with this email exists'),
  samePassword: () =>
    new AppException(
      HttpStatus.CONFLICT,
      'SAME_PASSWORD',
      'The new password must differ from the current one',
    ),
  rateLimited: () =>
    new AppException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many attempts'),
  notFound: (message: string) => new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', message),
  cardArchived: () =>
    new AppException(HttpStatus.CONFLICT, 'CARD_ARCHIVED', 'Restore the card before editing it'),
};
