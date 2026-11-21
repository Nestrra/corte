import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../api/config';
import { useHealthQuery, type ConnectionStatus } from '../api/health';
import { Button } from '../components/Button';
import { Text } from '../components/Text';
import { colors, layout, spacing, type ColorToken } from '../theme';

/**
 * Temporary connection screen (contracts/health-screen.md). It will be replaced by the home
 * screen in a later spec.
 */

const statusText: Record<ConnectionStatus['kind'], string> = {
  checking: 'Comprobando conexión…',
  connected: 'Conectado',
  disconnected: 'Sin conexión',
};

// Color only reinforces the text (principle IX: states never rely on color alone).
const statusColor: Record<ConnectionStatus['kind'], ColorToken> = {
  checking: 'textSecondary',
  connected: 'success',
  disconnected: 'danger',
};

export default function HealthScreen() {
  const { status, refetch, isFetching } = useHealthQuery(API_URL);

  const detail =
    status.kind === 'disconnected' && status.reason === 'missing-config'
      ? 'Falta configurar EXPO_PUBLIC_API_URL'
      : `API: ${API_URL ?? ''}`;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text variant="title" accessibilityRole="header">
          Corte
        </Text>

        <View style={styles.status}>
          <Text
            variant="section"
            color={statusColor[status.kind]}
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
          >
            {statusText[status.kind]}
          </Text>
          <Text variant="secondary" color="textSecondary">
            {detail}
          </Text>
        </View>

        <Button
          label="Reintentar"
          onPress={() => void refetch()}
          loading={isFetching}
          disabled={API_URL === null}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenMargin,
    gap: layout.sectionGap,
  },
  status: { gap: spacing.sm },
});
