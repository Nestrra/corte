import { PURCHASE_MAX_AGE_MONTHS, type IsoDate } from '@corte/domain';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch, type Control, type FieldPath } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { simulatePurchase, type CreatePurchase } from '../api/purchases';
import { errorText, purchaseFieldErrorText } from '../api/errors';
import { applyApiFieldErrors } from '../features/forms';
import { formatCop, parseAmountInput } from '../features/money';
import {
  chargesInterest,
  PURCHASE_FORM_FIELDS,
  purchaseFormSchema,
  simulationMissing,
  toPurchaseInput,
  toSimulateInput,
  type PurchaseFormValues,
} from '../features/purchase-schema';
import { useDebouncedValue } from '../features/use-debounced-value';
import { formatRate } from '../features/rate';
import { colors, interaction, layout, radius, spacing } from '../theme';
import { Button } from './Button';
import { DateField, monthsBefore } from './DateField';
import { SimulationPanel } from './SimulationPanel';
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
  /**
   * Card to simulate on (spec 004 FR-007, FR-013). With it the form shows the live simulation;
   * without it (editing a purchase) it does not. It can change without resetting the form.
   */
  simulateOnCardId?: string;
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

/** Wait after the last change before simulating (spec 004 SC-003: under 1 s in total). */
const SIMULATION_DELAY_MS = 350;
/** Old simulations are dropped from the cache soon; they are never shown for other values. */
const SIMULATION_CACHE_MS = 30_000;

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
  simulateOnCardId,
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
  const [amount, purchaseDate, installmentCount, noInterest] = useWatch({
    control,
    name: ['amount', 'purchaseDate', 'installmentCount', 'noInterest'],
  });

  // Live simulation (spec 004 research.md R7): only valid values are sent, 350 ms after the last
  // change. Each combination is its own query key, so a late answer for earlier values is never
  // shown for the current ones, and the previous request is cancelled through its signal.
  const fields = { amount, purchaseDate, installmentCount, noInterest };
  const missing = simulateOnCardId === undefined ? null : simulationMissing(fields, today);
  const request =
    simulateOnCardId !== undefined && missing === null
      ? { cardId: simulateOnCardId, input: toSimulateInput(fields) }
      : null;
  const debounced = useDebouncedValue(request, SIMULATION_DELAY_MS);
  const simulation = useQuery({
    queryKey: ['simulation', debounced?.cardId, debounced?.input],
    queryFn: ({ signal }) => {
      if (debounced === null) throw new Error('No simulation requested');
      return simulatePurchase(debounced.cardId, debounced.input, signal);
    },
    enabled: debounced !== null,
    placeholderData: keepPreviousData,
    staleTime: 0,
    gcTime: SIMULATION_CACHE_MS,
    retry: false,
  });
  const stale =
    simulation.isPlaceholderData ||
    simulation.isFetching ||
    JSON.stringify(request) !== JSON.stringify(debounced);

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
        {simulateOnCardId !== undefined ? (
          <SimulationPanel
            simulation={simulation.data}
            missing={missing}
            stale={stale}
            error={simulation.error}
            onRetry={() => void simulation.refetch()}
            retrying={simulation.isFetching}
          />
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
