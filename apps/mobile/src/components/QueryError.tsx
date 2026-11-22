import { StyleSheet, View } from 'react-native';
import { errorText } from '../api/errors';
import { spacing } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

export interface QueryErrorProps {
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
}

/** A failed load: the error in text and "Reintentar". */
export function QueryError({ error, onRetry, retrying = false }: QueryErrorProps) {
  return (
    <View style={styles.container}>
      <Text color="danger" accessibilityLiveRegion="polite">
        {errorText(error)}
      </Text>
      <Button label="Reintentar" variant="secondary" onPress={onRetry} loading={retrying} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
});
