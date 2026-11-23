import { PURCHASE_MAX_AGE_MONTHS, type IsoDate } from '@corte/domain';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch, type Control, type FieldPath } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import type { CreatePurchase } from '../api/purchases';
import { errorText, purchaseFieldErrorText } from '../api/errors';
import { applyApiFieldErrors } from '../features/forms';
import { formatCop, parseAmountInput } from '../features/money';
import {
  chargesInterest,
  PURCHASE_FORM_FIELDS,
  purchaseFormSchema,
  toPurchaseInput,
  type PurchaseFormValues,
} from '../features/purchase-schema';
import { formatRate } from '../features/rate';
import { colors, interaction, layout, radius, spacing } from '../theme';
import { Button } from './Button';
import { DateField, monthsBefore } from './DateField';
import { Text } from './Text';
import { TextField, type TextFieldProps } from './TextField';

export interface PurchaseFormProps {
  defaultValues: PurchaseFormValues;
  /** The user's "today" from the API (`cycle.today`). */
  today: IsoDate;
  /** The rate that applies: the card's for a new purchase, the stored one when editing. */
  annualRate: number | null;
  /** Available credit of the card, for the warning of FR-012. */
  availableCredit: number;
  /** When editing, the current amount: only the increase is compared with the available credit. */
  previousAmount?: number;
  submitLabel: string;
  /** Sends the purchase; a thrown error is shown on the form and the values are kept. */
  onSubmit: (input: Required<CreatePurchase>) => Promise<void>;
  onCancel: () => void;
}

interface FieldProps extends Omit<TextFieldProps, 'value' | 'onChangeText' | 'error'> {
  control: Control<PurchaseFormValues>;
  name: Extract<FieldPath<PurchaseFormValues>, 'amount' | 'concept' | 'installmentCount'>;
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

/** Asks before saving a purchase above the available credit (FR-012); true to go on. */
function confirmOverLimit(availableCredit: number): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Supera tu cupo disponible',
      `Esta compra supera tu cupo disponible (${formatCop(availableCredit)}). ¿Guardarla de todas formas?`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Guardar', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Register / edit purchase form of specs/003-purchases/contracts/screens.md, validated locally with
 * the @corte/domain rules before sending (FR-011). API field errors land on their fields.
 */
export function PurchaseForm({
  defaultValues,
  today,
  annualRate,
  availableCredit,
  previousAmount = 0,
  submitLabel,
  onSubmit,
  onCancel,
}: PurchaseFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const schema = useMemo(() => purchaseFormSchema(today), [today]);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<PurchaseFormValues>({ resolver: zodResolver(schema), defaultValues });
  const [installmentCount, noInterest] = useWatch({
    control,
    name: ['installmentCount', 'noInterest'],
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const input = toPurchaseInput(values);
    if (input.amount - previousAmount > availableCredit) {
      if (!(await confirmOverLimit(availableCredit))) return;
    }
    try {
      await onSubmit(input);
    } catch (error) {
      if (!applyApiFieldErrors(error, setError, PURCHASE_FORM_FIELDS, purchaseFieldErrorText)) {
        setFormError(errorText(error));
      }
    }
  });

  const appliesRate = chargesInterest(annualRate, installmentCount, noInterest);

  return (
    <>
      <View style={styles.fields}>
        <FormField control={control} name="amount" label="Valor" keyboardType="number-pad" amount />
        <FormField control={control} name="concept" label="Concepto" maxLength={80} />
        <Controller
          control={control}
          name="purchaseDate"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <DateField
              label="Fecha"
              value={value}
              onChange={onChange}
              maximumDate={today}
              minimumDate={monthsBefore(today, PURCHASE_MAX_AGE_MONTHS)}
              error={error?.message}
            />
          )}
        />
        <FormField
          control={control}
          name="installmentCount"
          label="Cuotas"
          hint="De 1 a 72"
          keyboardType="number-pad"
          maxLength={2}
        />
        <Controller
          control={control}
          name="noInterest"
          render={({ field: { onChange, value } }) => (
            // The whole row toggles (touch area ≥ 44: the native switch alone is about 31 high).
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Sin intereses"
              accessibilityHint="Actívalo si el banco no cobra intereses por esta compra"
              accessibilityState={{ checked: value }}
              onPress={() => onChange(!value)}
              style={({ pressed }) => [styles.switchRow, pressed && styles.pressed]}
            >
              <View style={styles.switchText}>
                <Text>Sin intereses</Text>
                <Text variant="secondary" color="textSecondary">
                  Actívalo si el banco no cobra intereses por esta compra
                </Text>
              </View>
              <Switch
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                value={value}
                onValueChange={onChange}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.border}
              />
            </Pressable>
          )}
        />
        {appliesRate ? (
          <View style={styles.note} accessibilityLiveRegion="polite">
            <Text variant="secondary" color="primaryStrong">
              Se aplicará {formatRate(annualRate)} (estimado)
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

const styles = StyleSheet.create({
  fields: { gap: spacing.lg },
  switchRow: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  switchText: { flex: 1, gap: spacing.xs },
  note: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  actions: { gap: spacing.md },
  pressed: { opacity: interaction.pressedOpacity },
});
