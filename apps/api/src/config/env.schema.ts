import { z } from 'zod';

/**
 * API environment configuration (data-model.md → EnvironmentConfig, contracts/environment.md).
 * Validated once at startup: if anything is invalid the process does not start (FR-008).
 * Error messages name the variables but never include their values (they may be secrets).
 */

/** Treats empty or blank strings as "not set", so optional variables fall back to defaults. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema,
  );

export const APP_ENVS = ['development', 'test', 'staging', 'production'] as const;

export const JWT_SECRET_MIN_LENGTH = 32;
/** The development value shipped in apps/api/.env.example; never valid in production. */
export const EXAMPLE_JWT_SECRET = 'dev-only-change-me-0123456789abcdef';

export const envSchema = z
  .object({
    DATABASE_URL: optional(
      z.string({ error: 'is required' }).refine((value) => /^postgres(ql)?:\/\/.+/.test(value), {
        error: 'must be a postgresql:// or postgres:// URL',
      }),
    ),
    APP_ENV: optional(z.enum(APP_ENVS, { error: `must be one of: ${APP_ENVS.join(', ')}` })),
    PORT: optional(
      z.coerce
        .number({ error: 'must be an integer between 1 and 65535' })
        .int({ error: 'must be an integer between 1 and 65535' })
        .min(1, { error: 'must be an integer between 1 and 65535' })
        .max(65535, { error: 'must be an integer between 1 and 65535' })
        .default(3000),
    ),
    GIT_SHA: optional(z.string().trim().default('unknown')),
    SWAGGER_ENABLED: optional(
      z
        .enum(['true', 'false'], { error: 'must be "true" or "false"' })
        .default('false')
        .transform((value) => value === 'true'),
    ),
    JWT_SECRET: optional(
      z.string({ error: 'is required' }).min(JWT_SECRET_MIN_LENGTH, {
        error: `must have at least ${JWT_SECRET_MIN_LENGTH} characters`,
      }),
    ),
    TRUST_PROXY: optional(
      z.coerce
        .number({ error: 'must be an integer ≥ 0' })
        .int({ error: 'must be an integer ≥ 0' })
        .min(0, { error: 'must be an integer ≥ 0' })
        .default(0),
    ),
  })
  .superRefine((env, ctx) => {
    if (env.SWAGGER_ENABLED && env.APP_ENV === 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['SWAGGER_ENABLED'],
        message: 'must not be true when APP_ENV=production (constitution, principle V)',
      });
    }
    if (env.APP_ENV === 'production' && env.JWT_SECRET === EXAMPLE_JWT_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'must not be the .env.example value when APP_ENV=production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** `validate` function for `ConfigModule.forRoot`. Throws listing every invalid variable. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (result.success) return result.data;

  const problems = result.error.issues.map(
    (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
}
