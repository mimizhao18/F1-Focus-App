import { Text, View } from 'react-native';

import { makeStyles } from '../design/styles';
import { driverCodeFor } from '../logic/settings';
import { useSettings } from '../ui/useSettings';

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.sm },
  // the code as on a timing tower: a short red bar, then the three letters
  bar: { width: t.size.line * 2, height: t.typography.metaValue.fontSize, backgroundColor: t.colors.accent, alignSelf: 'center' },
  code: { ...t.typography.metaValue, fontFamily: t.typography.statSmall.fontFamily, color: t.colors.text },
  name: { ...t.typography.metaLabel, color: t.colors.textMuted, flexShrink: 1 },
}));

/** The player's driver code and name from Settings, like a line of a timing tower. Shows nothing until a name or code is set. */
export function DriverTag() {
  const styles = useStyles();
  const settings = useSettings();
  const code = driverCodeFor(settings);
  const name = settings.driverName.trim();
  if (!code && !name) return null;
  return (
    <View style={styles.row} accessible accessibilityLabel={`Driver: ${[name, code].filter(Boolean).join(', ')}`}>
      <View style={styles.bar} />
      {code ? <Text style={styles.code}>{code}</Text> : null}
      {name ? (
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      ) : null}
    </View>
  );
}
