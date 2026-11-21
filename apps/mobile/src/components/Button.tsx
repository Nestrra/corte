import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { colors, interaction, layout, radius, spacing } from '../theme';
import { Text } from './Text';

type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  /** `primary`: `primary` background, white text. `secondary`: `primarySoft` background. */
  variant?: ButtonVariant;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}

const variantStyles = {
  primary: { background: colors.primary, text: 'onPrimary' },
  secondary: { background: colors.primarySoft, text: 'primaryStrong' },
} as const;

/** Base button from docs/design-system.md: height ≥ 44, radius 12, theme tokens only. */
export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled === true || loading;
  const { background, text } = variantStyles[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: background },
        (pressed || isDisabled) && styles.dimmed,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors[text]} />
      ) : (
        <Text variant="bodyStrong" color={text}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouchTarget,
    minWidth: layout.minTouchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: interaction.pressedOpacity },
});
