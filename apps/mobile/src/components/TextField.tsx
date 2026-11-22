import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, layout, radius, spacing, typography } from '../theme';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Error text shown below the field; also turns the border `danger`. */
  error?: string;
  /** Help text shown when there is no error. */
  hint?: string;
  /** `email`: email keyboard, no autocapitalization. `password`: hidden text. */
  kind?: 'text' | 'email' | 'password';
}

const kindProps: Record<NonNullable<TextFieldProps['kind']>, TextInputProps> = {
  text: {},
  email: {
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoCorrect: false,
    autoComplete: 'email',
    textContentType: 'emailAddress',
  },
  password: {
    secureTextEntry: true,
    autoCapitalize: 'none',
    autoCorrect: false,
  },
};

/**
 * Labeled input from contracts/screens.md: height ≥ 44, radius 12, `border` color (`danger` with
 * an error text below), theme tokens only (principle IX).
 */
export function TextField({
  label,
  error,
  hint,
  kind = 'text',
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.container}>
      <Text variant="secondary" color="textSecondary">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, { borderColor }]}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...kindProps[kind]}
        {...props}
      />
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textTertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  input: {
    ...typography.body,
    color: colors.text,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
});
