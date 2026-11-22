import { zodResolver } from '@hookform/resolvers/zod';
import { validatePassword } from '@corte/domain';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { changePassword, logout } from '../../api/auth';
import { ApiError, errorText, fieldErrorText } from '../../api/errors';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { applyApiFieldErrors } from '../../features/forms';
import { useSessionStore } from '../../session/session-store';
import { spacing } from '../../theme';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
}

/**
 * Forced mode (temporary password, FR-026) asks only for the new password; voluntary mode
 * (FR-027) also asks for the current one. Both use the @corte/domain password rules.
 */
function buildSchema(forced: boolean) {
  return z
    .object({
      currentPassword: z.string(),
      newPassword: z.string().superRefine((value, ctx) => {
        const code = validatePassword(value);
        if (code) ctx.addIssue({ code: 'custom', message: fieldErrorText('newPassword', code) });
      }),
      confirmation: z.string(),
    })
    .superRefine((values, ctx) => {
      if (!forced && values.currentPassword.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['currentPassword'],
          message: fieldErrorText('currentPassword', 'REQUIRED'),
        });
      }
      if (values.confirmation !== values.newPassword) {
        ctx.addIssue({
          code: 'custom',
          path: ['confirmation'],
          message: 'Las contraseñas no coinciden',
        });
      }
    });
}

export default function ChangePasswordScreen() {
  const forced = useSessionStore((state) => state.user?.mustChangePassword ?? false);
  // The mode is fixed when the screen opens: saving in forced mode flips the flag right before
  // leaving, and the form must not switch to voluntary mode in between.
  const [mode] = useState<'forced' | 'voluntary'>(forced ? 'forced' : 'voluntary');
  const isForced = mode === 'forced';
  const schema = useMemo(() => buildSchema(isForced), [isForced]);
  const [formError, setFormError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmation: '' },
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFormError(null);
    try {
      const user = await changePassword(
        isForced ? { newPassword } : { currentPassword, newPassword },
      );
      useSessionStore.getState().setUser(user);
      if (isForced) router.replace('/home');
      else router.back();
    } catch (error) {
      // Passwords are never kept after an error (contracts/screens.md).
      reset({ currentPassword: '', newPassword: '', confirmation: '' });
      if (error instanceof ApiError && error.code === 'INVALID_PASSWORD') {
        setError('currentPassword', { message: errorText(error) });
      } else if (error instanceof ApiError && error.code === 'SAME_PASSWORD') {
        setError('newPassword', { message: errorText(error) });
      } else if (!applyApiFieldErrors(error, setError, ['currentPassword', 'newPassword'])) {
        setFormError(errorText(error));
      }
    }
  });

  const onLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  return (
    <Screen edges={['bottom']}>
      {isForced ? (
        <View style={styles.header}>
          <Text variant="section" accessibilityRole="header">
            Debes cambiar tu contraseña temporal
          </Text>
          <Text color="textSecondary">Elige una contraseña nueva para seguir usando Corte.</Text>
        </View>
      ) : null}

      <View style={styles.fields}>
        {!isForced ? (
          <Controller
            control={control}
            name="currentPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Contraseña actual"
                kind="password"
                autoComplete="current-password"
                textContentType="password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.currentPassword?.message}
              />
            )}
          />
        ) : null}
        <Controller
          control={control}
          name="newPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Contraseña nueva"
              kind="password"
              autoComplete="new-password"
              textContentType="newPassword"
              hint="Mínimo 8 caracteres"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.newPassword?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmation"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Confirma la contraseña nueva"
              kind="password"
              autoComplete="new-password"
              textContentType="newPassword"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmation?.message}
              returnKeyType="go"
              onSubmitEditing={() => void onSubmit()}
            />
          )}
        />
        {formError !== null ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {formError}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          label="Guardar contraseña"
          onPress={() => void onSubmit()}
          loading={isSubmitting}
          disabled={loggingOut}
        />
        {isForced ? (
          <Button
            label="Cerrar sesión"
            variant="secondary"
            onPress={() => void onLogout()}
            loading={loggingOut}
            disabled={isSubmitting}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  fields: { gap: spacing.lg },
  actions: { gap: spacing.md },
});
