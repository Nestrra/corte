import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { logout } from '../../../api/auth';
import { getMe } from '../../../api/me';
import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { timeZoneLabel } from '../../../features/timezones';
import { useSessionStore } from '../../../session/session-store';
import { colors, interaction, layout, radius, spacing, type ColorToken } from '../../../theme';

interface RowProps {
  label: string;
  value?: string;
  href: Href;
  color?: ColorToken;
}

/** Tappable row of the profile panel (height ≥ 44, text plus a chevron, not color alone). */
function Row({ label, value, href, color = 'text' }: RowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text color={color}>{label}</Text>
      <View style={styles.rowEnd}>
        {value ? (
          <Text variant="secondary" color="textSecondary" numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        <Text color="textTertiary">›</Text>
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const user = useSessionStore((state) => state.user);
  const setUser = useSessionStore((state) => state.setUser);
  const [loggingOut, setLoggingOut] = useState(false);

  // Refreshes the profile from the API; a revoked session sends the user to login (client.ts).
  const me = useQuery({ queryKey: ['me'], queryFn: getMe, retry: false });
  useEffect(() => {
    if (me.data) setUser(me.data);
  }, [me.data, setUser]);

  if (user === null) return null;

  const onLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  return (
    <Screen edges={['top']}>
      <Text variant="title" accessibilityRole="header">
        Perfil
      </Text>
      <View style={styles.identity}>
        <Text variant="section">{user.name}</Text>
        <Text color="textSecondary">{user.email}</Text>
      </View>

      <View style={styles.panel}>
        <Row label="Zona horaria" value={timeZoneLabel(user.timezone)} href="/timezone" />
        <View style={styles.divider} />
        <Row label="Cambiar contraseña" href="/change-password" />
        <View style={styles.divider} />
        <Row label="Eliminar cuenta" href="/delete-account" color="danger" />
      </View>

      <Button
        label="Cerrar sesión"
        variant="secondary"
        onPress={() => void onLogout()}
        loading={loggingOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { gap: spacing.xs },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  pressed: { opacity: interaction.pressedOpacity },
  divider: { height: 1, backgroundColor: colors.divider, marginLeft: spacing.lg },
});
