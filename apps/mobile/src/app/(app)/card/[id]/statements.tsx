import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { listStatements, statementKeys } from '../../../../api/statements';
import { Button } from '../../../../components/Button';
import { ListPanel } from '../../../../components/ListPanel';
import { QueryError } from '../../../../components/QueryError';
import { Screen } from '../../../../components/Screen';
import { StatementRow } from '../../../../components/StatementRow';
import { Text } from '../../../../components/Text';
import { useRefetchOnFocus } from '../../../../features/use-refetch-on-focus';
import { colors } from '../../../../theme';

/**
 * Statements of a card (spec 003 US3) in the API order (FR-018): unpaid by cutoff, then paid.
 * Refetched on focus because the status depends on "today".
 */
export default function StatementsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const statements = useQuery({
    queryKey: statementKeys.list(id),
    queryFn: () => listStatements(id),
  });
  useRefetchOnFocus(statements.refetch);

  if (statements.isPending) {
    return (
      <Screen edges={['bottom']}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando extractos" />
      </Screen>
    );
  }
  if (statements.isError) {
    return (
      <Screen edges={['bottom']}>
        <QueryError
          error={statements.error}
          onRetry={() => void statements.refetch()}
          retrying={statements.isFetching}
        />
      </Screen>
    );
  }

  if (statements.data.length === 0) {
    return (
      <Screen edges={['bottom']}>
        <Text variant="section" accessibilityRole="header">
          Aún no hay extractos
        </Text>
        <Text color="textSecondary">
          Los extractos aparecen cuando registras compras en esta tarjeta.
        </Text>
        <Button
          label="Registrar compra"
          onPress={() => router.push({ pathname: '/card/[id]/purchases/new', params: { id } })}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <ListPanel>
        {statements.data.map((statement) => (
          <StatementRow
            key={statement.id}
            statement={statement}
            onPress={() =>
              router.push({ pathname: '/statement/[id]', params: { id: statement.id } })
            }
          />
        ))}
      </ListPanel>
    </Screen>
  );
}
