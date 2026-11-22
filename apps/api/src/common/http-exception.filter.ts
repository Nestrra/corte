import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { AppException, AppErrors, type ErrorBody } from './errors';

interface JsonResponse {
  status(code: number): JsonResponse;
  json(body: unknown): void;
}

/**
 * Writes AppException bodies as-is (contracts/errors.md) and maps the throttler's exception to
 * 429 RATE_LIMITED. Other exceptions keep Nest's default handling (e.g. the health endpoint's
 * 503 body).
 */
@Catch(AppException, ThrottlerException)
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: AppException | ThrottlerException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<JsonResponse>();
    const error = exception instanceof AppException ? exception : AppErrors.rateLimited();
    const body = error.getResponse() as ErrorBody;
    response.status(error.getStatus() ?? HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}
