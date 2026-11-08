import { Text, View } from 'react-native';

import { makeStyles } from '../../design/styles';

const useStyles = makeStyles((t) => ({
  block: { gap: t.spacing.xs },
  center: { alignItems: 'center' },
  label: { ...t.typography.label, color: t.colors.textMuted },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.xs },
  large: { ...t.typography.statLarge, color: t.colors.text },
  medium: { ...t.typography.stat, color: t.colors.text },
  small: { ...t.typography.statSmall, color: t.colors.text },
  tiny: { ...t.typography.metaValue, color: t.colors.text },
  tinyLabel: { ...t.typography.microLabel, color: t.colors.textMuted },
  unit: { ...t.typography.caption, color: t.colors.textMuted },
}));

/** One figure: a small uppercase label, the value in big monospace numerals, and an optional unit ("km", "XP"). */
export function StatBlock({
  label,
  value,
  unit,
  size = 'medium',
  align = 'left',
}: {
  label: string;
  value: string | number;
  unit?: string;
  size?: 'large' | 'medium' | 'small' | 'tiny';
  align?: 'left' | 'center';
}) {
  const styles = useStyles();
  return (
    <View style={[styles.block, align === 'center' && styles.center]} accessible accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}>
      <Text style={size === 'tiny' ? styles.tinyLabel : styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles[size]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {value}
        </Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}
