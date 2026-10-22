import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { glowHexFor } from '../components/car3d/glow';
import { CreditIcon } from '../components/CreditIcon';
import { DriverTag } from '../components/DriverTag';
import { Flag } from '../components/Flag';
import { TireStrategyBar } from '../components/TireStrategyBar';
import { AmbientGlow, BracketFrame, Button, SectionLabel, SegmentedProgress, StartButton, StatBlock } from '../components/ui';
import { XpIcon } from '../components/XpIcon';
import { getLivery } from '../data/liveries';
import { TRACKS } from '../data/tracks';
import { makeStyles, useTheme } from '../design/styles';
import { useCountUp } from '../hooks/useCountUp';
import { formatClock } from '../logic/lapProgress';
import { creditsForSeconds, levelForXp, levelProgress, xpForSeconds } from '../logic/rewards';
import { formatDurationWords } from '../logic/sessionOptions';
import { formatDistance } from '../logic/settings';
import { PIT_EXIT, stopperName } from '../logic/strategy';
import { dayKey, displayedStreak } from '../logic/streak';
import type { PlayerProfile, Session } from '../models/types';
import { getProfile } from '../storage/profile';
import { getSessions } from '../storage/sessions';
import { haptic } from '../ui/haptics';
import { useReduceMotion } from '../ui/useReduceMotion';
import { useSettings } from '../ui/useSettings';

// The results reveal, like a game's post-race screen: the reward tiles pop in and count up, any warnings penalty
// follows, then the XP bar fills (with a level-up flourish when it crosses a level). Milliseconds from opening the screen.
const REVEAL = { xpTile: 150, creditsTile: 350, count: 900, breakdown: 1100, level: 1300, levelFill: 1200 } as const;
// the native driver does not exist on web
const useNativeDriver = Platform.OS !== 'web';

/** The warnings that cut the rewards: track limits warnings, yellow flags and slow pit stops. */
const warningTotal = (s: Session) => (s.trackLimits ?? 0) + (s.yellowFlags ?? 0) + (s.slowStops ?? 0);

/** "Away 42 s · 1 track limits warning · 1 yellow flag", leaving out the counts that are zero. */
function awayLine(session: Session): string {
  const parts = [`Away ${formatDurationWords(Math.round(session.awaySeconds ?? 0))}`];
  if (session.trackLimits) parts.push(`${session.trackLimits} track limits ${session.trackLimits === 1 ? 'warning' : 'warnings'}`);
  if (session.yellowFlags) parts.push(`${session.yellowFlags} yellow ${session.yellowFlags === 1 ? 'flag' : 'flags'}`);
  return parts.join(' · ');
}

export default function SummaryScreen() {
  const styles = useStyles();
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
  return <Results session={session} profile={profile} />;
}

