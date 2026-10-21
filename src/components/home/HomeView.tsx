import { Text, View } from 'react-native';

import { getLivery } from '../../data/liveries';
import { makeStyles } from '../../design/styles';
import { formatDistance } from '../../logic/settings';
import { useSettings } from '../../ui/useSettings';
import { glowHexFor } from '../car3d/glow';
import { DriverTag } from '../DriverTag';
import { HeroCar } from '../HeroCar';
import { AmbientGlow, BracketFrame, CreditAmount, SegmentedProgress, StartButton } from '../ui';
import type { HomeData } from './useHomeData';

const useStyles = makeStyles((t) => ({
  screen: { flex: 1 },
  content: { flex: 1, padding: t.spacing.screen, gap: t.spacing.md },
  // level, credits and the XP bar under them, all 12 px and the same width as everything else on the screen
  top: { gap: t.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pair: { flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.sm },
  metaLabel: { ...t.typography.metaLabel, color: t.colors.textMuted },
  metaValue: { ...t.typography.metaValue, color: t.colors.text },
  xp: { ...t.typography.metaValue, color: t.colors.textMuted },
  car: { flex: 1, marginHorizontal: -t.spacing.screen },
  // the stats are the quietest thing on screen: small figures in a corner-ticked strip
  strip: { flexDirection: 'row', paddingVertical: t.spacing.sm },
  cell: { flex: 1, alignItems: 'center', gap: t.spacing.xxs },
  divided: { borderLeftWidth: t.border.hairline, borderLeftColor: t.glass.divider },
  statValue: { ...t.typography.statSmall, color: t.colors.text },
}));

/**
 * Home, in order of importance: the car and the Start button, then the level line with a thin XP bar and the XP count under it, and a
 * corner-ticked strip of stats. A soft glow in the car's color sits behind everything.
 */
export function HomeView({ data, onStart }: { data: HomeData; onStart: () => void }) {
  const styles = useStyles();
  const settings = useSettings();
  const { profile, stats, level, streak } = data;
  const livery = getLivery(profile.car.liveryId);
  const distance = formatDistance(stats.distanceKm, settings.distanceUnit, 0);
  const figures = [
    { label: 'Streak', value: `${streak} ${streak === 1 ? 'day' : 'days'}` },
    { label: 'Races', value: String(stats.races) },
    { label: 'Distance', value: `${distance.value} ${distance.unit}` },
  ];

  return (
    <View style={styles.screen}>
      <AmbientGlow color={glowHexFor(livery.primary, livery.secondary)} />
      <View style={styles.content}>
        <View style={styles.top}>
          <DriverTag />
          <View style={styles.row}>
            <View style={styles.pair} accessible accessibilityLabel={`Level ${level.level}`}>
              <Text style={styles.metaLabel}>Level</Text>
              <Text style={styles.metaValue}>{level.level}</Text>
            </View>
            <CreditAmount amount={profile.credits} size="meta" />
          </View>
          <SegmentedProgress fraction={level.fraction} accessibilityLabel={`XP: ${level.xpIntoLevel} of ${level.xpForNextLevel} to the next level`} />
          <Text style={styles.xp}>
            {level.xpIntoLevel} / {level.xpForNextLevel}
          </Text>
        </View>
        <View style={styles.car}>
          <HeroCar car={profile.car} autoSpin={false} background="transparent" zoom={0.88} />
        </View>
        <BracketFrame style={styles.strip}>
          {figures.map((f, i) => (
            <View key={f.label} style={[styles.cell, i > 0 && styles.divided]} accessible accessibilityLabel={`${f.label}: ${f.value}`}>
              <Text style={styles.metaLabel}>{f.label}</Text>
              <Text style={styles.statValue}>{f.value}</Text>
            </View>
          ))}
        </BracketFrame>
        <StartButton label="Start Race" onPress={onStart} frame />
      </View>
    </View>
  );
}
