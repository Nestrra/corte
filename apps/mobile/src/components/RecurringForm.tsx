import {
  earliestFirstDueDate,
  latestRecurringDueDate,
  RECURRING_FREQUENCIES,
  type IsoDate,
} from '@corte/domain';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { ApiError, errorText, recurringFieldErrorText } from '../api/errors';
import type { RecurringFrequency } from '../api/recurring';
import { formatCop, parseAmountInput } from '../features/money';
import {
  FREQUENCY_LABELS,
  formFieldOf,
  recurringFormSchema,
  type RecurringFormMode,
  type RecurringFormValues,
} from '../features/recurring-schema';
import { colors, interaction, layout, radius, spacing } from '../theme';
import { Button } from './Button';
import { DateField } from './DateField';
import { Text } from './Text';
import { TextField } from './TextField';

export interface RecurringFormProps {
  mode: RecurringFormMode;
  defaultValues: RecurringFormValues;
  /** The user's "today" from the API. */
  today: IsoDate;
  submitLabel: string;
  /** A note above the buttons (editing: changes apply from today on). */
  note?: string;
  /** Sends the payment; a thrown error is shown on the form and the values are kept. */
  onSubmit: (values: RecurringFormValues) => Promise<void>;
  onCancel: () => void;
}

/** Frequency as radio options ≥ 44 (contracts/screens.md → RecurringForm). */
function FrequencyOptions({
  value,
  onChange,
}: {
  value: RecurringFrequency;
  onChange: (value: RecurringFrequency) => void;
}) {
  return (
    <View style={styles.group}>
      <Text variant="secondary" color="textSecondary">
        Frecuencia
      </Text>
      <View accessibilityRole="radiogroup" style={styles.panel}>
        {RECURRING_FREQUENCIES.map((frequency, index) => {
          const checked = frequency === value;
          return (
            <Pressable
              key={frequency}
              accessibilityRole="radio"
              accessibilityLabel={FREQUENCY_LABELS[frequency]}
              accessibilityState={{ checked }}
              onPress={() => onChange(frequency)}
              style={({ pressed }) => [
                styles.option,
                index > 0 && styles.divided,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.radio, checked && styles.radioChecked]}>
                {checked ? <View style={styles.radioDot} /> : null}
              </View>
              <Text>{FREQUENCY_LABELS[frequency]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * "Nuevo pago" / "Editar pago" form of specs/005-recurring-payments/contracts/screens.md,
 * validated locally with the @corte/domain rules before sending. API field errors land on their
 * fields (first or next due date on the date field).
 */
export function RecurringForm({
  mode,
  defaultValues,
  today,
  submitLabel,
  note,
  onSubmit,
  onCancel,
}: RecurringFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const schema = useMemo(() => recurringFormSchema(today, mode), [today, mode]);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<RecurringFormValues>({ resolver: zodResolver(schema), defaultValues });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      let applied = false;
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        for (const { field, code } of error.fieldErrors) {
          const name = formFieldOf(field);
          if (name) {
            setError(name, { message: recurringFieldErrorText(field, code) });
            applied = true;
          }
        }
      }
      if (!applied) setFormError(errorText(error));
    }
  });

  return (
    <>
      <View style={styles.fields}>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
            <TextField
              label="Nombre"
              hint="Por ejemplo, Arriendo"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={error?.message}
              maxLength={60}
            />
          )}
        />
        <Controller
          control={control}
          name="amount"
          render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
            <TextField
              label="Monto esperado"
              value={value}
              onChangeText={onChange}
              onBlur={() => {
                const parsed = parseAmountInput(value);
                if (parsed !== null) onChange(formatCop(parsed));
                onBlur();
              }}
              error={error?.message}
              keyboardType="number-pad"
            />
          )}
        />
        <Controller
          control={control}
          name="frequency"
          render={({ field: { onChange, value } }) => (
            <FrequencyOptions value={value} onChange={onChange} />
          )}
        />
        <Controller
          control={control}
          name="dueDate"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <DateField
              label={mode === 'create' ? 'Primer vencimiento' : 'Próximo vencimiento'}
              value={value}
              onChange={onChange}
              minimumDate={mode === 'create' ? earliestFirstDueDate(today) : today}
              maximumDate={latestRecurringDueDate(today)}
              error={error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="remindDays"
          render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
            <TextField
              label="Recordar con anticipación"
              hint="Días antes del vencimiento. 0 = el mismo día"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={error?.message}
              keyboardType="number-pad"
              maxLength={2}
            />
          )}
        />
        {note ? (
          <View style={styles.note}>
            <Text variant="secondary" color="primaryStrong">
              {note}
            </Text>
          </View>
        ) : null}
        {formError !== null ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {formError}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button label={submitLabel} onPress={() => void submit()} loading={isSubmitting} />
        <Button label="Cancelar" variant="secondary" onPress={onCancel} disabled={isSubmitting} />
      </View>
    </>
  );
}

const RADIO = spacing.xl;
const DOT = spacing.sm;

const styles = StyleSheet.create({
  fields: { gap: spacing.lg },
  group: { gap: spacing.xs },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  option: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.divider },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioChecked: { borderColor: colors.primary },
  radioDot: { width: DOT, height: DOT, borderRadius: radius.full, backgroundColor: colors.primary },
  note: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  actions: { gap: spacing.md },
  pressed: { opacity: interaction.pressedOpacity },
});
