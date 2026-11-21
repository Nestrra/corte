// Spacing, layout and radius tokens from docs/design-system.md.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
} as const;

export const layout = {
  /** Horizontal screen margin. */
  screenMargin: 20,
  /** Vertical gap between screen sections. */
  sectionGap: 28,
  /** Minimum touch target (WCAG / design-system rule 3). */
  minTouchTarget: 44,
} as const;

export const radius = { chip: 8, control: 12, panel: 16, card: 24, full: 999 } as const;

export type SpacingToken = keyof typeof spacing;

/** Interaction states (docs/design-system.md → Interacción). */
export const interaction = { pressedOpacity: 0.7 } as const;
