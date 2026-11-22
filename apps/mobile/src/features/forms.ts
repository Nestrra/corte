import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, fieldErrorText } from '../api/errors';

/**
 * Puts the API's per-field validation errors (`VALIDATION_ERROR`) on the matching form fields.
 * Returns true when at least one field error was shown.
 */
export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') return false;
  let applied = false;
  for (const { field, code } of error.fieldErrors) {
    const name = fields.find((candidate) => candidate === field);
    if (name !== undefined) {
      setError(name, { message: fieldErrorText(field, code) });
      applied = true;
    }
  }
  return applied;
}
