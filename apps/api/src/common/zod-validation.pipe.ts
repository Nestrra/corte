import { Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppErrors, type FieldError } from './errors';

const CODE_PATTERN = /^[A-Z][A-Z_]*$/;

/**
 * Validates a request body with a zod schema. Schemas put the field error code
 * (contracts/errors.md, e.g. TOO_SHORT) in the issue message.
 */
@Injectable()
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;

    const errors: FieldError[] = result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : '(body)',
      code:
        issue.code === 'unrecognized_keys'
          ? 'UNKNOWN_FIELD'
          : CODE_PATTERN.test(issue.message)
            ? issue.message
            : 'INVALID',
    }));
    throw AppErrors.validation(errors);
  }
}
