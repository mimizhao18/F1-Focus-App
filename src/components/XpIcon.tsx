import Svg, { Polygon, Polyline } from 'react-native-svg';

import { useTheme } from '../design/styles';

/**
 * The XP icon: a thin-line hexagon badge with two rank-up chevrons inside, drawn as outlines like the credits coin
 * (CreditIcon) so the two sit together. The chevrons are in the accent red.
 */
export function XpIcon({ size = 18 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon points="12,1.8 21,7 21,17 12,22.2 3,17 3,7" fill="none" stroke={colors.coin} strokeWidth={1.6} strokeLinejoin="round" />
      <Polyline points="8,12.2 12,8.6 16,12.2" fill="none" stroke={colors.accentOnDark} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="8,16 12,12.4 16,16" fill="none" stroke={colors.accentOnDark} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
