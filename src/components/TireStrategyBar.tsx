import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { GestureResponderEvent, HostInstance } from 'react-native';

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
  // The stretch a dragged pit stop can reach: the line there is greyed down. A light tint vanished on the white hard tire and
  // the yellow medium; a dark one shows on every color.
  zone: { position: 'absolute', backgroundColor: t.colors.background, opacity: t.opacity.dimmed },
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
  onMovePit,
  pitRange,
  onTapTire,
  selectedTire,
}: {
  stints: readonly Stint[];
  size?: 'large' | 'small';
  labels?: boolean;
  lapSeconds?: number;
  completedLaps?: number;
  /** Makes every pit stop draggable along the line: called with the stop (0 is the first) and the lap it is dragged to. */
  onMovePit?: (pit: number, lap: number) => void;
  /** The laps a pit stop can be dragged between; while one is dragged, that stretch of the line is faintly lit. */
  pitRange?: (pit: number) => { first: number; last: number } | null;
  /** Makes every tire tappable: called with the stint the tire ends (0 is the first). */
  onTapTire?: (stint: number) => void;
  /** The stint whose tire is being changed: its tire is drawn a little larger. */
  selectedTire?: number | null;
}) {
  const styles = useStyles();
  const t = useTheme();
  const laneRef = useRef<HostInstance>(null);
  // the stop being dragged, and where the lane is on screen (measured when the touch starts, so scrolling is allowed for)
  const drag = useRef<{ pit: number | null; tap: number | null; left: number; width: number; startX: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const total = stints.reduce((sum, s) => sum + s.laps, 0);
  if (total === 0) return null;
  const iconSize = size === 'large' ? t.size.tire : t.size.tireSmall;
  const lineHeight = size === 'large' ? t.size.line * 2 : t.size.line;
  const labelHeight = t.typography.microLabel.lineHeight + t.spacing.xs;
  const done = completedLaps ?? total;

  const ends = stintRanges(stints).map((range, i) => ({ stint: stints[i], start: range.from - 1, end: range.to }));

  const lapAt = (pageX: number, left: number, width: number) => Math.round(Math.max(0, Math.min(1, (pageX - left) / width)) * total);
  // A touch takes hold of the nearest tire. Moved sideways it drags that tire's pit stop (never the last tire, which is only
  // the end of the race); lifted without moving it is a tap on the tire, if the touch started on it.
  const grab = (e: GestureResponderEvent) => {
    const pageX = e.nativeEvent.pageX;
    laneRef.current?.measureInWindow((left, _top, width) => {
      if (width <= 0) return;
      const at = (i: number) => left + (ends[i].end / total) * width;
      let nearest = 0;
      for (let i = 1; i < ends.length; i++) if (Math.abs(at(i) - pageX) < Math.abs(at(nearest) - pageX)) nearest = i;
      const onTire = Math.abs(at(nearest) - pageX) <= iconSize / 2 + t.spacing.xs;
      drag.current = {
        pit: onMovePit && nearest < ends.length - 1 ? nearest : null,
        tap: onTapTire && onTire ? nearest : null,
        left,
        width,
        startX: pageX,
        moved: false,
      };
    });
  };
  const move = (e: GestureResponderEvent) => {
    const d = drag.current;
    if (!d || d.pit === null) return;
    const pageX = e.nativeEvent.pageX;
    if (!d.moved && Math.abs(pageX - d.startX) < t.spacing.xs) return; // still a tap
    if (!d.moved) {
      d.moved = true;
      setDragging(d.pit);
    }
    onMovePit?.(d.pit, lapAt(pageX, d.left, d.width));
  };
  const release = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(null);
    if (d && !d.moved && d.tap !== null) onTapTire?.(d.tap);
  };
  const touch = (onMovePit && ends.length > 1) || onTapTire
    ? {
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderTerminationRequest: () => false, // keep the drag even if the page tries to scroll
        onResponderGrant: grab,
        onResponderMove: move,
        onResponderRelease: release,
        onResponderTerminate: release,
      }
    : {};

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
      <View ref={laneRef} style={[styles.lane, { height: iconSize }]} {...touch}>
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
        {dragging !== null &&
          (() => {
            const range = pitRange?.(dragging);
            if (!range) return null;
            // the stretch of the line the dragged stop can reach, lit very faintly
            return <View style={[styles.zone, { left: `${(range.first / total) * 100}%`, width: `${((range.last - range.first) / total) * 100}%`, top: (iconSize - lineHeight) / 2, height: lineHeight, pointerEvents: 'none' }]} />;
          })()}
        {ends.map(({ stint, end }, i) => (
          <View key={i} style={[styles.pin, { left: `${(end / total) * 100}%`, marginLeft: -iconSize / 2, pointerEvents: 'none' }, (dragging === i || selectedTire === i) && { transform: [{ scale: 1.2 }] }]}>
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
