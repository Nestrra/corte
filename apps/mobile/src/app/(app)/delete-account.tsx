import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { ApiError, errorText } from '../../api/errors';
import { deleteAccount } from '../../api/me';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { useSessionStore } from '../../session/session-store';
import { spacing } from '../../theme';

const schema = z.object({ password: z.string().min(1, 'Escribe tu contraseña') });
type FormValues = z.infer<typeof schema>;

/** Permanent deletion confirmed with the password (FR-020–FR-022, contracts/screens.md). */
export default function DeleteAccountScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: '' } });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await deleteAccount(password);
      // The account no longer exists: do not prefill its email on the login screen.
      await useSessionStore.getState().signOut({ forgetEmail: true });
    } catch (error) {
      setValue('password', '');
      if (error instanceof ApiError && error.code === 'INVALID_PASSWORD') {
        setError('password', { message: errorText(error) });
      } else {
        setFormError(errorText(error));
      }
    }
  });

  return (
    <Screen edges={['bottom']}>
      <View style={styles.warning}>
        <Text variant="section" accessibilityRole="header">
          ¿Eliminar tu cuenta?
        </Text>
        <Text>Esta acción es permanente. Se borrarán tu cuenta y todos tus datos.</Text>
      </View>

      <View style={styles.fields}>
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
          label="Eliminar mi cuenta"
          variant="danger"
          onPress={() => void onSubmit()}
          loading={isSubmitting}
        />
        <Button
          label="Cancelar"
          variant="secondary"
          onPress={() => router.back()}
          disabled={isSubmitting}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  warning: { gap: spacing.sm },
  fields: { gap: spacing.lg },
  actions: { gap: spacing.md },
});
