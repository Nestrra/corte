import { zodResolver } from '@hookform/resolvers/zod';
import { normalizeEmail } from '@corte/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { login } from '../../api/auth';
import { errorText } from '../../api/errors';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { useSessionStore, type SessionNotice } from '../../session/session-store';
import { spacing } from '../../theme';

// Login only checks that both fields are filled: formats are not validated so that any wrong
// input gets the same generic answer (FR-007).
const schema = z.object({
  email: z.string().trim().min(1, 'Escribe tu email'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});
type FormValues = z.infer<typeof schema>;

const noticeText: Record<SessionNotice, string> = {
  expired: 'Tu sesión expiró. Inicia sesión de nuevo.',
  revoked: 'Tu sesión se cerró. Inicia sesión de nuevo.',
};

export default function LoginScreen() {
  const lastEmail = useSessionStore((state) => state.lastEmail);
  const notice = useSessionStore((state) => state.notice);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: lastEmail ?? '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    useSessionStore.getState().clearNotice();
    try {
      const result = await login({ email: normalizeEmail(email), password });
      await useSessionStore.getState().signIn(result);
    } catch (error) {
      setValue('password', '');
      setFormError(errorText(error));
    }
  });

  return (
    <Screen centered>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Corte
        </Text>
        <Text color="textSecondary">Inicia sesión para continuar</Text>
      </View>

      {notice !== null ? (
        <Text color="warning" accessibilityLiveRegion="polite">
          {noticeText[notice]}
        </Text>
      ) : null}

      <View style={styles.fields}>
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
              returnKeyType="next"
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
              autoComplete="current-password"
              textContentType="password"
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
        <Button label="Iniciar sesión" onPress={() => void onSubmit()} loading={isSubmitting} />
        <Button
          label="Crear cuenta"
          variant="secondary"
          onPress={() => router.push('/register')}
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
