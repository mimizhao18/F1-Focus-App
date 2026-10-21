import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { glowHexFor } from '../components/car3d/glow';
import { TrackView } from '../components/TrackView';
import { Flag } from '../components/Flag';
import { PitStop } from '../components/PitStop';
import { StartLights } from '../components/StartLights';
import { TireIcon, tireColor } from '../components/TireIcon';
import { AmbientGlow, Button, RaceBanner, SegmentedProgress } from '../components/ui';
import { getLivery } from '../data/liveries';
import { TRACKS, isTrackId } from '../data/tracks';
import { makeStyles, useTheme } from '../design/styles';
import { useSessionTimer } from '../hooks/useSessionTimer';
import { RULES, penaltyPercent } from '../logic/distraction';
import { formatClock } from '../logic/lapProgress';
import { buildSession } from '../logic/rewards';
import { DEFAULT_PIT_BREAK_MINUTES, PIT_BREAK_MINUTES, PIT_EXIT, TIRES, decodeStrategy, isValidStrategy, pitLaps, stintIndexAt } from '../logic/strategy';
import type { Strategy } from '../logic/strategy';
import type { CarSettings, Track } from '../models/types';
import { getProfile } from '../storage/profile';
import { recordSession } from '../storage/sessions';
import { getSettingsSnapshot } from '../storage/settings';
import { showAlert } from '../ui/alert';
import { haptic } from '../ui/haptics';

/** Marks a crash that left no race to save (it happened before the first minute of focus). */
const NOTHING_SAVED = 'none';

/** How long a warning stays on screen. */
const WARNING_SHOWN_MS = 6000;

export default function SessionScreen() {
  const styles = useStyles();
  const params = useLocalSearchParams<{ track?: string; laps?: string; speed?: string; strategy?: string; pit?: string }>();
  const track = isTrackId(params.track) ? TRACKS[params.track] : undefined;
  const laps = Number(params.laps);
  // Test speed-up, only honoured in development builds.
  const speed = __DEV__ && Number(params.speed) > 1 ? Number(params.speed) : 1;
  // The tire strategy from the Strategy screen. A race without one (or with one that does not fit) has no pit stops.
  const strategy = useMemo(() => {
    const plan = decodeStrategy(params.strategy);
    return plan && track && isValidStrategy(track, laps, plan) ? plan : null;
  }, [params.strategy, track, laps]);
  const breakMinutes = (PIT_BREAK_MINUTES as readonly number[]).includes(Number(params.pit) / 60) ? Number(params.pit) / 60 : DEFAULT_PIT_BREAK_MINUTES;

  if (!track || !Number.isInteger(laps) || laps < 1) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Missing or invalid race settings.</Text>
        <Button label="Back to setup" onPress={() => router.replace('/create-session')} />
      </View>
    );
  }
  return <Race track={track} laps={laps} speed={speed} strategy={strategy} breakSeconds={breakMinutes * 60} />;
}

