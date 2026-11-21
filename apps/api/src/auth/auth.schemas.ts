import {
  isValidEmail,
  normalizeEmail,
  normalizeName,
  validateName,
  validatePassword,
} from '@corte/domain';
import { z } from 'zod';

// Issue messages are the field error codes of contracts/errors.md.

const newPassword = z.string({ error: 'TOO_SHORT' }).superRefine((value, ctx) => {
  const error = validatePassword(value);
  if (error) ctx.addIssue({ code: 'custom', message: error });
});

export const registerSchema = z.object({
  name: z
    .string({ error: 'REQUIRED' })
    .superRefine((value, ctx) => {
      const error = validateName(value);
      if (error) ctx.addIssue({ code: 'custom', message: error });
    })
    .transform(normalizeName),
  email: z
    .string({ error: 'INVALID_FORMAT' })
    .transform(normalizeEmail)
    .refine(isValidEmail, { error: 'INVALID_FORMAT' }),
  password: newPassword,
});
export type RegisterInput = z.output<typeof registerSchema>;

/** Login does not validate formats or lengths: any wrong input is just INVALID_CREDENTIALS. */
export const loginSchema = z.object({
  email: z.string({ error: 'REQUIRED' }).transform(normalizeEmail),
  password: z.string({ error: 'REQUIRED' }),
});
export type LoginInput = z.output<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string({ error: 'REQUIRED' }).min(1, { error: 'REQUIRED' }),
});
export type RefreshInput = z.output<typeof refreshSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword,
});
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;
