import { useRef, useState } from 'react';
import { GestureResponderEvent, View } from 'react-native';

import { makeStyles, useTheme } from '../design/styles';

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  accessibilityLabel?: string;
  /** A small tick under the bar at this value. */
  mark?: number;
}

const useStyles = makeStyles((t) => ({
  touchArea: { height: t.size.control, justifyContent: 'center', marginHorizontal: t.size.thumbWidth / 2 },
  bar: { height: t.size.progress, backgroundColor: t.colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: t.colors.accent },
  // a slim upright handle with almost square corners, in the same white as the text
  thumb: { position: 'absolute', width: t.size.thumbWidth, height: t.size.thumbHeight, borderRadius: t.radius.control / 2, backgroundColor: t.colors.text },
  mark: { position: 'absolute', top: t.size.control / 2 + t.size.progress, width: t.border.hairline, height: t.size.tick, backgroundColor: t.colors.textMuted },
}));

/** A simple horizontal slider that snaps to `step`. Touch or drag anywhere along the bar. */
export function Slider({ value, min, max, step = 1, onChange, accessibilityLabel, mark }: Props) {
  const styles = useStyles();
  const { size } = useTheme();
  const [width, setWidth] = useState(0);
  const barRef = useRef<View>(null);

  const valueAt = (pageX: number, barLeft: number) => {
    if (width <= 0) return min;
    const fraction = Math.max(0, Math.min(1, (pageX - barLeft) / width));
    const stepped = Math.round((min + fraction * (max - min)) / step) * step;
    return Math.max(min, Math.min(max, stepped));
  };

  // The bar's position on screen is measured on every touch, so it stays right if the page has scrolled.
  const handleTouch = (e: GestureResponderEvent) => {
    const pageX = e.nativeEvent.pageX;
    barRef.current?.measureInWindow((x) => onChange(valueAt(pageX, x)));
  };

  const fraction = max === min ? 0 : (value - min) / (max - min);
  const thumbLeft = fraction * width - size.thumbWidth / 2;

  return (
    <View
      style={styles.touchArea}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false} // keep the drag even if the page tries to scroll
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const delta = e.nativeEvent.actionName === 'increment' ? step : -step;
        onChange(Math.max(min, Math.min(max, value + delta)));
      }}
    >
      <View ref={barRef} style={[styles.bar, { pointerEvents: 'none' }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
      </View>
      {mark !== undefined && max > min && <View style={[styles.mark, { left: ((mark - min) / (max - min)) * width, pointerEvents: 'none' }]} />}
      <View style={[styles.thumb, { left: thumbLeft, pointerEvents: 'none' }]} />
    </View>
  );
}
