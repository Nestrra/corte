import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorText } from '../../api/errors';
import { updateTimezone } from '../../api/me';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { filterTimeZones, timeZoneLabel, type TimeZoneOption } from '../../features/timezones';
import { useSessionStore } from '../../session/session-store';
import { colors, interaction, layout, spacing } from '../../theme';

export default function TimezoneScreen() {
  const current = useSessionStore((state) => state.user?.timezone ?? '');
  const setUser = useSessionStore((state) => state.setUser);
  const [query, setQuery] = useState('');

  const save = useMutation({
    mutationFn: updateTimezone,
    onSuccess: (user) => {
      setUser(user);
      router.back();
    },
  });

  const options = useMemo(() => {
    const filtered = filterTimeZones(query);
    // The saved zone is shown even when it is not in the curated list (research.md R6).
    const inList = filtered.some((zone) => zone.id === current);
    const showCurrent = !inList && current !== '' && query.trim() === '';
    return showCurrent
      ? [{ id: current, label: timeZoneLabel(current) } as TimeZoneOption, ...filtered]
      : filtered;
  }, [query, current]);

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <View style={styles.search}>
        <TextField
          label="Buscar"
          placeholder="País o ciudad"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {save.isError ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {errorText(save.error)}
          </Text>
        ) : null}
      </View>
      <FlatList
        data={options}
        keyExtractor={(zone) => zone.id}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        ListEmptyComponent={
          <Text color="textSecondary" style={styles.empty}>
            No hay zonas que coincidan con la búsqueda
          </Text>
        }
        renderItem={({ item }) => {
          const isCurrent = item.id === current;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isCurrent ? `${item.label}, actual` : item.label}
              accessibilityState={{ selected: isCurrent, disabled: save.isPending }}
              disabled={save.isPending}
              onPress={() => (isCurrent ? router.back() : save.mutate(item.id))}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text>{item.label}</Text>
                <Text variant="caption" color="textTertiary">
                  {item.id}
                </Text>
              </View>
              {isCurrent ? (
                <Text variant="bodyStrong" color="primaryStrong">
                  Actual
                </Text>
              ) : save.isPending && save.variables === item.id ? (
                <Text variant="secondary" color="textSecondary">
                  Guardando…
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  search: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  rowText: { flexShrink: 1, gap: spacing.xs },
  pressed: { opacity: interaction.pressedOpacity },
  divider: { height: 1, backgroundColor: colors.divider },
  empty: { paddingHorizontal: layout.screenMargin },
});
