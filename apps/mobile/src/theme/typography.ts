import type { TextStyle } from 'react-native';

// Typography tokens from docs/design-system.md. Each weight is a separate font family
// (names exported by @expo-google-fonts), so `fontWeight` is not set: Android would
// otherwise synthesize bold on top of an already bold family.

export const fontFamilies = {
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  jakartaSemiBold: 'PlusJakartaSans_600SemiBold',
  jakartaBold: 'PlusJakartaSans_700Bold',
} as const;

export const typography = {
  amount: {
    fontFamily: fontFamilies.jakartaBold,
    fontSize: 32,
    lineHeight: 40,
    fontVariant: ['tabular-nums'],
  },
  title: { fontFamily: fontFamilies.jakartaBold, fontSize: 24, lineHeight: 32 },
  section: { fontFamily: fontFamilies.jakartaBold, fontSize: 20, lineHeight: 28 },
  body: { fontFamily: fontFamilies.interRegular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fontFamilies.interSemiBold, fontSize: 15, lineHeight: 22 },
  secondary: { fontFamily: fontFamilies.interRegular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fontFamilies.interMedium, fontSize: 12, lineHeight: 16 },
  tab: { fontFamily: fontFamilies.interMedium, fontSize: 11, lineHeight: 14 },
  tabActive: { fontFamily: fontFamilies.interSemiBold, fontSize: 11, lineHeight: 14 },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
