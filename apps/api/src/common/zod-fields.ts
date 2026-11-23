import { z } from 'zod';

// Building blocks for request schemas. Issue messages are the field error codes of the
// contracts/errors.md files; the rules come from @corte/domain so the app validates the same way.

/** A missing field reports REQUIRED; a value of the wrong type reports `code`. */
export const typeError = (code: string) => ({
  error: (issue: { input?: unknown }) => (issue.input === undefined ? 'REQUIRED' : code),
});

/** A number checked by a domain validator that returns an error code or null. */
export function checkedNumber(validate: (value: number) => string | null) {
  return z.number(typeError('OUT_OF_RANGE')).superRefine((value, ctx) => {
    const code = validate(value);
    if (code) ctx.addIssue({ code: 'custom', message: code });
  });
}

/** A string checked by a domain validator, then normalized (e.g. trimmed). */
export function checkedString(
  validate: (value: string) => string | null,
  normalize: (value: string) => string,
) {
  return z
    .string(typeError('REQUIRED'))
    .superRefine((value, ctx) => {
      const code = validate(value);
      if (code) ctx.addIssue({ code: 'custom', message: code });
    })
    .transform(normalize);
}
