import { Expo } from 'expo-server-sdk';
import { z } from 'zod';
import { typeError } from '../common/zod-fields';

// spec 006 contracts/notifications.openapi.yaml → RegisterDevice; data-model.md → Device.token
// (VARCHAR(255), Expo format) and Device.platform (ios | android).

export const PUSH_TOKEN_MAX_LENGTH = 255;
export const DEVICE_PLATFORMS = ['ios', 'android'] as const;

export const registerDeviceSchema = z.strictObject({
  token: z
    .string(typeError('INVALID_PUSH_TOKEN'))
    .max(PUSH_TOKEN_MAX_LENGTH, { error: 'INVALID_PUSH_TOKEN' })
    .refine((value) => Expo.isExpoPushToken(value), { error: 'INVALID_PUSH_TOKEN' }),
  platform: z.enum(DEVICE_PLATFORMS, typeError('INVALID')),
});
export type RegisterDeviceInput = z.output<typeof registerDeviceSchema>;
