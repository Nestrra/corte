import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

/**
 * Invitation to add the first card (spec 004 US4; contracts/screens.md → EmptyCards), on the home
 * and on "Registrar compra". With `replace`, the new-card screen takes this one's place.
 */
export function EmptyCards({ replace = false }: { replace?: boolean }) {
  return (
    <View style={styles.panel}>
      <Text variant="section" accessibilityRole="header">
        Agrega tu primera tarjeta
      </Text>
      <Text color="textSecondary">Así sabrás cuánto y cuándo pagar cada tarjeta.</Text>
      <Button
        label="Agregar tarjeta"
        onPress={() => (replace ? router.replace('/card/new') : router.push('/card/new'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});
