import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Flag } from '../components/Flag';
import { TireIcon } from '../components/TireIcon';
import { TireStrategyBar } from '../components/TireStrategyBar';
import { BracketFrame, Button, SectionLabel, SegmentedControl, StartButton, StatBlock } from '../components/ui';
import { TRACKS, isTrackId } from '../data/tracks';
import { makeStyles, useTheme } from '../design/styles';
import { clampLaps } from '../logic/raceLength';
import { formatDurationWords } from '../logic/sessionOptions';
import { COMPOUNDS, MAX_STOPS, PIT_BREAK_MINUTES, TIRES, encodeStrategy, pitLaps, splitLaps, stintRanges, stopCount, stopperName, strategyOptions, tireLaps } from '../logic/strategy';
import type { Compound, StrategyKind } from '../logic/strategy';
import type { Stint, Track } from '../models/types';
import { updateSettings } from '../storage/settings';
import { useSettings } from '../ui/useSettings';

type Choice = StrategyKind | 'custom';

const TITLES: Record<StrategyKind, string> = { recommended: 'Recommended', fewer: 'Fewer breaks', more: 'More breaks' };
const STOP_OPTIONS = ['0', '1', '2', '3'] as const;
type BreakOption = `${(typeof PIT_BREAK_MINUTES)[number]}`;
const BREAK_OPTIONS = PIT_BREAK_MINUTES.map(String) as BreakOption[];
// the native driver does not exist on web
const useNativeDriver = Platform.OS !== 'web';

/** The Strategy screen: after choosing a track and laps, choose your tires and pit stops (the breaks in a long race). */
export default function StrategyScreen() {
  const styles = useStyles();
  const params = useLocalSearchParams<{ track?: string; laps?: string; speed?: string }>();
  const track = isTrackId(params.track) ? TRACKS[params.track] : undefined;
  const laps = track ? clampLaps(track, Number(params.laps)) : 0;
  if (!track || !Number.isInteger(Number(params.laps)) || laps < 1) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Missing or invalid race settings.</Text>
        <Button label="Back to setup" onPress={() => router.replace('/create-session')} />
      </View>
    );
  }
  return <Strategy track={track} laps={laps} speed={params.speed} />;
}

