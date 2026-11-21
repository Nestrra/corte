import { zodResolver } from '@hookform/resolvers/zod';
import {
  isValidEmail,
  normalizeEmail,
  normalizeName,
  validateName,
  validatePassword,
} from '@corte/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { register } from '../../api/auth';
import { ApiError, errorText, fieldErrorText } from '../../api/errors';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { applyApiFieldErrors } from '../../features/forms';
import { useSessionStore } from '../../session/session-store';
import { spacing } from '../../theme';

// Same rules as the API, from @corte/domain (research.md R9).
const schema = z.object({
  name: z.string().superRefine((value, ctx) => {
    const code = validateName(value);
    if (code) ctx.addIssue({ code: 'custom', message: fieldErrorText('name', code) });
  }),
  email: z
    .string()
    .refine(
      (value) => isValidEmail(normalizeEmail(value)),
      fieldErrorText('email', 'INVALID_FORMAT'),
    ),
  password: z.string().superRefine((value, ctx) => {
    const code = validatePassword(value);
    if (code) ctx.addIssue({ code: 'custom', message: fieldErrorText('password', code) });
  }),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setFormError(null);
    try {
      const result = await register({
        name: normalizeName(name),
        email: normalizeEmail(email),
        password,
      });
      await useSessionStore.getState().signIn(result);
    } catch (error) {
      setValue('password', '');
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setError('email', { message: errorText(error) });
      } else if (!applyApiFieldErrors(error, setError, ['name', 'email', 'password'])) {
        setFormError(errorText(error));
      }
    }
  });

  return (
    <Screen centered>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Crear cuenta
        </Text>
        <Text color="textSecondary">Controla tus tarjetas por fecha de corte</Text>
      </View>

      <View style={styles.fields}>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Nombre"
              autoComplete="name"
              textContentType="name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Email"
              kind="email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Contraseña"
              kind="password"
              autoComplete="new-password"
              textContentType="newPassword"
              hint="Mínimo 8 caracteres"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
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
        <Button label="Crear cuenta" onPress={() => void onSubmit()} loading={isSubmitting} />
        <Button
          label="Ya tengo cuenta"
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
          disabled={isSubmitting}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  fields: { gap: spacing.lg },
  actions: { gap: spacing.md },
});
