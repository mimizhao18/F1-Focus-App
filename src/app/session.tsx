import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { glowHexFor } from '../components/car3d/glow';
import { TrackView } from '../components/TrackView';
import { Flag } from '../components/Flag';
import { StartLights } from '../components/StartLights';
import { AmbientGlow, Button, RaceBanner, SegmentedProgress } from '../components/ui';
import { getLivery } from '../data/liveries';
import { TRACKS, isTrackId } from '../data/tracks';
import { makeStyles, useTheme } from '../design/styles';
import { useSessionTimer } from '../hooks/useSessionTimer';
import { RULES, penaltyPercent } from '../logic/distraction';
import { formatClock } from '../logic/lapProgress';
import { buildSession } from '../logic/rewards';
import type { CarSettings, Track } from '../models/types';
import { getProfile } from '../storage/profile';
import { recordSession } from '../storage/sessions';
import { showAlert } from '../ui/alert';

/** Marks a crash that left no race to save (it happened before the first minute of focus). */
const NOTHING_SAVED = 'none';

/** How long a warning stays on screen. */
const WARNING_SHOWN_MS = 6000;

export default function SessionScreen() {
  const styles = useStyles();
  const params = useLocalSearchParams<{ track?: string; laps?: string; speed?: string }>();
  const track = isTrackId(params.track) ? TRACKS[params.track] : undefined;
  const laps = Number(params.laps);
  // Test speed-up, only honoured in development builds.
  const speed = __DEV__ && Number(params.speed) > 1 ? Number(params.speed) : 1;

  if (!track || !Number.isInteger(laps) || laps < 1) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Missing or invalid race settings.</Text>
        <Button label="Back to setup" onPress={() => router.replace('/create-session')} />
      </View>
    );
  }
  return <Race track={track} laps={laps} speed={speed} />;
}

function Race({ track, laps, speed }: { track: Track; laps: number; speed: number }) {
  const styles = useStyles();
  const t = useTheme();
  const timer = useSessionTimer(track, laps, speed);
  const { status, progress: p, startedAt, endedAt, start, pause, resume, end, warning, dismissWarning, pauseSecondsLeft, away, crashed } = timer;
  const [crashSessionId, setCrashSessionId] = useState<string | null>(null);
  const saved = useRef(false);
  // On short windows (a laptop browser, a small phone) everything is sized down so the buttons stay on screen.
  const windowHeight = useWindowDimensions().height;
  const compact = windowHeight < 720;
  // The track takes whatever height is left after the text and buttons (never less than 100), so nothing is pushed off screen.
  const trackHeight = Math.max(100, windowHeight - (compact ? t.size.raceReservedCompact : t.size.raceReserved));
  const [car, setCar] = useState<CarSettings | undefined>(undefined);
  // The start lights cover the race until they have gone out and faded; the clock starts at lights out, not before.
  const [lightsShown, setLightsShown] = useState(true);

  useEffect(() => {
    getProfile().then((profile) => setCar(profile.car));
  }, []);

  // No leaving mid-race with the Android back button; pause and end the race instead.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => status === 'running' || status === 'paused');
    return () => sub.remove();
  }, [status]);

  // When the race is over, save it once and go to the summary.
  useEffect(() => {
    if ((status !== 'finished' && status !== 'ended') || saved.current) return;
    saved.current = true;
    const session = buildSession({
      id: String(Date.now()),
      track,
      plannedLaps: laps,
      focusedSeconds: p.elapsedSeconds,
      startedAt: startedAt ?? new Date(),
      endedAt: endedAt ?? new Date(),
      away,
      crashed,
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
  }, [status, track, laps, p.elapsedSeconds, startedAt, endedAt, away, crashed]);

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
            <Text style={styles.muted}>You were away from the race for more than {RULES.crashAfterSeconds / 60} minutes, so your car hit the wall. {crashSessionId === NOTHING_SAVED ? 'It was under a minute, so there is nothing to save.' : 'The laps and focus time you did before leaving still count.'}</Text>
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
  const penalty = penaltyPercent(away);
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

        <View style={{ height: trackHeight }}>
          <TrackView track={track} lapFraction={p.lapFraction} car={car} fill />
          {warning && warning.kind !== 'crash' && (
            <View style={styles.banner}>
              <RaceBanner
                kind={warning.kind}
                title={warning.kind === 'yellow' ? 'Yellow flag' : 'Track limits'}
                detail={`You left the race for ${Math.round(warning.awaySeconds)} s. Stay on track.${penaltyNote}`}
              />
            </View>
          )}
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
      {lightsShown && <StartLights title={`${track.name} · Race start`} onLightsOut={start} onDone={() => setLightsShown(false)} onCancel={cancelStart} />}
    </SafeAreaView>
  );
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
