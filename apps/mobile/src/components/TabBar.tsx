import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, interaction, layout, radius, spacing } from '../theme';
import { useFrontCardStore } from '../features/front-card-store';
import { Text } from './Text';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Icon of each tab route: outline when inactive, filled when active. */
const icons: Record<string, { active: IconName; inactive: IconName }> = {
  home: { active: 'home', inactive: 'home-outline' },
  cards: { active: 'card', inactive: 'card-outline' },
  payments: { active: 'calendar', inactive: 'calendar-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

const ICON_SIZE = 24;
/** Route drawn as the center button instead of a tab (spec 004 research.md R8). */
export const REGISTER_ROUTE = 'register';

/**
 * Center "Registrar compra" button (docs/design-system.md → TabBar): a `primary` circle of 56
 * with the `add` icon in `onPrimary` (6.29:1). It opens the register screen over the current tab
 * with the card in front of the home preselected; it never becomes the selected tab.
 */
function RegisterButton() {
  const frontCardId = useFrontCardStore((state) => state.frontCardId);
  return (
    <View style={styles.tab}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Registrar compra"
        onPress={() =>
          router.push({
            pathname: '/purchase/new',
            params: frontCardId === null ? {} : { cardId: frontCardId },
          })
        }
        style={({ pressed }) => [styles.center, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={ICON_SIZE} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

/**
 * Bottom tab bar from docs/design-system.md (contracts/screens.md → TabBar): Inicio, Tarjetas,
 * the center "Registrar compra" button and Perfil (Pagos arrives in spec 006). `surface`
 * background with a `border` top line; the active tab uses `primary` and the 600 weight
 * (`tabActive`), so it is told apart by more than color. Each tab is at least 44 × 44.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
    >
      {state.routes.map((route, index) => {
        if (route.name === REGISTER_ROUTE) return <RegisterButton key={route.key} />;
        const focused = index === state.index;
        const label = descriptors[route.key]?.options.title ?? route.name;
        const icon = icons[route.name];

        const onPress = () => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            {icon ? (
              <Ionicons
                name={focused ? icon.active : icon.inactive}
                size={ICON_SIZE}
                color={focused ? colors.primary : colors.textSecondary}
              />
            ) : null}
            <Text
              variant={focused ? 'tabActive' : 'tab'}
              color={focused ? 'primary' : 'textSecondary'}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: layout.minTouchTarget,
    minWidth: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  center: {
    width: layout.tabCenterButton,
    height: layout.tabCenterButton,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: interaction.pressedOpacity },
});