function Race({ track, laps, speed, strategy, breakSeconds }: { track: Track; laps: number; speed: number; strategy: Strategy | null; breakSeconds: number }) {
  const styles = useStyles();
  const t = useTheme();
  const pits = useMemo(() => (strategy && strategy.stints.length > 1 ? { afterLaps: pitLaps(strategy), breakSeconds } : undefined), [strategy, breakSeconds]);
  const timer = useSessionTimer(track, laps, speed, pits);
  const { status, progress: p, startedAt, endedAt, start, pause, resume, end, warning, dismissWarning, pauseSecondsLeft, away, crashed, pit, rejoin, pitStops, slowStops } = timer;
  const [crashSessionId, setCrashSessionId] = useState<string | null>(null);
  const saved = useRef(false);
  // On short windows (a laptop browser, a small phone) everything is sized down so the buttons stay on screen.
  const windowHeight = useWindowDimensions().height;
  const compact = windowHeight < 720;
  // The track takes whatever height is left after the text and buttons (never less than 100), so nothing is pushed off screen.
  const stintStripHeight = strategy ? t.size.tire + t.spacing.sm : 0;
  const trackHeight = Math.max(100, windowHeight - (compact ? t.size.raceReservedCompact : t.size.raceReserved) - stintStripHeight);
  const [car, setCar] = useState<CarSettings | undefined>(undefined);
  // The start lights cover the race until they have gone out and faded; the clock starts at lights out, not before.
  // With the lights turned off in Settings the race starts as soon as this screen opens.
  const [startsAtOnce] = useState(() => !getSettingsSnapshot().startLights);
  const [lightsShown, setLightsShown] = useState(!startsAtOnce);
  const lapsBuzzed = useRef(0);

  useEffect(() => {
    if (!startsAtOnce) return;
    haptic('lights-out');
    start();
  }, [startsAtOnce, start]);

  // a buzz for each lap completed (the last one gets the finish buzz instead)
  useEffect(() => {
    if (p.completedLaps <= lapsBuzzed.current) return;
    lapsBuzzed.current = p.completedLaps;
    if (p.completedLaps < laps) haptic('lap');
  }, [p.completedLaps, laps]);

  useEffect(() => {
    if (warning) haptic(warning.kind === 'crash' ? 'crash' : 'warning');
  }, [warning]);

  // The stint you are on (in the pits, the one about to start) and the lap you pit after, if there is another stop.
  const stintIndex = strategy ? stintIndexAt(strategy, p.completedLaps) : 0;
  const stint = strategy?.stints[stintIndex];
  const nextPitLap = pits?.afterLaps[stintIndex];
  const boxThisLap = status === 'running' && nextPitLap !== undefined && p.currentLap === nextPitLap;

  // "Box, box": a call on the radio (and a buzz) at the start of the last lap of a stint
  useEffect(() => {
    if (boxThisLap) haptic('box-box');
  }, [boxThisLap]);

  useEffect(() => {
    if (status === 'pit') haptic('pit-in');
  }, [status]);

  useEffect(() => {
    getProfile().then((profile) => setCar(profile.car));
  }, []);

  // No leaving mid-race with the Android back button; pause and end the race instead.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => status === 'running' || status === 'paused' || status === 'pit');
    return () => sub.remove();
  }, [status]);

  // When the race is over, save it once and go to the summary.
  useEffect(() => {
    if ((status !== 'finished' && status !== 'ended') || saved.current) return;
    saved.current = true;
    if (status === 'finished') haptic('finish');
    const session = buildSession({
      id: String(Date.now()),
      track,
      plannedLaps: laps,
      focusedSeconds: p.elapsedSeconds,
      startedAt: startedAt ?? new Date(),
      endedAt: endedAt ?? new Date(),
      away,
      crashed,
      strategy: strategy ? { stints: strategy.stints, pitBreakSeconds: pits ? breakSeconds : 0 } : undefined,
      pitStops,
      slowStops,
    });
    if (session.xpEarned === 0 && crashed) {
      // a crash before the first minute earns nothing, so there is no race to save
      queueMicrotask(() => setCrashSessionId(NOTHING_SAVED));
      return;
    }
    if (session.xpEarned === 0) {
      showAlert('Too short to count', 'A race needs at least 1 minute of focus to earn rewards.');
      router.replace('/');
      return;
    }
    recordSession(session).then(
      // after a crash the race screen stays to show it; the button there goes on to the results
      () => (crashed ? setCrashSessionId(session.id) : router.replace({ pathname: '/summary', params: { id: session.id } })),
      () => {
        showAlert('Could not save the race', 'Something went wrong saving your race. Please try again.');
        router.replace('/');
      },
    );
  }, [status, track, laps, p.elapsedSeconds, startedAt, endedAt, away, crashed, strategy, pits, breakSeconds, pitStops, slowStops]);

  // a warning is quick: it clears itself
  useEffect(() => {
    if (!warning || warning.kind === 'crash') return;
    const timer = setTimeout(dismissWarning, WARNING_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [warning, dismissWarning]);

  // Cancelling during the start lights leaves before anything has started, so there is nothing to save.
  const cancelStart = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const confirmEnd = () => {
    showAlert('End race early?', 'You keep the laps and focus time you have done so far.', [
      { text: 'Keep racing', style: 'cancel' },
      { text: 'End race', style: 'destructive', onPress: end },
    ]);
  };

  if (status === 'ended' && crashed) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.crash}>
          <View style={styles.crashTrack}>
            <TrackView track={track} lapFraction={p.lapFraction} car={car} crashed fill />
          </View>
          <View style={styles.crashText}>
            <Text style={styles.crashLabel}>DNF</Text>
            <Text style={styles.crashTitle}>Crash</Text>
            <Text style={styles.muted}>
              {warning?.inPit
                ? `You stayed in the pits more than ${PIT_EXIT.crashAfterSeconds / 60} minutes after your break ended, so your race is over.`
                : `You were away from the race for more than ${RULES.crashAfterSeconds / 60} minutes, so your car hit the wall.`}{' '}
              {crashSessionId === NOTHING_SAVED ? 'It was under a minute, so there is nothing to save.' : 'The laps and focus time you did before that still count.'}
            </Text>
          </View>
          <Button
            label={!crashSessionId ? 'Saving…' : crashSessionId === NOTHING_SAVED ? 'Back to Race' : 'See results'}
            disabled={!crashSessionId}
            onPress={() => crashSessionId && (crashSessionId === NOTHING_SAVED ? router.replace('/') : router.replace({ pathname: '/summary', params: { id: crashSessionId } }))}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'finished' || status === 'ended') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{status === 'finished' ? 'Chequered flag' : 'Race ended'}</Text>
        <Text style={styles.muted}>Saving your race…</Text>
      </View>
    );
  }

  const livery = car ? getLivery(car.liveryId) : undefined;
  const paused = status === 'paused';
  // from the second warning on, the banner also says that the rewards are being cut
  const penalty = penaltyPercent(away, slowStops);
  const penaltyNote = penalty > 0 ? ` Rewards -${penalty}%.` : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {livery && <AmbientGlow color={glowHexFor(livery.primary, livery.secondary)} focus={0.3} />}
      <View style={[styles.content, compact && styles.contentCompact]}>
        <View style={styles.top}>
          <View style={styles.place} accessible accessibilityLabel={`${track.name}, ${track.country}`}>
            <Flag code={track.countryCode} width={t.size.flag} />
            <Text style={styles.trackName}>{track.name}</Text>
          </View>
          <View style={styles.lap} accessible accessibilityLabel={`Lap ${p.currentLap} of ${laps}`}>
            <Text style={styles.trackName}>Lap </Text>
            <Text style={styles.lapNumber}>{p.currentLap}</Text>
            <Text style={styles.trackName}> / {laps}</Text>
          </View>
        </View>

        {stint && (
          <View style={styles.stint} accessible accessibilityLabel={`${TIRES[stint.compound].name} tires. ${nextPitLap !== undefined ? `Pit stop after lap ${nextPitLap}` : 'On to the flag'}`}>
            <TireIcon compound={stint.compound} />
            <View style={styles.stintText}>
              <Text style={styles.trackName}>{TIRES[stint.compound].name}s</Text>
              <Text style={styles.stintValue}>
                {nextPitLap === undefined ? 'To the flag' : nextPitLap === p.currentLap ? 'Box this lap' : `Box in ${nextPitLap - p.completedLaps} laps`}
              </Text>
            </View>
            <View style={styles.wear}>
              <View style={[styles.wearFill, { backgroundColor: tireColor(t.colors, stint.compound), width: `${stintLeft(strategy, stintIndex, p.elapsedSeconds, track) * 100}%` }]} />
            </View>
          </View>
        )}

        <View style={{ height: trackHeight }}>
          <TrackView track={track} lapFraction={p.lapFraction} car={car} fill />
          {warning && warning.kind !== 'crash' ? (
            <View style={styles.banner}>
              <RaceBanner
                kind={warning.kind === 'yellow' ? 'yellow' : 'track-limits'}
                title={warning.kind === 'yellow' ? 'Yellow flag' : warning.kind === 'slow-stop' ? 'Slow stop' : 'Track limits'}
                detail={
                  warning.kind === 'slow-stop'
                    ? `You stayed ${Math.round(warning.awaySeconds)} s past your break.${penaltyNote}`
                    : `You left the race for ${Math.round(warning.awaySeconds)} s. Stay on track.${penaltyNote}`
                }
              />
            </View>
          ) : boxThisLap && strategy ? (
            <View style={styles.banner}>
              <RaceBanner kind="track-limits" title="Box, box" detail={`Pit stop at the end of this lap: a ${Math.round(breakSeconds / 60)} min break, then ${TIRES[strategy.stints[stintIndex + 1].compound].name.toLowerCase()}s.`} />
            </View>
          ) : null}
        </View>

        <View style={styles.middle}>
          <Text style={compact ? styles.clockCompact : styles.clock} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={`${formatClock(p.remainingSeconds)} remaining`}>
            {formatClock(p.remainingSeconds)}
          </Text>
          <Text style={[styles.status, paused && styles.statusPaused]}>
            {paused ? `Paused · ${formatClock(pauseSecondsLeft ?? 0)} break left` : 'Remaining'}
          </Text>
          <View style={styles.progress}>
            <SegmentedProgress fraction={p.totalFraction} accessibilityLabel="Race progress" />
          </View>
        </View>

        <View style={styles.buttons}>
          {status === 'running' && <Button label="Pause" variant="secondary" onPress={pause} />}
          {paused && <Button label="Resume" variant="soft" onPress={resume} />}
          {paused && <Button label="End race" variant="ghost" onPress={confirmEnd} />}
        </View>
      </View>
      {status === 'pit' && pit && strategy && stint && (
        <PitStop
          pit={pit}
          stopCount={strategy.stints.length - 1}
          laps={laps}
          car={car}
          from={strategy.stints[stintIndex - 1].compound}
          next={{ compound: stint.compound, laps: stint.laps, seconds: stint.laps * track.lapTimeSeconds }}
          onRejoin={rejoin}
        />
      )}
      {lightsShown && <StartLights title={`${track.name} · Race start`} onLightsOut={start} onDone={() => setLightsShown(false)} onCancel={cancelStart} />}
    </SafeAreaView>
  );
}

