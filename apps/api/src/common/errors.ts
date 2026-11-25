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
  | 'CARD_ARCHIVED'
  | 'STATEMENT_OPEN'
  | 'RECURRING_DELETED'
  | 'DEVICE_NOT_REGISTERED'
  | 'TEST_RATE_LIMITED'
  | 'PUSH_FAILED';

export interface FieldError {
  field: string;
  code: string;
}

export interface ErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  errors?: FieldError[];
  /** Seconds until the action can be retried (TEST_RATE_LIMITED). */
  retryAfterSeconds?: number;
}

/** An HTTP error whose body follows contracts/errors.md. */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly errors?: FieldError[],
    extra: Pick<ErrorBody, 'retryAfterSeconds'> = {},
  ) {
    const body: ErrorBody = {
      statusCode: status,
      code,
      message,
      ...(errors ? { errors } : {}),
      ...extra,
    };
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
  cardArchivedPurchases: () =>
    new AppException(
      HttpStatus.CONFLICT,
      'CARD_ARCHIVED',
      'Restore the card before changing its purchases',
    ),
  statementOpen: () =>
    new AppException(
      HttpStatus.CONFLICT,
      'STATEMENT_OPEN',
      'The statement has not been cut yet; it can be paid after its cutoff date',
    ),
  recurringDeleted: () =>
    new AppException(
      HttpStatus.CONFLICT,
      'RECURRING_DELETED',
      'The recurring payment was deleted; its paid history cannot be undone',
    ),
  deviceNotRegistered: () =>
    new AppException(
      HttpStatus.CONFLICT,
      'DEVICE_NOT_REGISTERED',
      'This session has no device registered for notifications',
    ),
  testRateLimited: (retryAfterSeconds: number) =>
    new AppException(
      HttpStatus.TOO_MANY_REQUESTS,
      'TEST_RATE_LIMITED',
      'Wait before sending another test notification',
      undefined,
      { retryAfterSeconds },
    ),
  pushFailed: () =>
    new AppException(
      HttpStatus.BAD_GATEWAY,
      'PUSH_FAILED',
      'The push service rejected the message',
    ),
};
