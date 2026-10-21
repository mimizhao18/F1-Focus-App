import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Slider } from '../components/Slider';
import { TrackCarousel } from '../components/TrackCarousel';
import { SectionLabel, SegmentedControl, StartButton } from '../components/ui';
import { TRACK_LIST, isTrackId, isTrackUnlocked } from '../data/tracks';
import { makeStyles } from '../design/styles';
import { clampLaps, lapsFromMinutes, maxMinutes, minutesForLaps } from '../logic/raceLength';
import { distanceKm, lapsToSeconds, levelForXp } from '../logic/rewards';
import { DEFAULT_LAPS, formatDurationWords } from '../logic/sessionOptions';
import { formatDistance } from '../logic/settings';
import type { LengthMode as Mode } from '../logic/settings';
import type { TrackId } from '../models/types';
import { getProfile } from '../storage/profile';
import { updateSettings } from '../storage/settings';
import { useSettings } from '../ui/useSettings';

const MODES: readonly Mode[] = ['laps', 'minutes'];
const SPEEDS = ['1', '10', '30', '60'] as const;

const useStyles = makeStyles((t) => ({
  safe: { flex: 1 },
  content: { padding: t.spacing.screen, gap: t.spacing.md },
  muted: { ...t.typography.caption, color: t.colors.textMuted },
  valueBlock: { alignItems: 'center', gap: t.spacing.xs, paddingVertical: t.spacing.sm },
  bigValue: { ...t.typography.statLarge, color: t.colors.text },
  fullRace: { ...t.typography.metaLabel, color: t.colors.accentOnDark },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  range: { ...t.typography.metaValue, color: t.colors.textMuted },
  footer: { padding: t.spacing.screen, borderTopWidth: t.border.hairline, borderTopColor: t.colors.border },
}));

export default function CreateSessionScreen() {
  const styles = useStyles();
  const settings = useSettings();
  // Opens on your last race if Settings says so (the settings are read before any screen shows, see _layout.tsx).
  const [initial] = useState(() => {
    const last = settings.rememberLastRace ? settings.lastRace : null;
    return isTrackId(last?.trackId) ? { trackId: last.trackId, laps: last.laps } : { trackId: TRACK_LIST[0].id, laps: DEFAULT_LAPS };
  });
  const [trackId, setTrackId] = useState<TrackId>(initial.trackId);
  const [mode, setMode] = useState<Mode>(settings.lengthMode);
  const [requestedLaps, setRequestedLaps] = useState<number>(initial.laps);
  const [speed, setSpeed] = useState(1); // development only: speeds the race up for testing
  const [level, setLevel] = useState(1);

  useFocusEffect(
    useCallback(() => {
      getProfile().then((profile) => setLevel(levelForXp(profile.totalXp)));
    }, []),
  );

  const track = TRACK_LIST.find((t) => t.id === trackId) ?? TRACK_LIST[0];
  // Laps are always whole, and never more than a full race at this track (matters after switching tracks).
  const laps = clampLaps(track, requestedLaps);
  const seconds = lapsToSeconds(track, laps);
  const km = distanceKm(track, laps);
  const isFullRace = laps === track.raceLaps;
  const locked = !isTrackUnlocked(track, level);

  const start = () => {
    if (settings.rememberLastRace) void updateSettings({ lastRace: { trackId: track.id, laps } }).catch(() => {});
    router.push({
      pathname: '/session',
      params: { track: track.id, laps: String(laps), ...(__DEV__ && speed > 1 ? { speed: String(speed) } : {}) },
    });
  };

  const distance = formatDistance(km, settings.distanceUnit, 1);
  const bigValue = mode === 'laps' ? `${laps} ${laps === 1 ? 'lap' : 'laps'}` : formatDurationWords(seconds);
  const subValue =
    mode === 'laps'
      ? `${formatDurationWords(seconds)} · ${distance.value} ${distance.unit}`
      : `${laps} ${laps === 1 ? 'lap' : 'laps'} · ${distance.value} ${distance.unit}`;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel>Track</SectionLabel>
        <TrackCarousel tracks={TRACK_LIST} level={level} selectedId={trackId} onSelect={setTrackId} />

        <SectionLabel>Race length</SectionLabel>
        <SegmentedControl options={MODES} value={mode} onChange={setMode} labelFor={(m) => (m === 'laps' ? 'Laps' : 'Minutes')} />

        <View style={styles.valueBlock}>
          <Text style={styles.bigValue}>{bigValue}</Text>
          <Text style={styles.muted}>{subValue}</Text>
          {isFullRace && <Text style={styles.fullRace}>Full race distance</Text>}
        </View>

        {mode === 'laps' ? (
          <Slider value={laps} min={1} max={track.raceLaps} onChange={setRequestedLaps} accessibilityLabel="Race length in laps" />
        ) : (
          <Slider
            value={minutesForLaps(track, laps)}
            min={1}
            max={maxMinutes(track)}
            onChange={(minutes) => setRequestedLaps(lapsFromMinutes(track, minutes))}
            accessibilityLabel="Race length in minutes"
          />
        )}
        <View style={styles.rangeLabels}>
          <Text style={styles.range}>{mode === 'laps' ? '1 lap' : '1 min'}</Text>
          <Text style={styles.range}>{mode === 'laps' ? `${track.raceLaps} laps` : `${maxMinutes(track)} min`}</Text>
        </View>
        {mode === 'minutes' && <Text style={styles.muted}>Races are whole laps, so the time snaps to the nearest lap.</Text>}

        {__DEV__ && (
          <>
            <SectionLabel>Test speed (development only)</SectionLabel>
            <SegmentedControl options={SPEEDS} value={String(speed) as (typeof SPEEDS)[number]} onChange={(x) => setSpeed(Number(x))} labelFor={(x) => `${x}x`} />
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <StartButton label={locked ? `Locked · Level ${track.unlockLevel}` : 'Start Race'} onPress={start} frame disabled={locked} />
      </View>
    </SafeAreaView>
  );
}
