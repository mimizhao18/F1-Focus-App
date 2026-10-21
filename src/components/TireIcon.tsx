import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { useTheme } from '../design/styles';
import type { Theme } from '../design/tokens';
import { TIRES } from '../logic/strategy';
import type { Compound } from '../models/types';

/** The sidewall color of each compound. */
export function tireColor(colors: Theme['colors'], compound: Compound): string {
  return compound === 'soft' ? colors.tireSoft : compound === 'medium' ? colors.tireMedium : colors.tireHard;
}

const SPOKES = [0, 72, 144, 216, 288];
// the colored band runs round the sidewall in two arcs, with gaps where a real tire has its lettering
const BAND_RADIUS = 38;
const BAND_ARC = (2 * Math.PI * BAND_RADIUS) / 2;

/**
 * A tire seen side on, like the ones on a race strategy graphic: black rubber with the compound's colored band, and a
 * silver rim. With `letter` the hub carries the compound's letter (S, M, H), so it reads without the color too.
 */
export function TireIcon({ compound, size, letter = false, dimmed = false }: { compound: Compound; size?: number; letter?: boolean; dimmed?: boolean }) {
  const t = useTheme();
  const px = size ?? t.size.tire;
  const color = tireColor(t.colors, compound);
  return (
    <Svg width={px} height={px} viewBox="0 0 100 100" opacity={dimmed ? t.opacity.dimmed : 1} accessibilityLabel={`${TIRES[compound].name} tire`}>
      <Circle cx={50} cy={50} r={48} fill={t.colors.rubber} stroke={t.colors.border} strokeWidth={2} />
      <Circle
        cx={50}
        cy={50}
        r={BAND_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${BAND_ARC * 0.78} ${BAND_ARC * 0.22}`}
        transform="rotate(-50 50 50)"
      />
      <Circle cx={50} cy={50} r={27} fill={t.colors.rimDark} />
      <Circle cx={50} cy={50} r={23} fill="none" stroke={t.colors.rim} strokeWidth={3} />
      {letter ? (
        <>
          <Circle cx={50} cy={50} r={17} fill={t.colors.rubber} />
          <SvgText x={50} y={58} fontSize={24} fontFamily={t.typography.heading.fontFamily} fontWeight="600" fill={color} textAnchor="middle">
            {TIRES[compound].letter}
          </SvgText>
        </>
      ) : (
        <G>
          {SPOKES.map((angle) => (
            <Line key={angle} x1={50} y1={41} x2={50} y2={28} stroke={t.colors.rim} strokeWidth={4} strokeLinecap="round" transform={`rotate(${angle} 50 50)`} />
          ))}
          <Circle cx={50} cy={50} r={9} fill={t.colors.rim} />
        </G>
      )}
    </Svg>
  );
}
