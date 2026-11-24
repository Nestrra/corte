import { validateAmount } from '@corte/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorText, recurringFieldErrorText } from '../api/errors';
import { formatCop, parseAmountInput } from '../features/money';
import { spacing } from '../theme';
import { Button } from './Button';
import { Text } from './Text';
import { TextField } from './TextField';

/**
 * "Marcar pagado" (spec 005 FR-009; contracts/screens.md → hoja): the amount paid, prefilled with
 * the expected one and editable. Sends `undefined` when it was not changed, so the API keeps the
 * expected amount.
 */
export function PayOccurrenceForm({
  expectedAmount,
  onSubmit,
  onCancel,
}: {
  expectedAmount: number;
  onSubmit: (amount: number | undefined) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(formatCop(expectedAmount));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const amount = parseAmountInput(text);
    const code = amount === null ? 'OUT_OF_RANGE' : validateAmount(amount);
    if (code || amount === null) {
      setFieldError(recurringFieldErrorText('amount', code ?? 'OUT_OF_RANGE'));
      return;
    }
    setFieldError(null);
    setFormError(null);
    setSubmitting(true);
    try {
      await onSubmit(amount === expectedAmount ? undefined : amount);
    } catch (error) {
      setFormError(errorText(error));
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.form}>
      <TextField
        label="Monto pagado"
        hint={`Esperado ${formatCop(expectedAmount)}`}
        value={text}
        onChangeText={setText}
        onBlur={() => {
          const parsed = parseAmountInput(text);
          if (parsed !== null) setText(formatCop(parsed));
        }}
        error={fieldError ?? undefined}
        keyboardType="number-pad"
        autoFocus
        selectTextOnFocus
      />
      {formError !== null ? (
        <Text color="danger" accessibilityLiveRegion="polite">
          {formError}
        </Text>
      ) : null}
      <Button label="Confirmar pago" onPress={() => void submit()} loading={submitting} />
      <Button label="Cancelar" variant="secondary" onPress={onCancel} disabled={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
