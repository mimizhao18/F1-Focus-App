import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { getEra } from '../data/eras';
import type { Livery } from '../data/liveries';
import { makeStyles, useTheme } from '../design/styles';
import { glowHexFor } from './car3d/glow';
import { CarImage } from './CarIcon';
import { AmbientGlow, CreditAmount, Glass } from './ui';

const useStyles = makeStyles((t) => ({
  // two columns with a gap between
  wrap: { width: '48.5%' },
  pressed: { opacity: t.opacity.pressed },
  card: { padding: 0, overflow: 'hidden', borderRadius: t.radius.panel },
  // the livery's own colors glow softly behind the car, so each card takes on its team's look
  glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // a brighter edge on the card being looked at, red on the one the car wears
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: t.radius.panel, borderWidth: t.border.selected, borderColor: t.colors.textSecondary },
  ringEquipped: { borderColor: t.colors.accent },
  car: { height: t.size.cardCar + t.spacing.md, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: t.spacing.md, paddingBottom: t.spacing.md, gap: t.spacing.xxs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  name: { ...t.typography.body, fontFamily: t.typography.heading.fontFamily, color: t.colors.text, flex: 1 },
  era: { ...t.typography.microLabel, color: t.colors.textMuted },
  foot: { flexDirection: 'row', alignItems: 'center', minHeight: t.size.icon, marginTop: t.spacing.sm },
  status: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  owned: { ...t.typography.metaLabel, color: t.colors.positive },
  dot: { width: t.spacing.sm - 2, height: t.spacing.sm - 2, borderRadius: t.radius.dot, backgroundColor: t.colors.accent },
  equipped: { ...t.typography.metaLabel, color: t.colors.accentOnDark },
  // a price you cannot pay yet is quieter, but the card stays bright: you can still look
  short: { opacity: t.opacity.unaffordable },
}));

/** What a tile shows: a price beside the name (Store), or at its foot Owned (Store), Equipped (Garage) or nothing. */
export type TileStatus = { kind: 'price'; canAfford: boolean } | { kind: 'owned' } | { kind: 'equipped' } | { kind: 'none' };

/**
 * A livery as a glass card lit in its own colors: the car, its name (with the price beside it in the Store) and generation,
 * and a status at the foot. The Store and the Garage both use it. `selected` gives the card a brighter edge (the livery being previewed).
 */
export function LiveryTile({ livery, number, status, selected = false, onPress }: { livery: Livery; number: number; status: TileStatus; selected?: boolean; onPress: () => void }) {
  const styles = useStyles();
  const t = useTheme();
  const era = getEra(livery.era);
  const equipped = status.kind === 'equipped';
  const said = { price: `${livery.price} credits`, owned: 'owned', equipped: 'equipped', none: '' }[status.kind];
  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      // aria-selected rather than accessibilityState, which the web build ignores
      aria-selected={selected}
      accessibilityLabel={[`${livery.name}, ${era.name} car`, said].filter(Boolean).join(', ')}
    >
      <Glass style={styles.card}>
        <View style={styles.glow} pointerEvents="none">
          <AmbientGlow color={glowHexFor(livery.primary, livery.secondary)} focus={0.25} />
        </View>
        <View style={styles.car}>
          <CarImage car={{ liveryId: livery.id, number }} size={t.size.cardCarWide} detail="simple" showNumber={false} />
        </View>
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {livery.name}
            </Text>
            {status.kind === 'price' && (
              <View style={!status.canAfford && styles.short}>
                <CreditAmount amount={livery.price} size="meta" />
              </View>
            )}
          </View>
          <Text style={styles.era}>{era.name}</Text>
          {/* a priced card has its price beside the name, so only the other kinds need a foot */}
          {status.kind !== 'price' && (
            <View style={styles.foot}>
              {status.kind === 'owned' && (
                <View style={styles.status}>
                  <Ionicons name="checkmark" size={t.size.icon - 6} color={t.colors.positive} />
                  <Text style={styles.owned}>Owned</Text>
                </View>
              )}
              {equipped && (
                <View style={styles.status}>
                  <View style={styles.dot} />
                  <Text style={styles.equipped}>Equipped</Text>
                </View>
              )}
            </View>
          )}
        </View>
        {(selected || equipped) && <View style={[styles.ring, equipped && styles.ringEquipped]} pointerEvents="none" />}
      </Glass>
    </Pressable>
  );
}
