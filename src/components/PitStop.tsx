import { useEffect, useEffectEvent, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '../design/styles';
import { formatClock } from '../logic/lapProgress';
import { formatDurationWords } from '../logic/sessionOptions';
import { PIT_EXIT, TIRES } from '../logic/strategy';
import type { PitState } from '../hooks/useSessionTimer';
import type { CarSettings, Compound } from '../models/types';
import { haptic } from '../ui/haptics';
import { CarImage } from './CarIcon';
import { TireIcon, tireColor } from './TireIcon';
import { AmbientGlow, BracketFrame, Button, SegmentedProgress } from './ui';

// The tire change at the start of a stop: the crew takes each old tire off and puts the new one on, one corner after
// another, like the wheel guns in a real stop. The car faces right, so the front wheels are on the right.
const CORNERS = [
  { key: 'front-left', x: 0.76, side: -1 },
  { key: 'rear-left', x: 0.22, side: -1 },
  { key: 'front-right', x: 0.76, side: 1 },
  { key: 'rear-right', x: 0.22, side: 1 },
] as const;
const WHEEL_START_MS = 350;
const WHEEL_STAGGER_MS = 260;
const SWAP_MS = 320;
/** The time the car stands still for the tire change, as shown when it is done (seconds). */
const STATIONARY_SECONDS = (WHEEL_START_MS + (CORNERS.length - 1) * WHEEL_STAGGER_MS + SWAP_MS * 2) / 1000;
// the native driver does not exist on web
const useNativeDriver = Platform.OS !== 'web';

/**
 * The pit stop screen, over the race while the car is in the pits: the tire change, then the break counting down. When
 * the break is over the pit exit opens and the race waits for you; staying too long is a slow stop, then a DNF.
 */
export function PitStop({
  pit,
  stopCount,
  laps,
  car,
  from,
  next,
  onRejoin,
}: {
  pit: PitState;
  stopCount: number;
  laps: number;
  car?: CarSettings;
  /** The tires coming off. */
  from: Compound;
  /** The stint after the stop. */
  next: { compound: Compound; laps: number; seconds: number };
  onRejoin: () => void;
}) {
  const styles = useStyles();
  const t = useTheme();
  const [wheels] = useState(() => CORNERS.map(() => new Animated.Value(0)));
  const [changed, setChanged] = useState(false);
  const exitOpen = pit.secondsLeft <= 0;
  const slow = pit.overstaySeconds >= PIT_EXIT.slowStopAfterSeconds;
  const untilDnf = Math.max(0, PIT_EXIT.crashAfterSeconds - pit.overstaySeconds);

  const done = useEffectEvent(() => {
    setChanged(true);
    AccessibilityInfo.announceForAccessibility(`New ${TIRES[next.compound].name.toLowerCase()} tires on. Your break has started.`);
  });

  // the tire change, once, when the car comes in
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        wheels.forEach((w) => w.setValue(1));
        done();
        return;
      }
      wheels.forEach((w, i) => timers.push(setTimeout(() => Animated.timing(w, { toValue: 1, duration: SWAP_MS * 2, useNativeDriver }).start(), WHEEL_START_MS + i * WHEEL_STAGGER_MS)));
      // a timer rather than an animation callback, so it also finishes when the screen is not drawing frames
      timers.push(setTimeout(done, STATIONARY_SECONDS * 1000));
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [wheels]);

  // a buzz when the pit exit opens
  useEffect(() => {
    if (exitOpen) haptic('pit-exit');
  }, [exitOpen]);

  // on short windows (a small phone, a laptop browser) everything is sized down so the buttons stay on screen
  const compact = useWindowDimensions().height < 720;
  const tireSize = compact ? t.size.tire : t.size.tireLarge;
  const carSize = compact ? t.size.cardCarWide : t.size.iconCar;
  const carHeight = carSize / 2;

  return (
    <View style={styles.overlay}>
      <AmbientGlow color={tireColor(t.colors, next.compound)} focus={0.3} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <Text style={styles.label}>
            Pit stop {pit.index + 1} / {stopCount}
          </Text>
          <Text style={styles.label}>
            Lap <Text style={styles.value}>{pit.lap}</Text> / {laps}
          </Text>
        </View>

        <View style={styles.middle}>
          <View style={[styles.crew, { width: carSize, height: carHeight + tireSize * 2 }]} accessible accessibilityLabel={changed ? `Tires changed to ${TIRES[next.compound].name.toLowerCase()}s` : 'Changing tires'}>
            <View style={[styles.car, { top: tireSize }]}>{car && <CarImage car={car} size={carSize} />}</View>
            {CORNERS.map((corner, i) => {
              const progress = wheels[i];
              // the old tire slides away from the car and fades; the new one slides in from the same place
              const away = corner.side * tireSize * 0.7;
              const oldStyle = { opacity: progress.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 0.5], outputRange: [0, away], extrapolate: 'clamp' }) }] };
              const newStyle = { opacity: progress.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ translateY: progress.interpolate({ inputRange: [0.5, 1], outputRange: [away, 0], extrapolate: 'clamp' }) }] };
              const top = corner.side < 0 ? 0 : tireSize + carHeight;
              const left = corner.x * carSize - tireSize / 2;
              return (
                <View key={corner.key} style={[styles.wheel, { top, left, width: tireSize, height: tireSize }]}>
                  <Animated.View style={[styles.fill, oldStyle]}>
                    <TireIcon compound={from} size={tireSize} />
                  </Animated.View>
                  <Animated.View style={[styles.fill, newStyle]}>
                    <TireIcon compound={next.compound} size={tireSize} />
                  </Animated.View>
                  <Animated.View style={[styles.gun, { opacity: progress.interpolate({ inputRange: [0.9, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]} />
                </View>
              );
            })}
          </View>
          <Text style={[styles.label, changed && styles.positive]}>{changed ? `Stationary ${STATIONARY_SECONDS.toFixed(1)} s` : 'Tire change'}</Text>

          <View style={styles.clockBlock}>
            <Text style={[compact ? styles.clockCompact : styles.clock, slow && styles.clockSlow]} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={exitOpen ? `Pit exit open. Rejoin within ${formatClock(untilDnf)}` : `${formatClock(pit.secondsLeft)} of your break left`}>
              {formatClock(exitOpen ? untilDnf : pit.secondsLeft)}
            </Text>
            <View style={styles.exitRow}>
              <View style={[styles.light, exitOpen ? styles.lightGreen : styles.lightRed]} />
              <Text style={[styles.label, exitOpen && (slow ? styles.flag : styles.positive)]}>
                {!exitOpen ? 'Break' : slow ? 'Slow stop · rejoin or retire' : 'Pit exit open · rejoin within'}
              </Text>
            </View>
            <View style={styles.progress}>
              <SegmentedProgress fraction={exitOpen ? 1 : 1 - pit.secondsLeft / pit.breakSeconds} accessibilityLabel="Break progress" />
            </View>
          </View>

          <BracketFrame style={styles.next}>
            <TireIcon compound={next.compound} letter size={t.size.tire + t.spacing.sm} />
            <View style={styles.nextText}>
              <Text style={styles.label}>Next stint</Text>
              <Text style={styles.nextValue}>
                {TIRES[next.compound].name}s · {next.laps} {next.laps === 1 ? 'lap' : 'laps'} · {formatDurationWords(next.seconds)}
              </Text>
            </View>
          </BracketFrame>
        </View>

        <View style={styles.buttons}>
          {exitOpen ? <Button label="Leave pit lane" onPress={onRejoin} /> : <Button label="Rejoin now" variant="secondary" onPress={onRejoin} />}
          <Text style={styles.note}>{exitOpen ? `More than ${PIT_EXIT.slowStopAfterSeconds / 60} min late is a slow stop; ${PIT_EXIT.crashAfterSeconds / 60} min is a DNF.` : 'Take a break: leaving the app is fine until the pit exit opens.'}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.background },
  safe: { flex: 1, padding: t.spacing.screen, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { ...t.typography.metaLabel, color: t.colors.textMuted },
  value: { ...t.typography.metaValue, color: t.colors.text },
  positive: { color: t.colors.positive },
  flag: { color: t.colors.flag },
  middle: { alignItems: 'center', gap: t.spacing.sm },
  crew: { position: 'relative' },
  car: { position: 'absolute', left: 0, right: 0 },
  wheel: { position: 'absolute' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // a small green dot when a corner is done, like the light a wheel gun man shows
  gun: { position: 'absolute', right: -t.spacing.xxs, top: -t.spacing.xxs, width: t.spacing.sm, height: t.spacing.sm, borderRadius: t.radius.dot, backgroundColor: t.colors.positive },
  clockBlock: { alignSelf: 'stretch', alignItems: 'center', gap: t.spacing.xs },
  clock: { ...t.typography.timer, color: t.colors.text, alignSelf: 'stretch', textAlign: 'center' },
  clockCompact: { ...t.typography.display, color: t.colors.text, alignSelf: 'stretch', textAlign: 'center' },
  clockSlow: { color: t.colors.flag },
  exitRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  light: { width: t.spacing.sm + 2, height: t.spacing.sm + 2, borderRadius: t.radius.dot },
  lightRed: { backgroundColor: t.colors.accent },
  lightGreen: { backgroundColor: t.colors.positive, boxShadow: `0 0 ${t.spacing.sm}px ${t.colors.positive}` },
  progress: { alignSelf: 'stretch', marginTop: t.spacing.sm },
  next: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  nextText: { flex: 1, gap: t.spacing.xxs },
  nextValue: { ...t.typography.body, fontFamily: t.typography.heading.fontFamily, color: t.colors.text },
  buttons: { gap: t.spacing.sm },
  note: { ...t.typography.caption, color: t.colors.textMuted, textAlign: 'center' },
}));
