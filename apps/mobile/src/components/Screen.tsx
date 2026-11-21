import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, layout } from '../theme';

export interface ScreenProps {
  children: ReactNode;
  /** Vertically centers short content (login, register). */
  centered?: boolean;
  /** Safe-area edges; screens under a native header skip the top edge. */
  edges?: Edge[];
}

/** Screen container: safe area, keyboard avoidance and scroll, theme spacing only. */
export function Screen({ children, centered = false, edges = ['top', 'bottom'] }: ScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, centered && styles.centered]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.screenMargin,
    paddingVertical: layout.sectionGap,
    gap: layout.sectionGap,
  },
  centered: { justifyContent: 'center' },
});
