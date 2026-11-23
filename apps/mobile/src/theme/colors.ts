// Values copied exactly from docs/design-system.md (constitution, principle IX).

export const colors = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  border: '#E4E7EC',
  divider: '#F2F4F7',
  text: '#101828',
  textSecondary: '#475467',
  textTertiary: '#667085',
  primary: '#4F46E5',
  primaryStrong: '#3730A3',
  primarySoft: '#EEF0FF',
  success: '#067647',
  successSoft: '#ECFDF3',
  warning: '#B54708',
  warningSoft: '#FFFAEB',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  /** Text on `primary` buttons. */
  onPrimary: '#FFFFFF',
} as const;

/**
 * Card colors (docs/design-system.md → Colores de tarjeta). The user picks a key; the key is
 * stored, not the values. Each card is a diagonal gradient from `gradient[0]` (top left) to
 * `gradient[1]` (bottom right) with its own text colors. `textSecondary` reaches WCAG AA (4.5:1)
 * on both ends of the gradient: 80% opacity where it is enough, 95% on naranja and verde, whose
 * light end leaves 80% below 3.9:1.
 */
export const cardColors = {
  negro: {
    gradient: ['#111827', '#4B5563'],
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.8)',
  },
  morado: {
    gradient: ['#4C1D95', '#7E22CE'],
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.8)',
  },
  amarillo: {
    gradient: ['#F59E0B', '#FDE047'],
    text: '#1F1300',
    textSecondary: 'rgba(31,19,0,0.8)',
  },
  naranja: {
    gradient: ['#9A3412', '#C2410C'],
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.95)',
  },
  verde: {
    gradient: ['#14532D', '#15803D'],
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.95)',
  },
  marron: {
    gradient: ['#451A03', '#78350F'],
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.8)',
  },
} as const satisfies Record<
  string,
  { gradient: readonly [string, string]; text: string; textSecondary: string }
>;

/** Direction of the card gradient: top left → bottom right. */
export const cardGradient = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;

export type ColorToken = keyof typeof colors;
export type CardColorKey = keyof typeof cardColors;
