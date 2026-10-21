import { memo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { isTrackUnlocked } from '../data/tracks';
import { makeStyles, useTheme } from '../design/styles';
import { formatClock } from '../logic/lapProgress';
import { formatDistance } from '../logic/settings';
import type { Track, TrackId } from '../models/types';
import { useSettings } from '../ui/useSettings';
import { Flag } from './Flag';
import { TrackView } from './TrackView';
import { BracketFrame } from './ui';

interface Props {
  tracks: readonly Track[];
  /** The player's level: tracks that need a higher level are shown locked. */
  level: number;
  selectedId: TrackId;
  onSelect: (id: TrackId) => void;
}

const useStyles = makeStyles((t) => ({
  container: { gap: t.spacing.sm },
  row: { gap: t.spacing.md },
  card: { gap: t.spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  headerText: { flex: 1, gap: t.spacing.xxs },
  name: { ...t.typography.title, color: t.colors.text },
  country: { ...t.typography.caption, color: t.colors.textMuted },
  // the four numbers in one row, split by hairlines
  stats: { flexDirection: 'row', borderTopWidth: t.border.hairline, borderTopColor: t.glass.divider, paddingTop: t.spacing.md },
  statBlock: { flex: 1, gap: t.spacing.xxs, paddingHorizontal: t.spacing.sm, borderLeftWidth: t.border.hairline, borderLeftColor: t.glass.divider },
  statBlockFirst: { borderLeftWidth: 0, paddingLeft: 0 },
  statLabel: { ...t.typography.microLabel, color: t.colors.textMuted },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.xxs },
  statValue: { ...t.typography.statSmall, color: t.colors.text },
  statUnit: { ...t.typography.micro, color: t.colors.textMuted },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { ...t.typography.metaValue, color: t.colors.textMuted },
  // a locked track is dimmed, with a note over the track drawing, so a locked card is as tall as any other
  dimmed: { opacity: t.opacity.unaffordable },
  preview: { justifyContent: 'center' },
  previewTrack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // the drawing of a locked track stops above the note about its XP
  previewTrackLocked: { bottom: t.spacing.lg, opacity: t.opacity.unaffordable },
  lock: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: t.spacing.sm, paddingVertical: t.spacing.xs },
  lockLabel: { ...t.typography.metaLabel, color: t.colors.accentOnDark },
  lockText: { ...t.typography.metaValue, color: t.colors.textSecondary },
  arrow: { width: t.size.touch, height: t.size.touch, alignItems: 'center', justifyContent: 'center' },
  arrowDisabled: { opacity: t.opacity.disabled },
  arrowText: { ...t.typography.title, color: t.colors.textSecondary },
}));

/** Tracks side by side: swipe sideways (or use the arrows) and the track in view is the selected one. */
export function TrackCarousel({ tracks, level, selectedId, onSelect }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const gap = theme.spacing.md;
  const cardPadding = theme.spacing.md;

  // Start from an estimate of the available width (the app is at most 460 wide on web, minus the screen padding),
  // then use the real measured width once the layout reports it.
  const windowWidth = useWindowDimensions().width;
  const [measured, setMeasured] = useState(0);
  const width = measured > 0 ? measured : Math.max(200, Math.min(windowWidth, 460) - theme.spacing.screen * 2);
  const listRef = useRef<ScrollView>(null);

  const interval = width + gap;
  const selectedIndex = Math.max(0, tracks.findIndex((t) => t.id === selectedId));
  const clampIndex = (i: number) => Math.max(0, Math.min(tracks.length - 1, i));

  const goTo = (i: number) => {
    const target = clampIndex(i);
    onSelect(tracks[target].id);
    listRef.current?.scrollTo({ x: target * interval, animated: true });
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (interval <= 0) return;
    const track = tracks[clampIndex(Math.round(e.nativeEvent.contentOffset.x / interval))];
    if (track.id !== selectedId) onSelect(track.id);
  };

  const previewHeight = Math.round((width - cardPadding * 2) * 0.42);

  return (
    <View style={styles.container}>
      <View
        onLayout={(e) => {
          const measuredWidth = Math.round(e.nativeEvent.layout.width);
          setMeasured(measuredWidth);
          // whenever the width is (re)measured, put the list exactly on the selected card
          listRef.current?.scrollTo({ x: selectedIndex * (measuredWidth + gap), animated: false });
        }}
      >
        <ScrollView
          ref={listRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={interval}
          snapToAlignment="start"
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.row}
        >
          {tracks.map((track) => (
            <TrackCard key={track.id} track={track} width={width} previewHeight={previewHeight} level={level} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.controls}>
        <Arrow label="‹" disabled={selectedIndex === 0} onPress={() => goTo(selectedIndex - 1)} accessibilityLabel="Previous track" />
        <Text style={styles.counter} accessibilityLabel={`Track ${selectedIndex + 1} of ${tracks.length}`}>
          {selectedIndex + 1} / {tracks.length}
        </Text>
        <Arrow label="›" disabled={selectedIndex === tracks.length - 1} onPress={() => goTo(selectedIndex + 1)} accessibilityLabel="Next track" />
      </View>
    </View>
  );
}

/** One track: its name and flag, its outline, and its four numbers. A track you have not unlocked yet is dimmed and says which level it needs. */
const TrackCard = memo(function TrackCard({ track, width, previewHeight, level }: { track: Track; width: number; previewHeight: number; level: number }) {
  const styles = useStyles();
  const theme = useTheme();
  const locked = !isTrackUnlocked(track, level);
  const { distanceUnit } = useSettings();
  return (
    <BracketFrame style={[styles.card, { width }]}>
      <View style={[styles.header, locked && styles.dimmed]}>
        <Flag code={track.countryCode} width={theme.size.flag + theme.spacing.sm} />
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {track.name}
          </Text>
          <Text style={styles.country}>{track.country}</Text>
        </View>
      </View>

      <View style={[styles.preview, { height: previewHeight }]}>
        <View style={[styles.previewTrack, locked && styles.previewTrackLocked]}>
          <TrackView track={track} lapFraction={0} showCar={false} fill />
        </View>
        {locked && (
          <View style={styles.lock} accessible accessibilityLabel={`Locked. Reach level ${track.unlockLevel} to unlock. You are level ${level}.`}>
            <Text style={styles.lockLabel}>Locked</Text>
            <Text style={styles.lockText}>Reach level {track.unlockLevel} to unlock</Text>
          </View>
        )}
      </View>

      <View style={[styles.stats, locked && styles.dimmed]}>
        <StatBlock first label="Length" {...formatDistance(track.lapLengthKm, distanceUnit, 2)} />
        <StatBlock label="Laps" value={String(track.raceLaps)} />
        <StatBlock label="Distance" {...formatDistance(track.raceDistanceKm, distanceUnit, 0)} />
        <StatBlock label="Lap time" value={formatClock(track.lapTimeSeconds)} />
      </View>
    </BracketFrame>
  );
});

/** A small label over a number (with its unit), one of the four figures in a track card. */
function StatBlock({ label, value, unit, first }: { label: string; value: string; unit?: string; first?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.statBlock, first && styles.statBlockFirst]} accessible accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

function Arrow({ label, disabled, onPress, accessibilityLabel }: { label: string; disabled: boolean; onPress: () => void; accessibilityLabel: string }) {
  const styles = useStyles();
  return (
    <Pressable style={[styles.arrow, disabled && styles.arrowDisabled]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <Text style={styles.arrowText}>{label}</Text>
    </Pressable>
  );
}
