import { DarkTheme, Stack, ThemeProvider, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useAppFonts } from '../design/fonts';
import { fonts, theme } from '../design/tokens';
import { loadSettings } from '../storage/settings';
import { colors } from '../theme';
import { AlertHost } from '../ui/AlertHost';
import { BackButton } from '../ui/BackButton';
import { TAB_PATHS, TabBar } from '../ui/TabBar';
import { tabAnimation } from '../ui/tabTransition';
import { useTabSwipe } from '../ui/useTabSwipe';

// The navigator paints its own background behind every screen, so it needs the app's dark colors too (visible on web).
const appTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.background, card: colors.background, text: colors.text, border: colors.border },
};

// Garage, Store, Race (Home), History and Settings are the tabs: top-level screens, so no back button on them. They slide in
// from the side the tab is on (see tabTransition.ts); replacing a screen animates like a push so the direction is the one asked for.
const noItems = () => [];
const topLevel = { headerBackVisible: false, headerLeft: () => null, unstable_headerLeftItems: noItems };
const tabScreen = (title: string, extra: Record<string, unknown> = {}) => () => ({ title, ...extra, animation: tabAnimation(), animationTypeForReplace: 'push' as const });

// keep the splash screen up until the fonts and settings are ready
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const pathname = usePathname();
  const swipe = useTabSwipe();
  const [fontsLoaded, fontsError] = useAppFonts();
  // read while the fonts load, so every screen opens with the saved settings (New Race starts on your last race)
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  useEffect(() => {
    void loadSettings().then(() => setSettingsLoaded(true));
  }, []);
  const ready = (fontsLoaded || !!fontsError) && settingsLoaded;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={appTheme}>
      <View style={styles.page}>
        <View style={[styles.app, pathname.startsWith('/dev/') && styles.appFull]} {...swipe}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerTitleStyle: { fontFamily: fonts.semibold, fontSize: theme.typography.heading.fontSize },
              headerShadowVisible: false,
              // the app's own back button instead of the system's round one
              headerLeft: ({ canGoBack }: { canGoBack?: boolean }) => (canGoBack ? <BackButton onPress={() => router.back()} /> : null),
              // on iOS 26 the system puts a round glass container behind header buttons; this hides it
              unstable_headerLeftItems: ({ canGoBack }: { canGoBack?: boolean }) => (canGoBack ? [{ type: 'custom' as const, element: <BackButton onPress={() => router.back()} />, hidesSharedBackground: true }] : []),
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" options={tabScreen('Race', { headerShown: false })} />
            <Stack.Screen name="history" options={tabScreen('History', topLevel)} />
            <Stack.Screen name="garage" options={tabScreen('Garage', { headerShown: false })} />
            <Stack.Screen name="store" options={tabScreen('Store', topLevel)} />
            <Stack.Screen name="settings" options={tabScreen('Settings', topLevel)} />
            <Stack.Screen name="livery" options={{ title: 'Livery' }} />
            <Stack.Screen name="dev/design-system" options={{ title: 'Design system' }} />
            <Stack.Screen name="dev/car-views" options={{ title: 'Car views' }} />
            <Stack.Screen name="compare" options={{ title: 'Compare generations' }} />
            <Stack.Screen name="how-races-work" options={{ title: 'How races work' }} />
            {/* Swipe-back is off on these two because dragging the race-length slider or a pit stop to the right looks like a back swipe. */}
            <Stack.Screen name="create-session" options={{ title: 'New Race', gestureEnabled: false }} />
            <Stack.Screen name="strategy" options={{ title: 'Strategy', gestureEnabled: false }} />
            <Stack.Screen name="summary" options={{ title: 'Race Summary', headerBackVisible: false, headerLeft: () => null, unstable_headerLeftItems: noItems, gestureEnabled: false }} />
            <Stack.Screen name="session" options={{ title: 'Race', headerShown: false, gestureEnabled: false }} />
          </Stack>
          {TAB_PATHS.includes(pathname) && <TabBar />}
          <AlertHost />
        </View>
      </View>
    </ThemeProvider>
  );
}

// In a web browser the app is shown as a phone-sized column in the middle of the page.
const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', backgroundColor: Platform.OS === 'web' ? colors.backdrop : colors.background },
  app: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 460 : undefined, backgroundColor: colors.background },
  // the dev pages (design system, car views) use the whole browser window
  appFull: { maxWidth: '100%' },
});
