import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiveryTile } from '../components/LiveryTile';
import { CreditAmount, SectionLabel } from '../components/ui';
import { LIVERIES } from '../data/liveries';
import { makeStyles } from '../design/styles';
import { ownsLivery } from '../logic/garage';
import { formatTimeLeft, nextRefresh, weekKey } from '../logic/shop';
import { getWeeklyOffers } from '../storage/shop';
import { useGarage } from '../ui/useGarage';

const useStyles = makeStyles((t) => ({
  container: { flex: 1 },
  content: { padding: t.spacing.screen, gap: t.spacing.md, paddingBottom: t.spacing.xl },
  top: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  heading: { gap: t.spacing.xs },
  refresh: { ...t.typography.metaValue, color: t.colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: t.spacing.md },
}));

/**
 * The Store: six liveries you do not own yet, picked at random from any generation, that change every Monday
 * (logic/shop.ts). Tap one to see it in full and buy it. Owned ones only show when fewer than six are left to buy.
 */
export default function StoreScreen() {
  const styles = useStyles();
  const { profile } = useGarage();
  const [offerIds, setOfferIds] = useState<string[] | null>(null);
  // the clock for the countdown, moved on every half minute; a new week brings new offers
  const [now, setNow] = useState(() => new Date());
  const week = weekKey(now);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    getWeeklyOffers(profile, new Date()).then((offers) => !cancelled && setOfferIds(offers.liveryIds));
    return () => {
      cancelled = true;
    };
  }, [profile, week]);

  if (!profile || !offerIds) return <View style={styles.container} />;

  const offers = offerIds.map((id) => LIVERIES.find((l) => l.id === id)).filter((l) => l !== undefined);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <View style={styles.heading}>
            <SectionLabel>This week</SectionLabel>
            <Text style={styles.refresh}>New liveries in {formatTimeLeft(now, nextRefresh(now))}</Text>
          </View>
          <CreditAmount amount={profile.credits} size="compact" />
        </View>

        <View style={styles.grid}>
          {offers.map((livery) => (
            <LiveryTile
              key={livery.id}
              livery={livery}
              number={profile.car.number}
              status={ownsLivery(profile, livery) ? { kind: 'owned' } : { kind: 'price', canAfford: livery.price <= profile.credits }}
              onPress={() => router.push({ pathname: '/livery', params: { id: livery.id } })}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
