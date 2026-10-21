import { useEffect, useEffectEvent, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '../design/styles';
import { AmbientGlow, Button } from './ui';

const COLUMNS = [0, 1, 2, 3, 4];
/** A moment to settle before the first light, then one column a second, as at a real F1 start. */
const FIRST_LIGHT_MS = 1000;
const LIGHT_INTERVAL_MS = 1000;
/** After the fifth light the starter holds for a random 0.2 to 3 s before the lights go out. */
const HOLD_MIN_MS = 200;
const HOLD_MAX_MS = 3000;
const LIGHT_ON_MS = 90;
/** How long "Lights out" stays up before the gantry fades away and shows the race, already running underneath. */
const CAPTION_MS = 1000;
const FADE_MS = 400;
// the native driver does not exist on web
const useNativeDriver = Platform.OS !== 'web';

/**
 * The start of a race: five columns of red lights come on one by one, a second apart, hold for a random moment and then all
 * go out together. `onLightsOut` fires at that instant (start the race clock there); `onDone` fires once the gantry has faded
 * away. Leaving the app before lights out starts the sequence again from the first light when you come back.
 */
export function StartLights({ title, onLightsOut, onDone, onCancel }: { title: string; onLightsOut: () => void; onDone: () => void; onCancel: () => void }) {
  const styles = useStyles();
  const t = useTheme();
  const [lit] = useState(() => COLUMNS.map(() => new Animated.Value(0)));
  const [glow] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const [litCount, setLitCount] = useState(0);
  const [out, setOut] = useState(false);
  const [away, setAway] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (out) return;
    const sub = AppState.addEventListener('change', (next) => {
      setAway(next !== 'active');
      if (next !== 'active') setLitCount(0);
    });
    return () => sub.remove();
  }, [out]);

  const lightColumn = useEffectEvent((i: number) => {
    const duration = reduceMotion ? 0 : LIGHT_ON_MS;
    Animated.timing(lit[i], { toValue: 1, duration, useNativeDriver }).start();
    Animated.timing(glow, { toValue: (i + 1) / COLUMNS.length, duration: duration * 3, useNativeDriver }).start();
    setLitCount(i + 1);
  });

  const lightsOut = useEffectEvent(() => {
    // a real gantry switches off at once, so no fade here
    lit.forEach((v) => v.setValue(0));
    glow.setValue(0);
    setLitCount(0);
    setOut(true);
    onLightsOut();
    AccessibilityInfo.announceForAccessibility('Lights out. Race started.');
  });

  // The sequence. Nothing runs while you are away from the app; coming back starts it again from the first light.
  useEffect(() => {
    if (away || out) return;
    lit.forEach((v) => v.setValue(0));
    glow.setValue(0);
    const timers = COLUMNS.map((i) => setTimeout(() => lightColumn(i), FIRST_LIGHT_MS + i * LIGHT_INTERVAL_MS));
    const hold = HOLD_MIN_MS + Math.random() * (HOLD_MAX_MS - HOLD_MIN_MS);
    timers.push(setTimeout(lightsOut, FIRST_LIGHT_MS + (COLUMNS.length - 1) * LIGHT_INTERVAL_MS + hold));
    return () => timers.forEach(clearTimeout);
    // `out` is left out on purpose: lights out must not restart or cancel the sequence that caused it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [away, lit, glow]);

  const finish = useEffectEvent(() => onDone());

  // After lights out: show the caption, then fade the gantry away. Timers rather than an animation callback, so it also
  // finishes when the screen is not drawing frames.
  useEffect(() => {
    if (!out) return;
    const fadeMs = reduceMotion ? 0 : FADE_MS;
    const fadeTimer = setTimeout(() => Animated.timing(fade, { toValue: 0, duration: fadeMs, useNativeDriver }).start(), CAPTION_MS);
    const doneTimer = setTimeout(finish, CAPTION_MS + fadeMs);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [out, fade]);

  return (
    <Animated.View style={[styles.overlay, { opacity: fade }]} pointerEvents={out ? 'none' : 'auto'}>
      <Animated.View style={[styles.fill, { opacity: glow }]} pointerEvents="none">
        <AmbientGlow color={t.colors.accent} focus={0.4} />
      </Animated.View>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.middle}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.gantry} accessible accessibilityRole="image" accessibilityLabel={out ? 'Start lights out' : `Start lights, ${litCount} of ${COLUMNS.length} on`}>
            <View style={styles.bar} />
            <View style={styles.columns}>
              {COLUMNS.map((i) => (
                <View key={i} style={styles.column}>
                  {[0, 1].map((row) => (
                    <View key={row} style={styles.light}>
                      <Animated.View style={[styles.lightOn, { opacity: lit[i] }]} />
                      <View style={styles.shine} />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
          <View style={styles.caption} accessibilityLiveRegion="polite">
            {out ? (
              <>
                <Text style={styles.lightsOut}>Lights out</Text>
                <Text style={styles.awayWeGo}>And away we go</Text>
              </>
            ) : (
              <Text style={styles.hint}>Focus starts at lights out</Text>
            )}
          </View>
        </View>
        <View style={styles.cancel}>{!out && <Button label="Cancel" variant="ghost" onPress={onCancel} />}</View>
      </SafeAreaView>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.background },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  safe: { flex: 1, padding: t.spacing.screen },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.xl },
  title: { ...t.typography.metaLabel, color: t.colors.textMuted },
  // the gantry: a bar across the top with five columns hanging from it, each holding two lights in its lower half
  gantry: { width: '100%', maxWidth: t.size.gantry },
  bar: {
    position: 'absolute',
    top: '6%',
    height: '20%',
    left: 0,
    right: 0,
    borderRadius: t.radius.control,
    backgroundColor: t.colors.gantry,
    borderWidth: t.border.hairline,
    borderColor: t.glass.divider,
  },
  columns: { flexDirection: 'row', gap: t.spacing.md, paddingHorizontal: t.spacing.lg },
  column: {
    flex: 1,
    aspectRatio: 0.36,
    justifyContent: 'flex-end',
    gap: t.spacing.sm,
    padding: t.spacing.sm,
    borderRadius: t.radius.panel,
    backgroundColor: t.colors.gantry,
    borderWidth: t.border.hairline,
    borderColor: t.glass.divider,
  },
  light: { width: '100%', aspectRatio: 1, borderRadius: t.radius.dot, backgroundColor: t.colors.accentTint },
  lightOn: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: t.radius.dot,
    backgroundColor: t.colors.accent,
    boxShadow: `0 0 ${t.spacing.lg}px ${t.spacing.xxs}px ${t.colors.accent}`,
  },
  // a small highlight, so the lenses read as glass whether lit or not
  shine: {
    position: 'absolute',
    top: '16%',
    left: '24%',
    width: '24%',
    height: '18%',
    borderRadius: t.radius.dot,
    backgroundColor: t.glass.tint,
    opacity: t.glass.fillTop,
  },
  caption: { alignItems: 'center', gap: t.spacing.xs, minHeight: t.typography.title.lineHeight + t.spacing.xs + t.typography.metaLabel.lineHeight },
  hint: { ...t.typography.metaLabel, color: t.colors.textMuted },
  lightsOut: { ...t.typography.title, color: t.colors.text, textTransform: 'uppercase', letterSpacing: t.typography.label.letterSpacing },
  awayWeGo: { ...t.typography.metaLabel, color: t.colors.accentOnDark },
  cancel: { minHeight: t.size.control },
}));
