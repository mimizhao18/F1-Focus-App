import { Text, View } from 'react-native';

import { makeStyles, useTheme } from '../design/styles';
import { TIRES, stintRanges } from '../logic/strategy';
import type { Stint } from '../models/types';
import { TireIcon, tireColor } from './TireIcon';

const SLASHES = [0, 1, 2];
const LABEL_WIDTH = 72;

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  // three short slanted strokes in the first tire's color where the line starts, as on a race strategy graphic
  slashes: { flexDirection: 'row', gap: t.spacing.xxs },
  slash: { width: t.size.line + 1, height: t.spacing.sm + 2, transform: [{ skewX: '-24deg' }] },
  lane: { flex: 1, justifyContent: 'center' },
  line: { position: 'absolute', left: 0, right: 0, flexDirection: 'row' },
  pin: { position: 'absolute', top: 0 },
  label: { position: 'absolute', width: LABEL_WIDTH, marginLeft: -LABEL_WIDTH / 2, textAlign: 'center', ...t.typography.microLabel, color: t.colors.textSecondary },
  labelNumber: { fontFamily: t.typography.microMono.fontFamily, color: t.colors.text },
}));

/** A stint's length in whole minutes, as shown under its part of the line: "32 min". */
function stintMinutes(laps: number, lapSeconds: number): number {
  return Math.max(1, Math.round((laps * lapSeconds) / 60));
}

/**
 * A race's tire strategy as one line, like the strategy graphics on a race broadcast: the line takes each stint's
 * color for its share of the laps, and a tire marks the end of each stint. With `labels` each pit stop says its lap,
 * and with `lapSeconds` each stint says how many minutes it runs, under its part of the line.
 * Laps after `completedLaps` (a race that ended early) are faded.
 */
export function TireStrategyBar({
  stints,
  size = 'large',
  labels = false,
  lapSeconds,
  completedLaps,
}: {
  stints: readonly Stint[];
  size?: 'large' | 'small';
  labels?: boolean;
  lapSeconds?: number;
  completedLaps?: number;
}) {
  const styles = useStyles();
  const t = useTheme();
  const total = stints.reduce((sum, s) => sum + s.laps, 0);
  if (total === 0) return null;
  const iconSize = size === 'large' ? t.size.tire : t.size.tireSmall;
  const lineHeight = size === 'large' ? t.size.line * 2 : t.size.line;
  const labelHeight = t.typography.microLabel.lineHeight + t.spacing.xs;
  const done = completedLaps ?? total;

  const ends = stintRanges(stints).map((range, i) => ({ stint: stints[i], start: range.from - 1, end: range.to }));

  return (
    <View
      style={[styles.row, { paddingTop: labels ? labelHeight : 0, paddingBottom: lapSeconds ? labelHeight : 0, paddingRight: iconSize / 2 }]}
      accessible
      accessibilityLabel={stints.map((s) => `${s.laps} laps on ${TIRES[s.compound].name.toLowerCase()}s`).join(', then ')}
    >
      {size === 'large' && (
        <View style={styles.slashes}>
          {SLASHES.map((i) => (
            <View key={i} style={[styles.slash, { backgroundColor: tireColor(t.colors, stints[0].compound) }]} />
          ))}
        </View>
      )}
      <View style={[styles.lane, { height: iconSize }]}>
        <View style={[styles.line, { top: (iconSize - lineHeight) / 2, height: lineHeight }]}>
          {ends.map(({ stint, start, end }, i) => {
            // a stint the race did not finish is drawn faded from the point the race ended
            const ran = Math.max(0, Math.min(end, done) - start);
            const color = tireColor(t.colors, stint.compound);
            return [
              ran > 0 ? <View key={`${i}a`} style={{ flex: ran, backgroundColor: color }} /> : null,
              ran < stint.laps ? <View key={`${i}b`} style={{ flex: stint.laps - ran, backgroundColor: color, opacity: t.opacity.disabled / 2 }} /> : null,
            ];
          })}
        </View>
        {ends.map(({ stint, end }, i) => (
          <View key={i} style={[styles.pin, { left: `${(end / total) * 100}%`, marginLeft: -iconSize / 2 }]}>
            <TireIcon compound={stint.compound} size={iconSize} dimmed={end > done} />
          </View>
        ))}
        {labels &&
          ends.slice(0, -1).map(({ end }, i) => (
            <Text key={`l${i}`} style={[styles.label, { left: `${(end / total) * 100}%`, bottom: iconSize + t.spacing.xxs }]} numberOfLines={1}>
              Lap <Text style={styles.labelNumber}>{end}</Text>
            </Text>
          ))}
        {lapSeconds !== undefined &&
          ends.map(({ stint, start, end }, i) => (
            <Text key={`m${i}`} style={[styles.label, { left: `${((start + end) / 2 / total) * 100}%`, top: iconSize + t.spacing.xxs }]} numberOfLines={1}>
              <Text style={styles.labelNumber}>{stintMinutes(stint.laps, lapSeconds)}</Text> min
            </Text>
          ))}
      </View>
    </View>
  );
}