/** How much of a stint is still to run, 1 to 0: the bar beside the tire on the race screen. */
function stintLeft(strategy: Strategy | null, index: number, elapsedSeconds: number, track: Track): number {
  if (!strategy) return 0;
  const before = strategy.stints.slice(0, index).reduce((sum, s) => sum + s.laps, 0) * track.lapTimeSeconds;
  const length = strategy.stints[index].laps * track.lapTimeSeconds;
  return Math.max(0, Math.min(1, 1 - (elapsedSeconds - before) / length));
}

const useStyles = makeStyles((t) => ({
  safe: { flex: 1 },
  content: { flex: 1, padding: t.spacing.screen, justifyContent: 'space-between' },
  contentCompact: { paddingVertical: t.spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.md, padding: t.spacing.screen },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  place: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  trackName: { ...t.typography.metaLabel, color: t.colors.textMuted },
  lap: { flexDirection: 'row', alignItems: 'baseline' },
  lapNumber: { ...t.typography.metaValue, color: t.colors.text },
  middle: { alignItems: 'center', gap: t.spacing.xs },
  clock: { ...t.typography.timer, color: t.colors.text, alignSelf: 'stretch', textAlign: 'center' },
  clockCompact: { ...t.typography.display, color: t.colors.text, alignSelf: 'stretch', textAlign: 'center' },
  status: { ...t.typography.metaLabel, color: t.colors.textMuted },
  statusPaused: { color: t.colors.accentOnDark },
  banner: { position: 'absolute', top: 0, left: 0, right: 0 },
  stint: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  stintText: { gap: t.spacing.xxs },
  stintValue: { ...t.typography.metaValue, color: t.colors.text },
  // how much of the stint is left: runs down to the stop
  wear: { flex: 1, height: t.size.progress, backgroundColor: t.colors.border, marginLeft: t.spacing.sm },
  wearFill: { height: '100%' },
  crash: { flex: 1, padding: t.spacing.screen, gap: t.spacing.lg, justifyContent: 'space-between' },
  crashTrack: { flex: 1 },
  crashText: { gap: t.spacing.sm },
  crashTitle: { ...t.typography.title, color: t.colors.text },
  crashLabel: { ...t.typography.metaLabel, color: t.colors.accentOnDark },
  progress: { alignSelf: 'stretch', marginTop: t.spacing.sm },
  // room for two buttons, so nothing jumps when pausing
  buttons: { gap: t.spacing.sm, marginTop: t.spacing.lg, minHeight: t.size.control * 2 + t.spacing.sm },
  title: { ...t.typography.title, color: t.colors.text, textAlign: 'center' },
  muted: { ...t.typography.caption, color: t.colors.textMuted },
}));