function Results({ session, profile }: { session: Session; profile: PlayerProfile }) {
  const styles = useStyles();
  const t = useTheme();
  const settings = useSettings();
  const instant = useReduceMotion();

  const track = TRACKS[session.trackId];
  const streak = displayedStreak(profile, dayKey(new Date()));
  const livery = getLivery(profile.car.liveryId);
  // what the warnings penalty took off a minute of focus each (shown only when there was one)
  const baseXp = xpForSeconds(session.focusedSeconds);
  const baseCredits = creditsForSeconds(session.focusedSeconds);
  const penalty = session.rewardPenaltyPercent ?? 0;

  // the XP bar moves from where it was before this race to where it is now
  const xpBefore = profile.totalXp - session.xpEarned;
  const xpShown = useCountUp(xpBefore, profile.totalXp, { delay: REVEAL.level, duration: REVEAL.levelFill, instant });
  const level = levelProgress(Math.round(xpShown));
  const levelBefore = levelForXp(xpBefore);
  const leveledUp = level.level > levelBefore;

  useEffect(() => {
    if (leveledUp) haptic('level-up');
  }, [leveledUp]);

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

        <View style={styles.rewardsBlock}>
          <BracketFrame style={styles.rewards}>
            <RewardTile icon={<XpIcon size={t.size.icon} />} amount={session.xpEarned} label="XP" delay={REVEAL.xpTile} instant={instant} />
            <View style={styles.tileDivider} />
            <RewardTile icon={<CreditIcon size={t.size.icon} />} amount={session.creditsEarned} label="Credits" delay={REVEAL.creditsTile} instant={instant} />
          </BracketFrame>

          {penalty > 0 && (
            <Reveal delay={REVEAL.breakdown} instant={instant}>
              <View style={styles.breakdown}>
                <BreakdownRow label={`${warningTotal(session)} warnings · −${penalty}%`} xp={`−${baseXp - session.xpEarned}`} credits={`−${baseCredits - session.creditsEarned}`} warn />
              </View>
            </Reveal>
          )}
        </View>

        <View style={styles.level}>
          <View style={styles.levelRow}>
            <View style={styles.pair} accessible accessibilityLabel={`Level ${level.level}${leveledUp ? ', level up' : ''}`}>
              <Text style={styles.label}>Level</Text>
              <Text style={styles.levelNumber}>{level.level}</Text>
              {leveledUp && <LevelUpBadge instant={instant} />}
            </View>
            <Text style={styles.muted}>
              {level.xpIntoLevel} / {level.xpForNextLevel} XP
            </Text>
          </View>
          <SegmentedProgress fraction={level.fraction} accessibilityLabel={`XP: ${level.xpIntoLevel} of ${level.xpForNextLevel} to level ${level.level + 1}`} />
          <View style={styles.levelRow}>
            <Text style={styles.muted}>
              {level.xpForNextLevel - level.xpIntoLevel} XP to level {level.level + 1}
            </Text>
            <Text style={styles.muted}>
              {streak} day{streak === 1 ? '' : 's'} streak
            </Text>
          </View>
        </View>

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

        {session.strategy && (
          <View style={styles.strategy}>
            <SectionLabel trailing={stopperName(session.strategy.stints.length - 1)}>Strategy</SectionLabel>
            <TireStrategyBar stints={session.strategy.stints} labels completedLaps={session.completedLaps} />
            {session.pitStops?.map((stop, i) => {
              const late = stop.seconds - (session.strategy?.pitBreakSeconds ?? 0) >= PIT_EXIT.slowStopAfterSeconds;
              return (
                <View key={i} style={styles.stopRow}>
                  <Text style={styles.label}>
                    Stop {i + 1} · Lap {stop.lap}
                  </Text>
                  <Text style={[styles.value, late && styles.slow]}>
                    {formatClock(stop.seconds)}
                    {late ? ' · slow' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {session.awaySeconds ? <Text style={styles.away}>{awayLine(session)}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <StartButton label="Race again" frame onPress={() => router.replace('/create-session')} />
        <Button label="Done" variant="ghost" onPress={() => router.replace('/')} />
      </View>
    </SafeAreaView>
  );
}

/** One reward: its icon pops in, then the amount counts up from zero. */
function RewardTile({ icon, amount, label, delay, instant }: { icon: ReactNode; amount: number; label: string; delay: number; instant: boolean }) {
  const styles = useStyles();
  const shown = useCountUp(0, amount, { delay: delay + 150, duration: REVEAL.count, instant });
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${amount} ${label} earned`}>
      <View style={styles.inline}>
        <Reveal delay={delay} instant={instant} pop>
          {icon}
        </Reveal>
        <Text style={styles.rewardValue}>+{Math.round(shown)}</Text>
      </View>
      <Text style={styles.rewardLabel}>{label} earned</Text>
    </View>
  );
}

/** A line of the reward breakdown: where some XP and credits came from (or went). */
function BreakdownRow({ label, xp, credits, warn = false }: { label: string; xp: string; credits: string; warn?: boolean }) {
  const styles = useStyles();
  const t = useTheme();
  return (
    <View style={styles.breakdownRow} accessible accessibilityLabel={`${label}: ${xp} XP, ${credits} credits`}>
      <Text style={[styles.breakdownLabel, warn && styles.warn]}>{label}</Text>
      <View style={[styles.inline, styles.amountColumn]}>
        <XpIcon size={t.size.tireSmall} />
        <Text style={[styles.value, warn && styles.warn]}>{xp}</Text>
      </View>
      <View style={[styles.inline, styles.amountColumn]}>
        <CreditIcon size={t.size.tireSmall} />
        <Text style={[styles.value, warn && styles.warn]}>{credits}</Text>
      </View>
    </View>
  );
}

/** "Level up": a red tag that pops in when the XP bar crosses into a new level. */
function LevelUpBadge({ instant }: { instant: boolean }) {
  const styles = useStyles();
  return (
    <Reveal delay={0} instant={instant} pop>
      <View style={styles.levelUp}>
        <Text style={styles.levelUpText}>Level up</Text>
      </View>
    </Reveal>
  );
}

/** Fades its content in after `delay` ms; with `pop` it also grows in with a small overshoot, like a reward landing. */
function Reveal({ delay, instant, pop = false, children }: { delay: number; instant: boolean; pop?: boolean; children: ReactNode }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (instant) {
      progress.setValue(1);
      return;
    }
    const animation = pop
      ? Animated.spring(progress, { toValue: 1, delay, friction: 5, tension: 120, useNativeDriver })
      : Animated.timing(progress, { toValue: 1, delay, duration: 300, useNativeDriver });
    animation.start();
    // a timer as well, so the content still shows when the screen is not drawing frames
    const timer = setTimeout(() => progress.setValue(1), delay + 1000);
    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [progress, delay, instant, pop]);
  const opacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] });
  const transform = pop ? [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] : [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }];
  return <Animated.View style={{ opacity, transform }}>{children}</Animated.View>;
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
  rewardsBlock: { gap: t.spacing.sm },
  rewards: { flexDirection: 'row', paddingVertical: t.spacing.md },
  tile: { flex: 1, alignItems: 'center', gap: t.spacing.xs },
  tileDivider: { width: t.border.hairline, backgroundColor: t.glass.divider },
  rewardValue: { ...t.typography.stat, color: t.colors.text },
  rewardLabel: { ...t.typography.microLabel, color: t.colors.textMuted },
  breakdown: { paddingHorizontal: t.spacing.md },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.sm },
  breakdownLabel: { ...t.typography.caption, color: t.colors.textSecondary, flex: 1 },
  amountColumn: { width: t.size.control + t.spacing.md, justifyContent: 'flex-end' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  warn: { color: t.colors.flag },
  divided: { borderLeftWidth: t.border.hairline, borderLeftColor: t.glass.divider },
  strip: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingHorizontal: t.spacing.sm },
  away: { ...t.typography.caption, color: t.colors.textMuted },
  strategy: { gap: t.spacing.sm },
  stopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  slow: { color: t.colors.flag },
  level: { gap: t.spacing.sm },
  levelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pair: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  levelNumber: { ...t.typography.stat, color: t.colors.text },
  levelUp: { paddingHorizontal: t.spacing.sm, paddingVertical: t.spacing.xxs, borderRadius: t.radius.control, backgroundColor: t.colors.accent, boxShadow: `0 0 ${t.spacing.md}px ${t.colors.accent}` },
  levelUpText: { ...t.typography.microLabel, color: t.colors.accentText },
  footer: { padding: t.spacing.screen, gap: t.spacing.sm, borderTopWidth: t.border.hairline, borderTopColor: t.colors.border },
}));
