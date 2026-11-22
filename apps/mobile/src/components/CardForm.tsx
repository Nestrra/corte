import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, type Control, type FieldPath } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import type { CardInput } from '../api/cards';
import { cardFieldErrorText, errorText } from '../api/errors';
import {
  CARD_FORM_FIELDS,
  cardFormSchema,
  toCardInput,
  type CardFormValues,
} from '../features/card-schema';
import { applyApiFieldErrors } from '../features/forms';
import { formatCop, parseAmountInput } from '../features/money';
import { spacing } from '../theme';
import { Button } from './Button';
import { ColorPicker } from './ColorPicker';
import { Text } from './Text';
import { TextField, type TextFieldProps } from './TextField';

export interface CardFormProps {
  defaultValues: CardFormValues;
  /** Sends the card to the API; a thrown error is shown on the form and the values are kept. */
  onSubmit: (input: CardInput) => Promise<void>;
  onCancel: () => void;
}

interface FieldProps extends Omit<TextFieldProps, 'value' | 'onChangeText' | 'error'> {
  control: Control<CardFormValues>;
  name: FieldPath<CardFormValues>;
  /** Amounts: shown formatted ("$5.000.000") when the field loses focus. */
  amount?: boolean;
}

function FormField({ control, name, amount = false, ...props }: FieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <TextField
          value={value}
          onChangeText={onChange}
          onBlur={() => {
            if (amount) {
              const parsed = parseAmountInput(value);
              if (parsed !== null) onChange(formatCop(parsed));
            }
            onBlur();
          }}
          error={error?.message}
          {...props}
        />
      )}
    />
  );
}

/**
 * Create / edit form of contracts/screens.md, validated locally with the @corte/domain rules
 * before sending (FR-011). API field errors land on their fields.
 */
export function CardForm({ defaultValues, onSubmit, onCancel }: CardFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<CardFormValues>({ resolver: zodResolver(cardFormSchema), defaultValues });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(toCardInput(values));
    } catch (error) {
      if (!applyApiFieldErrors(error, setError, CARD_FORM_FIELDS, cardFieldErrorText)) {
        setFormError(errorText(error));
      }
    }
  });

  return (
    <>
      <View style={styles.fields}>
        <FormField control={control} name="name" label="Nombre" maxLength={60} />
        <Controller
          control={control}
          name="color"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <ColorPicker label="Color" value={value} onChange={onChange} error={error?.message} />
          )}
        />
        <FormField
          control={control}
          name="last4"
          label="Últimos 4 dígitos (opcional)"
          keyboardType="number-pad"
          maxLength={4}
        />
        <View style={styles.row}>
          <View style={styles.cell}>
            <FormField
              control={control}
              name="cutoffDay"
              label="Día de corte"
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <View style={styles.cell}>
            <FormField
              control={control}
              name="dueDay"
              label="Día límite de pago"
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        </View>
        <FormField
          control={control}
          name="creditLimit"
          label="Cupo total"
          keyboardType="number-pad"
          amount
        />
        <FormField
          control={control}
          name="cycleBudget"
          label="Tope por ciclo"
          keyboardType="number-pad"
          hint="Cuánto quieres gastar como máximo en cada corte"
          amount
        />
        <View style={styles.row}>
          <View style={styles.cell}>
            <FormField
              control={control}
              name="remindCutoffDays"
              label="Recordar corte"
              hint="Días antes"
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <View style={styles.cell}>
            <FormField
              control={control}
              name="remindDueDays"
              label="Recordar pago"
              hint="Días antes"
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        </View>
        {formError !== null ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {formError}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button label="Guardar tarjeta" onPress={() => void submit()} loading={isSubmitting} />
        <Button label="Cancelar" variant="secondary" onPress={onCancel} disabled={isSubmitting} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fields: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  cell: { flex: 1 },
  actions: { gap: spacing.md },
});
