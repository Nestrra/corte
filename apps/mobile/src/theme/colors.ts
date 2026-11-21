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
  /** Text on `primary` buttons and on credit cards. */
  onPrimary: '#FFFFFF',
  /** Secondary text on credit cards. */
  onCardSecondary: 'rgba(255,255,255,0.8)',
} as const;

/** The user picks one when creating a card; the key is stored, not the hex value. */
export const cardColors = {
  indigo: '#3730A3',
  petroleo: '#0F4C5C',
  ciruela: '#5B2A6E',
  grafito: '#1F2937',
  bosque: '#166534',
  terracota: '#9A3412',
} as const;

export type ColorToken = keyof typeof colors;
export type CardColorKey = keyof typeof cardColors;