function Strategy({ track, laps, speed }: { track: Track; laps: number; speed?: string }) {
  const styles = useStyles();
  const t = useTheme();
  const settings = useSettings();
  const options = useMemo(() => strategyOptions(track, laps), [track, laps]);
  const [choice, setChoice] = useState<Choice>('recommended');
  const custom = choice === 'custom';
  // the custom strategy starts as a copy of the recommended one
  const [compounds, setCompounds] = useState<Compound[]>(() => options[0]?.strategy.stints.map((s) => s.compound) ?? ['medium']);
  const [breakMinutes, setBreakMinutes] = useState(settings.pitBreakMinutes);
  // the clock for the finish time, moved on every half minute
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const customStints = useMemo(() => splitLaps(track, laps, compounds), [track, laps, compounds]);
  const chosen: Stint[] | null = custom ? customStints : (options.find((o) => o.kind === choice)?.strategy.stints ?? null);
  const stops = chosen ? chosen.length - 1 : 0;

  const racingSeconds = laps * track.lapTimeSeconds;
  const pitSeconds = stops * breakMinutes * 60;
  const finish = new Date(now + (racingSeconds + pitSeconds) * 1000);

  const setStops = (count: number) =>
    setCompounds((current) => (count < current.length ? current.slice(0, count + 1) : [...current, ...Array<Compound>(count + 1 - current.length).fill(current[current.length - 1] ?? 'medium')]));
  const setCompound = (index: number, compound: Compound) => setCompounds((current) => current.map((c, i) => (i === index ? compound : c)));

  const chooseBreak = (minutes: number) => {
    setBreakMinutes(minutes);
    void updateSettings({ pitBreakMinutes: minutes }).catch(() => {});
  };

  const start = () => {
    if (!chosen) return;
    router.push({
      pathname: '/session',
      params: { track: track.id, laps: String(laps), strategy: encodeStrategy({ stints: chosen }), pit: String(breakMinutes * 60), ...(speed ? { speed } : {}) },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <View style={styles.place} accessible accessibilityLabel={`${track.name}, ${track.country}`}>
            <Flag code={track.countryCode} width={t.size.flag} />
            <Text style={styles.label}>{track.name}</Text>
          </View>
          <Text style={styles.summary}>
            {laps} {laps === 1 ? 'lap' : 'laps'}
          </Text>
          <Text style={styles.muted}>{formatDurationWords(racingSeconds)} of racing, plus your pit stop breaks</Text>
        </View>

        <SectionLabel>Strategy</SectionLabel>
        <View style={styles.options}>
          {/* while you build your own, the suggested strategies step aside and the builder moves up */}
          {!custom &&
            options.map((option, i) => (
              <Appear key={option.kind} delay={i * 120}>
                <OptionCard
                  title={TITLES[option.kind]}
                  subtitle={stopperName(stopCount(option.strategy))}
                  stints={option.strategy.stints}
                  lapSeconds={track.lapTimeSeconds}
                  highlight={option.kind === 'recommended'}
                  selected={choice === option.kind}
                  onPress={() => setChoice(option.kind)}
                />
              </Appear>
            ))}
          <Appear delay={custom ? 0 : options.length * 120}>
            <Pressable
              onPress={() => setChoice(custom ? 'recommended' : 'custom')}
              accessibilityRole="button"
              accessibilityLabel={custom ? 'Back to the suggested strategies' : 'Build your own strategy'}
            >
              <BracketFrame style={[styles.card, custom && styles.cardSelected]}>
                {custom && <View style={styles.rail} />}
                <View style={styles.cardFoot}>
                  {custom ? (
                    <View style={styles.back}>
                      <Ionicons name="chevron-back" size={t.size.chevron} color={t.colors.textSecondary} />
                      <Text style={styles.backText}>Suggested</Text>
                    </View>
                  ) : (
                    <View style={styles.tireRow}>
                      {COMPOUNDS.map((c) => (
                        <TireIcon key={c} compound={c} />
                      ))}
                    </View>
                  )}
                  <View style={styles.cardTitles}>
                    <Text style={styles.cardTitle}>Build your own</Text>
                    <Text style={styles.cardSubtitle}>Your tires, your stops</Text>
                  </View>
                </View>
              </BracketFrame>
            </Pressable>
          </Appear>
        </View>

        {custom && (
          <Builder track={track} laps={laps} compounds={compounds} stints={customStints} onStops={setStops} onCompound={setCompound} />
        )}

        {stops > 0 && (
          <View style={styles.section}>
            <SectionLabel>Pit stop length</SectionLabel>
            <SegmentedControl options={BREAK_OPTIONS} value={String(breakMinutes) as BreakOption} onChange={(m) => chooseBreak(Number(m))} labelFor={(m) => `${m} min`} />
          </View>
        )}

        <View style={styles.totals}>
          <StatBlock label="Racing" value={formatDurationWords(racingSeconds)} size="small" />
          <StatBlock label="Stops" value={chosen ? String(stops) : '–'} size="small" />
          <StatBlock label="In the pits" value={stops > 0 ? formatDurationWords(pitSeconds) : '–'} size="small" />
          <StatBlock label="Finish" value={chosen ? finish.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '–'} size="small" />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <StartButton label={chosen ? 'Start Race' : 'Fix your strategy'} onPress={start} frame disabled={!chosen} />
      </View>
    </SafeAreaView>
  );
}

/** One strategy, drawn like a broadcast strategy graphic: the tire line with each stop's lap, and its name on the right. */
function OptionCard({
  title,
  subtitle,
  stints,
  lapSeconds,
  highlight,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  stints: Stint[];
  lapSeconds: number;
  highlight: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const stops = pitLaps({ stints });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}, ${subtitle}${stops.length ? `, pit after lap ${stops.join(' and ')}` : ''}, ${stints.map((s) => `${TIRES[s.compound].name} for ${formatDurationWords(s.laps * lapSeconds)}`).join(' then ')}`}
    >
      <BracketFrame style={[styles.card, selected && styles.cardSelected]}>
        {selected && <View style={styles.rail} />}
        <TireStrategyBar stints={stints} labels lapSeconds={lapSeconds} />
        <View style={[styles.cardFoot, styles.cardFootEnd]}>
          <View style={styles.cardTitles}>
            <Text style={[styles.cardTitle, highlight && styles.cardTitleHighlight]}>{title}</Text>
            <Text style={styles.cardSubtitle}>{subtitle}</Text>
          </View>
        </View>
      </BracketFrame>
    </Pressable>
  );
}

/** Build your own: how many stops, and the tires for each stint. The laps are shared out by tire life. */
function Builder({
  track,
  laps,
  compounds,
  stints,
  onStops,
  onCompound,
}: {
  track: Track;
  laps: number;
  compounds: Compound[];
  stints: Stint[] | null;
  onStops: (stops: number) => void;
  onCompound: (index: number, compound: Compound) => void;
}) {
  const styles = useStyles();
  const t = useTheme();
  const minutes = Math.round((laps * track.lapTimeSeconds) / 60);
  const problem = stints
    ? null
    : compounds.length > laps
      ? `${laps} ${laps === 1 ? 'lap is' : 'laps are'} too short for ${compounds.length - 1} stops.`
      : compounds.length === 1 && minutes > TIRES.hard.maxMinutes
        ? `A race over an hour needs a pit stop: even hards last ${TIRES.hard.maxMinutes} minutes at most.`
        : `These tires cannot last ${laps} laps (${formatDurationWords(laps * track.lapTimeSeconds)}). Add a stop or pick harder tires.`;

  const ranges = stints ? stintRanges(stints) : [];
  return (
    <View style={styles.section}>
      <SectionLabel>Pit stops</SectionLabel>
      <SegmentedControl options={STOP_OPTIONS.slice(0, Math.min(MAX_STOPS, laps - 1) + 1)} value={String(compounds.length - 1) as (typeof STOP_OPTIONS)[number]} onChange={(s) => onStops(Number(s))} labelFor={(s) => (s === '0' ? 'None' : s)} />

      {stints ? <TireStrategyBar stints={stints} labels lapSeconds={track.lapTimeSeconds} /> : <Text style={styles.problem}>{problem}</Text>}

      <View>
        {compounds.map((compound, i) => {
          const stint = stints?.[i];
          const range = ranges[i];
          return (
            <View key={i} style={[styles.stintRow, i === compounds.length - 1 && styles.stintRowLast]}>
              <View style={styles.stintInfo}>
                <Text style={styles.cardTitle}>Stint {i + 1}</Text>
                <Text style={styles.muted}>{stint && range ? `Laps ${range.from}–${range.to} · ${formatDurationWords(stint.laps * track.lapTimeSeconds)}` : `${TIRES[compound].name}s`}</Text>
              </View>
              <View style={styles.picks}>
                {COMPOUNDS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => onCompound(i, c)}
                    style={[styles.pick, c === compound && styles.pickSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: c === compound }}
                    accessibilityLabel={`Stint ${i + 1}: ${TIRES[c].name}`}
                  >
                    <TireIcon compound={c} letter size={t.size.tirePick} dimmed={c !== compound} />
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        {COMPOUNDS.map((c) => (
          <View key={c} style={styles.legendItem} accessible accessibilityLabel={`${TIRES[c].name}s: ${TIRES[c].targetMinutes} to ${TIRES[c].maxMinutes} minutes, up to ${tireLaps(track, c, 'max')} laps here`}>
            <TireIcon compound={c} letter />
            <Text style={styles.legendValue}>
              {TIRES[c].targetMinutes}–{TIRES[c].maxMinutes} min
            </Text>
            <Text style={styles.legendNote}>up to {tireLaps(track, c, 'max')} laps</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Fades and slides a strategy in when the screen opens, the recommended one first. */
function Appear({ delay, children }: { delay: number; children: ReactNode }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) progress.setValue(1);
      else Animated.timing(progress, { toValue: 1, duration: 320, delay, useNativeDriver }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [progress, delay]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>;
}

const useStyles = makeStyles((t) => ({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.md, padding: t.spacing.screen },
  content: { padding: t.spacing.screen, gap: t.spacing.md, paddingBottom: t.spacing.xl },
  title: { ...t.typography.title, color: t.colors.text, textAlign: 'center' },
  heading: { gap: t.spacing.xs },
  place: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  label: { ...t.typography.metaLabel, color: t.colors.textMuted },
  summary: { ...t.typography.title, color: t.colors.text },
  options: { gap: t.spacing.sm },
  card: { gap: t.spacing.sm, overflow: 'hidden' },
  cardSelected: { backgroundColor: t.colors.raised },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: t.size.line + 1, backgroundColor: t.colors.accent },
  cardFoot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: t.spacing.md },
  cardFootEnd: { justifyContent: 'flex-end' },
  cardTitles: { alignItems: 'flex-end', gap: t.spacing.xxs },
  cardTitle: { ...t.typography.metaLabel, fontFamily: t.typography.heading.fontFamily, color: t.colors.text },
  cardTitleHighlight: { color: t.colors.accentOnDark },
  cardSubtitle: { ...t.typography.microLabel, color: t.colors.textMuted },
  tireRow: { flexDirection: 'row', gap: t.spacing.xs },
  back: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xxs, minHeight: t.size.tire },
  backText: { ...t.typography.metaLabel, color: t.colors.textSecondary },
  section: { gap: t.spacing.sm },
  muted: { ...t.typography.caption, color: t.colors.textMuted },
  problem: { ...t.typography.caption, color: t.colors.flag },
  stintRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.sm, borderBottomWidth: t.border.hairline, borderBottomColor: t.colors.border },
  stintRowLast: { borderBottomWidth: 0 },
  stintInfo: { flex: 1, gap: t.spacing.xxs },
  picks: { flexDirection: 'row', gap: t.spacing.xs },
  pick: { width: t.size.touch, height: t.size.touch, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.control, borderWidth: t.border.hairline, borderColor: t.colors.background },
  pickSelected: { borderColor: t.colors.accent, backgroundColor: t.colors.raised },
  legend: { flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.sm, paddingTop: t.spacing.sm, borderTopWidth: t.border.hairline, borderTopColor: t.colors.border },
  legendItem: { flex: 1, alignItems: 'center', gap: t.spacing.xxs },
  legendValue: { ...t.typography.metaValue, color: t.colors.text },
  legendNote: { ...t.typography.micro, color: t.colors.textMuted },
  totals: { flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.sm, paddingTop: t.spacing.md, borderTopWidth: t.border.hairline, borderTopColor: t.colors.border },
  footer: { padding: t.spacing.screen, borderTopWidth: t.border.hairline, borderTopColor: t.colors.border },
}));
