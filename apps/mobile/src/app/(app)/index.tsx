import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { useSessionStore } from '../../session/session-store';
import { spacing } from '../../theme';

/** Temporary home (contracts/screens.md): the full home arrives with the cards spec. */
export default function HomeScreen() {
  const name = useSessionStore((state) => state.user?.name ?? '');

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Hola, {name}
        </Text>
        <Text color="textSecondary">
          Pronto verás aquí tus tarjetas y lo que debes pagar en cada corte.
        </Text>
      </View>
      <Button label="Perfil" variant="secondary" onPress={() => router.push('/profile')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
});
