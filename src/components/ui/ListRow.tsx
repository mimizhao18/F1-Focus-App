import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Platform, Pressable, Switch, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../../design/styles';
import type { IconName } from './Button';

// On the web the switch paints its knob in its own teal when on unless it is given this.
const webThumb = (color: string) => (Platform.OS === 'web' ? { activeThumbColor: color } : {});

const useStyles = makeStyles((t) => ({
  row: {
    minHeight: t.size.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.border,
  },
  last: { borderBottomWidth: 0 },
  pressed: { opacity: t.opacity.pressed },
  text: { flex: 1, gap: t.spacing.xxs },
  title: { ...t.typography.body, fontFamily: t.typography.heading.fontFamily, color: t.colors.text },
  destructive: { color: t.colors.accentOnDark },
  subtitle: { ...t.typography.caption, color: t.colors.textMuted },
  value: { ...t.typography.statSmall, color: t.colors.textSecondary },
}));

/**
 * One row of a list: optional icon, a title with an optional line under it, an optional value, and a chevron when it opens something. Rows are separated by hairlines; set `last` on the final one.
 * A row can instead end in an on/off switch (`toggle`, the whole row flips it) or in its own control (`accessory`, such as a text field or a small segmented control).
 */
export function ListRow({
  title,
  subtitle,
  value,
  icon,
  onPress,
  destructive,
  chevron = true,
  toggle,
  accessory,
  last,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  onPress?: () => void;
  destructive?: boolean;
  /** Show the arrow at the end of a row that opens something (on by default for rows with onPress). */
  chevron?: boolean;
  toggle?: { value: boolean; onChange: (value: boolean) => void };
  accessory?: ReactNode;
  last?: boolean;
}) {
  const styles = useStyles();
  const t = useTheme();
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={t.size.icon} color={destructive ? t.colors.accentOnDark : t.colors.textSecondary} /> : null}
      <View style={styles.text}>
        <Text style={[styles.title, destructive && styles.destructive]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {accessory}
      {toggle ? (
        // only a picture of the switch: the row takes the taps and is the switch for screen readers
        <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Switch value={toggle.value} trackColor={{ false: t.colors.border, true: t.colors.accent }} thumbColor={t.colors.text} {...webThumb(t.colors.text)} />
        </View>
      ) : null}
      {onPress && chevron && !toggle ? <Ionicons name="chevron-forward" size={t.size.icon - 4} color={t.colors.textMuted} /> : null}
    </>
  );
  if (toggle) {
    return (
      <Pressable
        onPress={() => toggle.onChange(!toggle.value)}
        accessibilityRole="switch"
        // aria-checked rather than accessibilityState, which the web build ignores
        aria-checked={toggle.value}
        accessibilityLabel={title}
        accessibilityHint={subtitle}
        style={({ pressed }) => [styles.row, last && styles.last, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }
  if (!onPress) return <View style={[styles.row, last && styles.last]}>{content}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.row, last && styles.last, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}
