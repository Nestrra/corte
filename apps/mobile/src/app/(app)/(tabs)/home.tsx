import { StyleSheet, View } from 'react-native';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { useSessionStore } from '../../../session/session-store';
import { spacing } from '../../../theme';

/** Temporary home (spec 001); the full home arrives in a later spec. Profile is now a tab. */
export default function HomeScreen() {
  const name = useSessionStore((state) => state.user?.name ?? '');

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Hola, {name}
        </Text>
        <Text color="textSecondary">
          Pronto verás aquí tus tarjetas y lo que debes pagar en cada corte.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
});
