import { z } from 'zod';
import { isValidTimeZone } from './timezone';

export const updateMeSchema = z.strictObject({
  timezone: z.string({ error: 'INVALID_TIMEZONE' }).refine(isValidTimeZone, {
    error: 'INVALID_TIMEZONE',
  }),
});
export type UpdateMeInput = z.output<typeof updateMeSchema>;

export const deleteMeSchema = z.object({
  password: z.string({ error: 'REQUIRED' }).min(1, { error: 'REQUIRED' }),
});
export type DeleteMeInput = z.output<typeof deleteMeSchema>;
