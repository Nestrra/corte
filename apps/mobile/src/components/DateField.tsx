import { addMonths, clampedDate, parseIsoDate, toIsoDate, type IsoDate } from '@corte/domain';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { formatLongDate } from '../features/dates';
import { colors, interaction, layout, radius, spacing } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

export interface DateFieldProps {
  label: string;
  value: IsoDate;
  onChange: (date: IsoDate) => void;
  /** Latest selectable date (today for purchases). */
  maximumDate: IsoDate;
  /** Earliest selectable date. */
  minimumDate: IsoDate;
  error?: string;
}

/**
 * A business date ↔ a local `Date` at noon on that day. The picker works with local dates; noon
 * keeps a daylight saving change from moving the day, and only year, month and day are read back.
 */
function toPickerDate(date: IsoDate): Date {
  const { year, month, day } = parseIsoDate(date);
  return new Date(year, month - 1, day, 12);
}

function fromPickerDate(date: Date): IsoDate {
  return toIsoDate({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() });
}

/** `today` minus `months` months, clamped to the month end (same rule as validatePurchaseDate). */
export function monthsBefore(today: IsoDate, months: number): IsoDate {
  const { year, month, day } = parseIsoDate(today);
  const past = addMonths(year, month, -months);
  return clampedDate(past.year, past.month, day);
}

/**
 * Date field of contracts/screens.md → DateField: a button with the date in Spanish that opens the
 * native picker (dialog on Android, inline calendar on iOS) limited to [minimumDate, maximumDate].
 */
export function DateField({
  label,
  value,
  onChange,
  maximumDate,
  minimumDate,
  error,
}: DateFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const pickerProps = {
    value: toPickerDate(value),
    mode: 'date' as const,
    maximumDate: toPickerDate(maximumDate),
    minimumDate: toPickerDate(minimumDate),
  };

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        ...pickerProps,
        onValueChange: (_event, date) => onChange(fromPickerDate(date)),
      });
    } else {
      setIosOpen((current) => !current);
    }
  };

  const text = formatLongDate(value);
  return (
    <View style={styles.container}>
      <Text variant="secondary" color="textSecondary">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}`}
        accessibilityHint={error ?? 'Abre el selector de fecha'}
        accessibilityState={{ expanded: Platform.OS === 'ios' ? iosOpen : undefined }}
        onPress={open}
        style={({ pressed }) => [
          styles.field,
          { borderColor: error ? colors.danger : colors.border },
          pressed && styles.pressed,
        ]}
      >
        <Text>{text}</Text>
      </Pressable>
      {Platform.OS === 'ios' && iosOpen ? (
        <View style={styles.inline}>
          <DateTimePicker
            {...pickerProps}
            display="inline"
            locale="es-CO"
            accentColor={colors.primary}
            onValueChange={(_event, date) => onChange(fromPickerDate(date))}
          />
          <Button label="Listo" variant="secondary" onPress={() => setIosOpen(false)} />
        </View>
      ) : null}
      {error ? (
        <Text variant="secondary" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  field: {
    minHeight: layout.minTouchTarget,
    borderWidth: 1,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  inline: {
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  pressed: { opacity: interaction.pressedOpacity },
});
