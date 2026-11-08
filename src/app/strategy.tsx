import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Flag } from '../components/Flag';
import { TireIcon } from '../components/TireIcon';
import { TireStrategyBar } from '../components/TireStrategyBar';
import { BracketFrame, Button, Dropdown, SectionLabel, StartButton, StatBlock } from '../components/ui';
import { TRACKS, isTrackId } from '../data/tracks';
import { makeStyles, useTheme } from '../design/styles';
import { clampLaps } from '../logic/raceLength';
import { formatDurationWords } from '../logic/sessionOptions';
import { COMPOUNDS, PIT_BREAK_MINUTES, TIRES, adaptStrategy, bestStrategy, encodeStrategy, isValidStrategy, movePit, pitLaps, pitRange, splitLaps, stopCount, stopperName, strategyOptions, tireLaps } from '../logic/strategy';
import type { Compound, Strategy as Plan, StrategyKind } from '../logic/strategy';
import type { Stint, Track } from '../models/types';
import { updateSettings } from '../storage/settings';
import { loadSavedStrategy, saveStrategy } from '../storage/strategies';
import { useSettings } from '../ui/useSettings';

type Choice = StrategyKind | 'custom';

/** How long the warning about a tire that cannot be chosen stays on screen. */
const WARNING_SECONDS = 3;

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

  // stint lengths the player has dragged into place; null until they do, and again whenever the number of stops changes
  const [manualLaps, setManualLaps] = useState<number[] | null>(null);
  const customStints = useMemo(() => {
    if (manualLaps && manualLaps.length === compounds.length) {
      const stints = compounds.map((compound, i) => ({ compound, laps: manualLaps[i] }));
      // changing a tire keeps the dragged lengths as long as they still fit its window
      if (isValidStrategy(track, laps, { stints })) return stints;
    }
    return splitLaps(track, laps, compounds);
  }, [track, laps, compounds, manualLaps]);
  // The strategy last raced here: Build your own opens on it (the first time it is opened, so later edits are not undone).
  const [saved, setSaved] = useState<Plan | null>(null);
  const savedApplied = useRef(false);
  useEffect(() => {
    let current = true;
    loadSavedStrategy(track.id).then(
      (plan) => current && setSaved(plan),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [track.id]);
  const toggleCustom = () => {
    if (!custom && saved && !savedApplied.current) {
      savedApplied.current = true;
      const tires = saved.stints.map((s) => s.compound);
      if (isValidStrategy(track, laps, saved)) {
        setCompounds(tires);
        setManualLaps(saved.stints.map((s) => s.laps));
      } else if (splitLaps(track, laps, tires)) {
        // a different race length: the same tires, with the laps shared out afresh
        setCompounds(tires);
        setManualLaps(null);
      }
    }
    setChoice(custom ? 'recommended' : 'custom');
  };
  const chosen: Stint[] | null = custom ? customStints : (options.find((o) => o.kind === choice)?.strategy.stints ?? null);
  const stops = chosen ? chosen.length - 1 : 0;

  const racingSeconds = laps * track.lapTimeSeconds;
  const pitSeconds = stops * breakMinutes * 60;
  const finish = new Date(now + (racingSeconds + pitSeconds) * 1000);

  const movePitTo = (pit: number, lap: number) => {
    if (!customStints) return;
    setManualLaps(movePit(track, laps, customStints, pit, lap).map((s) => s.laps));
  };
  // A new number of stops gives the closest strategy to the current one that works, the first stint kept as close as it can be.
  const setStops = (count: number) => {
    const next = adaptStrategy(track, laps, customStints ?? [], count);
    if (!next) return;
    setCompounds(next.stints.map((s) => s.compound));
    setManualLaps(next.stints.map((s) => s.laps));
  };
  const setCompound = (index: number, compound: Compound) => setCompounds((current) => current.map((c, i) => (i === index ? compound : c)));

  const chooseBreak = (minutes: number) => {
    setBreakMinutes(minutes);
    void updateSettings({ pitBreakMinutes: minutes }).catch(() => {});
  };

  const start = () => {
    if (!chosen) return;
    if (custom) saveStrategy(track.id, { stints: chosen }).catch(() => {});
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
            {laps} {laps === 1 ? 'lap' : 'laps'} · {formatDurationWords(racingSeconds)}
          </Text>
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
              onPress={toggleCustom}
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

        {stops > 0 && (
          <View style={styles.section}>
            <Dropdown label="Pit stop length" options={BREAK_OPTIONS} value={String(breakMinutes) as BreakOption} onChange={(m) => chooseBreak(Number(m))} labelFor={(m) => `${m} min`} />
          </View>
        )}

        {custom && (
          <Builder track={track} laps={laps} compounds={compounds} stints={customStints} onStops={setStops} onCompound={setCompound} onMovePit={movePitTo} pitRange={(pit) => (customStints ? pitRange(track, laps, customStints, pit) : null)} />
        )}

      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totals}>
          <StatBlock label="Racing" value={formatDurationWords(racingSeconds)} size="tiny" />
          <StatBlock label="Stops" value={chosen ? String(stops) : '–'} size="tiny" />
          <StatBlock label="In the pits" value={stops > 0 ? formatDurationWords(pitSeconds) : '–'} size="tiny" />
          <StatBlock label="Finish" value={chosen ? finish.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '–'} size="tiny" />
        </View>
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
  onMovePit,
  pitRange: rangeFor,
}: {
  track: Track;
  laps: number;
  compounds: Compound[];
  stints: Stint[] | null;
  onStops: (stops: number) => void;
  onCompound: (index: number, compound: Compound) => void;
  onMovePit: (pit: number, lap: number) => void;
  pitRange: (pit: number) => { first: number; last: number } | null;
}) {
  const styles = useStyles();
  const t = useTheme();
  const [showWindows, setShowWindows] = useState(false);
  // the stint whose tire is being changed, after a tap on its tire on the line
  const [editing, setEditing] = useState<number | null>(null);
  // why a tire the player tapped but cannot have is not allowed; the tire is not changed
  // (an object, so tapping the same tire again starts the 5 seconds again)
  const [blocked, setBlocked] = useState<{ text: string } | null>(null);
  useEffect(() => {
    if (!blocked) return;
    const timer = setTimeout(() => setBlocked(null), WARNING_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [blocked]);
  const minutes = Math.round((laps * track.lapTimeSeconds) / 60);
  /** Why these tires cannot cover the race, or null if they can. */
  const explain = (tires: readonly Compound[]): string | null =>
    splitLaps(track, laps, tires)
      ? null
      : tires.length > laps
        ? `${laps} ${laps === 1 ? 'lap is' : 'laps are'} too short for ${tires.length - 1} stops.`
        : tires.length === 1 && minutes > TIRES.hard.maxMinutes
          ? `A race over ${TIRES.hard.maxMinutes} minutes needs a pit stop: even hards last ${TIRES.hard.maxMinutes} minutes at most.`
          : tires.reduce((sum, c) => sum + tireLaps(track, c, 'min'), 0) > laps
            ? `A stint can't be shorter than its tire's minimum. Remove a stop or pick softer tires.`
            : `These tires cannot last ${laps} laps (${formatDurationWords(laps * track.lapTimeSeconds)}). Add a stop or pick harder tires.`;
  const problem = stints ? null : explain(compounds);

  return (
    <View style={styles.section}>
      <Dropdown label="Pit stops" options={STOP_OPTIONS.filter((s) => bestStrategy(track, laps, Number(s)) !== null)} value={String(compounds.length - 1) as (typeof STOP_OPTIONS)[number]} onChange={(s) => {
          setEditing(null);
          setBlocked(null);
          onStops(Number(s));
        }} labelFor={(s) => (s === '0' ? 'None' : s)} />

      {stints ? (
        <TireStrategyBar stints={stints} labels lapSeconds={track.lapTimeSeconds} onMovePit={onMovePit} pitRange={rangeFor} onTapTire={(i) => {
            setBlocked(null);
            setEditing((current) => (current === i ? null : i));
          }} selectedTire={editing} />
      ) : (
        <Text style={styles.problem}>{problem}</Text>
      )}
      {stints && <Text style={styles.muted}>{stints.length > 1 ? 'Drag a pit stop to change how long a stint runs. Tap a tire to change it.' : 'Tap the tire to change it.'}</Text>}

      <Pressable
        onPress={() => setShowWindows((s) => !s)}
        style={styles.info}
        accessibilityRole="button"
        accessibilityLabel="How long each tire lasts"
        accessibilityState={{ expanded: showWindows }}
        hitSlop={t.spacing.sm}
      >
        <Ionicons name={showWindows ? 'information-circle' : 'information-circle-outline'} size={t.size.chevron + 4} color={t.colors.textSecondary} />
        <Text style={styles.infoText}>Tire life</Text>
      </Pressable>

      {showWindows && (
      <View style={styles.legend}>
        {COMPOUNDS.map((c) => (
          <View key={c} style={styles.legendItem} accessible accessibilityLabel={`${TIRES[c].name}s: ${TIRES[c].minMinutes} to ${TIRES[c].maxMinutes} minutes, ${tireLaps(track, c, 'min')} to ${tireLaps(track, c, 'max')} laps here`}>
            <TireIcon compound={c} letter />
            <Text style={styles.legendValue}>
              {TIRES[c].minMinutes}–{TIRES[c].maxMinutes} min
            </Text>
            <Text style={styles.legendNote}>
              {tireLaps(track, c, 'min')}–{tireLaps(track, c, 'max')} laps
            </Text>
          </View>
        ))}
      </View>
      )}

      {editing !== null && editing < compounds.length && (
        <View style={styles.editor}>
          <Text style={styles.cardTitle}>Stint {editing + 1}</Text>
          <View style={styles.picks}>
            {COMPOUNDS.map((c) => {
              // a tire that would leave the race without a valid strategy is greyed out and cannot be chosen
              const why = explain(compounds.map((current, i) => (i === editing ? c : current)));
              return (
                <Pressable
                  key={c}
                  onPress={() => {
                    if (why) return setBlocked({ text: why });
                    setBlocked(null);
                    onCompound(editing, c);
                    setEditing(null);
                  }}
                  style={[styles.pick, c === compounds[editing] && styles.pickSelected, why !== null && styles.pickBlocked]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: c === compounds[editing], disabled: why !== null }}
                  accessibilityLabel={`Stint ${editing + 1}: ${TIRES[c].name}${why ? `, not allowed. ${why}` : ''}`}
                >
                  <TireIcon compound={c} letter size={t.size.tirePick} dimmed={c !== compounds[editing] || why !== null} />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {editing !== null && blocked !== null && <Text style={styles.problem}>{blocked.text}</Text>}

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
  editor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.md },
  picks: { flexDirection: 'row', gap: t.spacing.xs },
  pick: { width: t.size.touch, height: t.size.touch, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.control, borderWidth: t.border.hairline, borderColor: t.colors.background },
  pickBlocked: { opacity: t.opacity.unaffordable },
  pickSelected: { borderColor: t.colors.accent, backgroundColor: t.colors.raised },
  info: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, alignSelf: 'flex-start' },
  infoText: { ...t.typography.caption, color: t.colors.textMuted },
  legend: { flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.sm, paddingTop: t.spacing.sm, borderTopWidth: t.border.hairline, borderTopColor: t.colors.border },
  legendItem: { flex: 1, alignItems: 'center', gap: t.spacing.xxs },
  legendValue: { ...t.typography.metaValue, color: t.colors.text },
  legendNote: { ...t.typography.micro, color: t.colors.textMuted },
  totals: { flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.sm },
  footer: { padding: t.spacing.screen, gap: t.spacing.md, borderTopWidth: t.border.hairline, borderTopColor: t.colors.border },
}));
