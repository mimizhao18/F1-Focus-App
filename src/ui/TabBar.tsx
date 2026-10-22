import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Polygon } from 'react-native-svg';

import { Glass } from '../components/ui';
import { makeStyles, useTheme } from '../design/styles';
import { noteTabChange } from './tabTransition';

// Garage and Store on the left, History and Settings on the right, and Race (the Home screen) in the middle on a trapezoid.
const TABS = [
  { label: 'Garage', path: '/garage' },
  { label: 'Store', path: '/store' },
  { label: 'Race', path: '/', home: true },
  { label: 'History', path: '/history' },
  { label: 'Settings', path: '/settings' },
] as const;

/** The screens that belong to the tab bar (and show it when the navigation style is "tabs"). */
export const TAB_PATHS: readonly string[] = TABS.map((t) => t.path);

const useStyles = makeStyles((t) => ({
  // a glass strip: the panel's own padding is removed so the tabs fill it
  bar: { flexDirection: 'row', alignItems: 'flex-start', padding: 0 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  homeTab: { flex: 1.3 },
  // the thin accent line over the active tab
  indicator: { position: 'absolute', top: -t.border.hairline, left: t.spacing.md, right: t.spacing.md, height: t.size.line, backgroundColor: t.colors.accent },
  label: { ...t.typography.microLabel, color: t.colors.textMuted },
  labelActive: { color: t.colors.accentOnDark },
  homeShape: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  homeLabel: { ...t.typography.tabHome, color: t.colors.textMuted },
  homeLabelActive: { color: t.colors.background },
}));

/**
 * The Race (Home) tab's backdrop: a trapezoid, wider at the bottom. White rather than red, so on Home the Start Race
 * button stays the one red thing to press: on Home it is white with a thin line outside each slanted side (the same
 * double outline as the Start Race button); elsewhere it is a quiet grey under the bar's lit top edge.
 */
function HomeShape({ active }: { active: boolean }) {
  const styles = useStyles();
  const t = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const slant = t.spacing.md;
  const gap = t.spacing.xs;
  const o = t.border.hairline / 2;
  return (
    <View style={styles.homeShape} pointerEvents="none" onLayout={(e) => setSize(e.nativeEvent.layout)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Polygon
            points={`${slant + gap},0 ${width - slant - gap},0 ${width - gap},${height} ${gap},${height}`}
            fill={active ? t.colors.text : t.colors.surface}
          />
          {active ? (
            <>
              <Line x1={slant} y1={0} x2={o} y2={height} stroke={t.colors.text} strokeOpacity={t.opacity.dimmed} strokeWidth={t.border.hairline} />
              <Line x1={width - slant} y1={0} x2={width - o} y2={height} stroke={t.colors.text} strokeOpacity={t.opacity.dimmed} strokeWidth={t.border.hairline} />
            </>
          ) : (
            // the bar's lit top edge carries on across the tab
            <Line x1={slant + gap} y1={o} x2={width - slant - gap} y2={o} stroke={t.glass.tint} strokeOpacity={t.glass.edgeTop} strokeWidth={t.border.hairline} />
          )}
        </Svg>
      )}
    </View>
  );
}

/** A flat glass tab bar: a lit edge on top, labels only, the active tab in the accent with a thin line above it. */
export function TabBar({ activePath }: { activePath?: string } = {}) {
  const styles = useStyles();
  const t = useTheme();
  const routerPath = usePathname();
  const pathname = activePath ?? routerPath;
  const insets = useSafeAreaInsets();
  // the labels may sit over the top of the home-indicator area, so only part of the bottom inset is added under them
  const below = Math.max(0, insets.bottom - t.spacing.lg);

  return (
    <View accessibilityRole="tablist">
      <Glass corner="flat" style={styles.bar}>
      {TABS.map((tab) => {
        const active = pathname === tab.path;
        const home = 'home' in tab;
        return (
          <Pressable
            key={tab.path}
            style={[styles.tab, home && styles.homeTab, { height: t.size.tabBar + below, paddingBottom: below }]}
            onPress={() => {
              if (active) return;
              noteTabChange(TAB_PATHS.indexOf(pathname), TAB_PATHS.indexOf(tab.path));
              router.replace(tab.path);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            {home ? (
              <>
                <HomeShape active={active} />
                <Text style={[styles.homeLabel, active && styles.homeLabelActive]}>{tab.label}</Text>
              </>
            ) : (
              <>
                {active && <View style={styles.indicator} />}
                <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
              </>
            )}
          </Pressable>
        );
      })}
      </Glass>
    </View>
  );
}
