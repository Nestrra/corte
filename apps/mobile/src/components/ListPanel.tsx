import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

/** A `surface` panel whose rows are separated by `divider` lines (docs/design-system.md). */
export function ListPanel({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.panel}>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <View style={styles.divider} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.divider, marginLeft: spacing.lg },
});
