import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, interaction, layout, spacing } from '../theme';
import { Text } from './Text';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Icon of each tab route: outline when inactive, filled when active. */
const icons: Record<string, { active: IconName; inactive: IconName }> = {
  home: { active: 'home', inactive: 'home-outline' },
  cards: { active: 'card', inactive: 'card-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

const ICON_SIZE = 24;

/**
 * Bottom tab bar from docs/design-system.md (contracts/screens.md → TabBar): `surface` background
 * with a `border` top line; the active tab uses `primary` and the 600 weight (`tabActive`), so it
 * is told apart by more than color. Each tab is at least 44 × 44.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
    >
      {state.routes.map((route, index) => {
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
  pressed: { opacity: interaction.pressedOpacity },
});
