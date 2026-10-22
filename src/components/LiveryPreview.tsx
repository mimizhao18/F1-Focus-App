import { Text, View } from 'react-native';

import { getEra } from '../data/eras';
import type { Livery } from '../data/liveries';
import { makeStyles, useTheme } from '../design/styles';
import { CarImage } from './CarIcon';
import { HeroCar } from './HeroCar';
import { Button, CreditAmount, Glass } from './ui';

const useStyles = makeStyles((t) => ({
  stack: { gap: t.spacing.md },
  // the 3D car runs to the screen edges, so the glow behind it has room to fade out
  hero: { height: t.size.hero, marginHorizontal: -t.spacing.screen },
  credits: { position: 'absolute', top: t.spacing.sm, right: t.spacing.screen },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: t.spacing.md },
  titleBlock: { flex: 1, gap: t.spacing.xs },
  name: { ...t.typography.title, color: t.colors.text },
  meta: { ...t.typography.caption, color: t.colors.textMuted },
  // a small "Equipped" tag in place of a button: a red dot and a label
  tag: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingTop: t.spacing.xs },
  dot: { width: t.spacing.sm - 2, height: t.spacing.sm - 2, borderRadius: t.radius.dot, backgroundColor: t.colors.accent },
  tagText: { ...t.typography.metaLabel, color: t.colors.accentOnDark },
  iconFrame: { alignItems: 'center', gap: t.spacing.xs, paddingVertical: t.spacing.sm },
  iconLabel: { ...t.typography.metaLabel, color: t.colors.textMuted, alignSelf: 'flex-start' },
}));

/**
 * The livery being looked at: the 3D car you can spin with your credits in its top right corner, then its name, generation and team,
 * then what you can do with it (Equip as a quiet button, Buy as the solid red one, or a small "Equipped" tag; a livery you do not own shows its price beside the name), and below that the 2D race icon. Used by the Garage and the Store.
 */
export function LiveryPreview({
  livery,
  number,
  owned,
  equipped,
  credits,
  onEquip,
  onBuy,
}: {
  livery: Livery;
  number: number;
  owned: boolean;
  equipped: boolean;
  credits: number;
  onEquip: () => void;
  onBuy: () => void;
}) {
  const styles = useStyles();
  const t = useTheme();
  const era = getEra(livery.era);
  const car = { liveryId: livery.id, number };
  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <HeroCar car={car} background="transparent" zoom={0.9} />
        <View style={styles.credits} pointerEvents="none">
          <CreditAmount amount={credits} size="compact" />
        </View>
      </View>

      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.name}>{livery.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {era.name} car · {livery.team}
          </Text>
          {equipped && (
            <View style={styles.tag} accessible accessibilityLabel="Equipped">
              <View style={styles.dot} />
              <Text style={styles.tagText}>Equipped</Text>
            </View>
          )}
        </View>
        {!owned && <CreditAmount amount={livery.price} />}
      </View>

      {!equipped &&
        (owned ? (
          <Button label="Equip" variant="soft" onPress={onEquip} />
        ) : (
          <Button label="Buy" accessibilityLabel={`Buy for ${livery.price} credits`} onPress={onBuy} />
        ))}

      <Glass style={styles.iconFrame}>
        <Text style={styles.iconLabel}>Race icon</Text>
        <CarImage car={car} size={t.size.iconCar} detail="full" showNumber />
      </Glass>
    </View>
  );
}
