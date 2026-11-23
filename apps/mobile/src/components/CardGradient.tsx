import type { CardColor } from '@corte/domain';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { cardColors, cardGradient } from '../theme';

export interface CardGradientProps {
  color: CardColor;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** Diagonal gradient of a card color (docs/design-system.md → Colores de tarjeta). */
export function CardGradient({ color, style, children }: CardGradientProps) {
  return (
    <LinearGradient
      colors={cardColors[color].gradient}
      start={cardGradient.start}
      end={cardGradient.end}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}
