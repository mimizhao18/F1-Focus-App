import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { glowHexFor } from '../components/car3d/glow';
import { DriverTag } from '../components/DriverTag';
import { Flag } from '../components/Flag';
import { AmbientGlow, BracketFrame, Button, CreditAmount, SegmentedProgress, StartButton, StatBlock } from '../components/ui';
import { getLivery } from '../data/liveries';
import { TRACKS } from '../data/tracks';
import { makeStyles, useTheme } from '../design/styles';
import { levelForXp, levelProgress } from '../logic/rewards';
import { formatDurationWords } from '../logic/sessionOptions';
import { formatDistance } from '../logic/settings';
import { dayKey, displayedStreak } from '../logic/streak';
import type { PlayerProfile, Session } from '../models/types';
import { getProfile } from '../storage/profile';
import { getSessions } from '../storage/sessions';
import { useSettings } from '../ui/useSettings';

/** "Away 42 s · 1 track limits warning · 1 yellow flag", leaving out the counts that are zero. */
function awayLine(session: Session): string {
  const parts = [`Away ${formatDurationWords(Math.round(session.awaySeconds ?? 0))}`];
  if (session.trackLimits) parts.push(`${session.trackLimits} track limits ${session.trackLimits === 1 ? 'warning' : 'warnings'}`);
  if (session.yellowFlags) parts.push(`${session.yellowFlags} yellow ${session.yellowFlags === 1 ? 'flag' : 'flags'}`);
  return parts.join(' · ');
}

export default function SummaryScreen() {
  const styles = useStyles();
  const t = useTheme();
  const settings = useSettings();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSessions(), getProfile()]).then(([sessions, p]) => {
      if (cancelled) return;
      setSession(sessions.find((s) => s.id === id) ?? null);
      setProfile(p);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!loaded) {
    return <View style={styles.center} />;
  }
  if (!session || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Race not found.</Text>
        <Button label="Back to Race" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const track = TRACKS[session.trackId];
  const levelBefore = levelForXp(profile.totalXp - session.xpEarned);
  const progress = levelProgress(profile.totalXp);
  const leveledUp = progress.level > levelBefore;
  const streak = displayedStreak(profile, dayKey(new Date()));
  const livery = getLivery(profile.car.liveryId);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <AmbientGlow color={glowHexFor(livery.primary, livery.secondary)} focus={0.25} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          {track && (
            <View style={styles.place} accessible accessibilityLabel={`${track.name}, ${track.country}`}>
              <Flag code={track.countryCode} width={t.size.flag} />
              <Text style={styles.label}>{track.name}</Text>
            </View>
          )}
          <Text style={styles.title}>{session.finished ? 'Chequered flag' : session.crashed ? 'DNF · Crashed' : 'Race ended early'}</Text>
          <DriverTag />
        </View>

        <BracketFrame style={styles.rewards}>
          <View style={styles.reward}>
            <StatBlock label="XP earned" value={`+${session.xpEarned}`} size="large" />
          </View>
          <View style={[styles.reward, styles.divided]}>
            <StatBlock label="Credits earned" value={`+${session.creditsEarned}`} size="large" />
          </View>
        </BracketFrame>

        <View style={styles.strip}>
          <View style={styles.cell}>
            <StatBlock label="Laps" value={`${session.completedLaps} / ${session.plannedLaps}`} size="small" align="center" />
          </View>
          <View style={[styles.cell, styles.divided]}>
            <StatBlock label="Focused" value={formatDurationWords(session.focusedSeconds)} size="small" align="center" />
          </View>
          <View style={[styles.cell, styles.divided]}>
            <StatBlock label="Distance" {...formatDistance(session.distanceKm, settings.distanceUnit, 1)} size="small" align="center" />
          </View>
        </View>

        {session.awaySeconds ? <Text style={styles.away}>{awayLine(session)}</Text> : null}
        {session.rewardPenaltyPercent ? (
          <Text style={styles.penalty}>
            Rewards reduced by {session.rewardPenaltyPercent}% for {(session.trackLimits ?? 0) + (session.yellowFlags ?? 0)} warnings
          </Text>
        ) : null}

        <View style={styles.level}>
          <View style={styles.levelRow}>
            <View style={styles.pair} accessible accessibilityLabel={`Level ${progress.level}${leveledUp ? ', level up' : ''}`}>
              <Text style={styles.label}>Level</Text>
              <Text style={styles.value}>{progress.level}</Text>
              {leveledUp && <Text style={styles.levelUp}>Level up</Text>}
            </View>
            <CreditAmount amount={profile.credits} size="meta" />
          </View>
          <SegmentedProgress fraction={progress.fraction} accessibilityLabel={`XP: ${progress.xpIntoLevel} of ${progress.xpForNextLevel} to level ${progress.level + 1}`} />
          <View style={styles.levelRow}>
            <Text style={styles.muted}>
              {progress.xpIntoLevel} / {progress.xpForNextLevel} XP
            </Text>
            <Text style={styles.muted}>
              {streak} day{streak === 1 ? '' : 's'} streak
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <StartButton label="Race again" frame onPress={() => router.replace('/create-session')} />
        <Button label="Done" variant="ghost" onPress={() => router.replace('/')} />
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.md, padding: t.spacing.screen },
  content: { padding: t.spacing.screen, gap: t.spacing.lg },
  heading: { gap: t.spacing.sm },
  place: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  label: { ...t.typography.metaLabel, color: t.colors.textMuted },
  value: { ...t.typography.metaValue, color: t.colors.text },
  title: { ...t.typography.title, color: t.colors.text },
  muted: { ...t.typography.metaValue, color: t.colors.textMuted },
  rewards: { flexDirection: 'row', paddingVertical: t.spacing.lg },
  reward: { flex: 1, paddingHorizontal: t.spacing.md },
  divided: { borderLeftWidth: t.border.hairline, borderLeftColor: t.glass.divider },
  strip: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingHorizontal: t.spacing.sm },
  away: { ...t.typography.caption, color: t.colors.textMuted },
  penalty: { ...t.typography.caption, color: t.colors.flag },
  level: { gap: t.spacing.sm },
  levelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  pair: { flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.sm },
  levelUp: { ...t.typography.metaLabel, color: t.colors.accentOnDark },
  footer: { padding: t.spacing.screen, gap: t.spacing.sm, borderTopWidth: t.border.hairline, borderTopColor: t.colors.border },
}));
