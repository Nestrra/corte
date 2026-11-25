import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, radius, spacing } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

const ICON_SIZE = spacing['3xl'];
const ICON_CIRCLE = spacing['4xl'] + spacing['2xl'];

export interface PermissionIntroProps {
  onActivate: () => void;
  onSkip: () => void;
  /** While the system prompt and the registration run. */
  busy: boolean;
}

/**
 * PermissionIntro (specs/006-alerts-reminders/contracts/screens.md): why notifications matter,
 * before the system prompt. `primary` icon on `primarySoft`, `title`, `body` and the two buttons
 * at the bottom.
 */
export function PermissionIntro({ onActivate, onSkip, busy }: PermissionIntroProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.iconCircle} accessibilityElementsHidden importantForAccessibility="no">
          <Ionicons name="notifications-outline" size={ICON_SIZE} color={colors.primary} />
        </View>
        <Text variant="title" accessibilityRole="header" style={styles.center}>
          Activa las notificaciones
        </Text>
        <Text style={styles.center}>
          Te avisamos cuando te acerques al tope de una tarjeta, unos días antes del corte y de la
          fecha límite, y antes de cada pago fijo. Puedes cambiarlo cuando quieras en Perfil.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Activar notificaciones" onPress={onActivate} loading={busy} />
        <Button label="Ahora no" variant="secondary" onPress={onSkip} disabled={busy} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: layout.screenMargin,
    paddingVertical: layout.sectionGap,
    justifyContent: 'space-between',
  },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  iconCircle: {
    width: ICON_CIRCLE,
    height: ICON_CIRCLE,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  actions: { gap: spacing.md },
});
