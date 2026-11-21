import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, typography, type ColorToken, type TypographyToken } from '../theme';

export interface TextProps extends RNTextProps {
  /** Typography token from the design system. Default: `body`. */
  variant?: TypographyToken;
  /** Color token from the design system. Default: `text`. */
  color?: ColorToken;
}

/** Base text component: only theme tokens, no loose values (principle IX). */
export function Text({ variant = 'body', color = 'text', style, ...props }: TextProps) {
  return <RNText {...props} style={[typography[variant], { color: colors[color] }, style]} />;
}
