import { router } from 'expo-router';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { ListRow, SectionLabel, SegmentedControl } from '../components/ui';
import { MAX_CAR_NUMBER, MIN_CAR_NUMBER } from '../data/liveries';
import { makeStyles, useTheme } from '../design/styles';
import { DRIVER_CODE_LENGTH, DRIVER_NAME_MAX, cleanDriverCode, driverCodeFor } from '../logic/settings';
import type { AppSettings, DistanceUnit, LengthMode } from '../logic/settings';
import { loadDemoData } from '../storage/demo';
import { resetAllData } from '../storage/reset';
import { updateSettings } from '../storage/settings';
import { showAlert } from '../ui/alert';
import { haptic } from '../ui/haptics';
import { useGarage } from '../ui/useGarage';
import { useSettings } from '../ui/useSettings';

const LENGTH_MODES: readonly LengthMode[] = ['laps', 'minutes'];
const UNITS: readonly DistanceUnit[] = ['km', 'mi'];
/** A long press on the race number buttons jumps this far. */
const NUMBER_JUMP = 10;

/** Back to the previous screen, or Home if the page was opened directly (for example after a browser refresh). */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function save(patch: Partial<AppSettings>) {
  updateSettings(patch).catch(() => showAlert('Could not save', 'Your change was not saved. Please try again.'));
}

export default function SettingsScreen() {
  const styles = useStyles();
  const t = useTheme();
  const settings = useSettings();
  const { profile, changeNumber } = useGarage();

  /** Flips an on/off setting, with a tick of feedback (felt only if haptics are on after the change). */
  const flip = (patch: Partial<AppSettings>) => {
    save(patch);
    haptic('toggle');
  };

  const stepNumber = (delta: number) => {
    if (!profile) return;
    const next = Math.max(MIN_CAR_NUMBER, Math.min(MAX_CAR_NUMBER, profile.car.number + delta));
    if (next !== profile.car.number) changeNumber(next - profile.car.number);
  };

  const confirmReset = () => {
    showAlert(
      'Reset all data?',
      'This deletes every saved race, resets your XP, credits, streak and car, and puts your driver details and settings back to the start. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset everything',
          style: 'destructive',
          onPress: () => {
            resetAllData().then(
              () => goBack(),
              () => showAlert('Could not reset', 'Something went wrong. Please try again.'),
            );
          },
        },
      ],
    );
  };

  const confirmDemo = () => {
    showAlert('Load demo data?', 'This replaces all your current data with example races, XP, credits and a streak.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Load demo data',
        onPress: () => {
          loadDemoData().then(
            () => goBack(),
            () => showAlert('Could not load demo data', 'Something went wrong. Please try again.'),
          );
        },
      },
    ]);
  };

  const suggestedCode = driverCodeFor({ driverName: settings.driverName, driverCode: '' });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <SectionLabel>Driver</SectionLabel>
        <View>
          <ListRow
            title="Name"
            accessory={
              <TextInput
                style={[styles.field, styles.nameField]}
                value={settings.driverName}
                onChangeText={(driverName) => save({ driverName })}
                placeholder="Your name"
                placeholderTextColor={t.colors.textMuted}
                maxLength={DRIVER_NAME_MAX}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                accessibilityLabel="Driver name"
              />
            }
          />
          <ListRow
            title="Code"
            subtitle="Three letters, as on a timing screen."
            accessory={
              <TextInput
                style={[styles.field, styles.codeField]}
                value={settings.driverCode}
                onChangeText={(text) => save({ driverCode: cleanDriverCode(text) })}
                placeholder={suggestedCode || 'ABC'}
                placeholderTextColor={t.colors.textMuted}
                maxLength={DRIVER_CODE_LENGTH}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                accessibilityLabel="Driver code"
                accessibilityHint={suggestedCode ? `Leave empty to use ${suggestedCode}, from your name.` : undefined}
              />
            }
          />
          <ListRow
            title="Race number"
            subtitle="On your car's rear wing. Hold a button to jump by 10."
            last
            accessory={
              profile ? (
                <View style={styles.stepperRow}>
                  <Pressable
                    style={({ pressed }) => [styles.stepper, pressed && styles.pressed]}
                    onPress={() => stepNumber(-1)}
                    onLongPress={() => stepNumber(-NUMBER_JUMP)}
                    disabled={profile.car.number <= MIN_CAR_NUMBER}
                    accessibilityRole="button"
                    accessibilityLabel="Lower race number"
                  >
                    <Text style={styles.stepperText}>−</Text>
                  </Pressable>
                  <Text style={styles.number} accessibilityLabel={`Race number ${profile.car.number}`}>
                    {profile.car.number}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [styles.stepper, pressed && styles.pressed]}
                    onPress={() => stepNumber(1)}
                    onLongPress={() => stepNumber(NUMBER_JUMP)}
                    disabled={profile.car.number >= MAX_CAR_NUMBER}
                    accessibilityRole="button"
                    accessibilityLabel="Raise race number"
                  >
                    <Text style={styles.stepperText}>+</Text>
                  </Pressable>
                </View>
              ) : null
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel>Race</SectionLabel>
        <View>
          <ListRow
            title="Remember my last race"
            subtitle="New Race opens on the track and length you raced last."
            toggle={{ value: settings.rememberLastRace, onChange: (rememberLastRace) => flip({ rememberLastRace }) }}
          />
          <ListRow
            title="Set length in"
            accessory={
              <View style={styles.modeControl}>
                <SegmentedControl options={LENGTH_MODES} value={settings.lengthMode} onChange={(lengthMode) => save({ lengthMode })} labelFor={(m) => (m === 'laps' ? 'Laps' : 'Minutes')} />
              </View>
            }
          />
          <ListRow
            title="Start lights"
            subtitle="Five red lights before every race. Off: the race starts at once."
            toggle={{ value: settings.startLights, onChange: (startLights) => flip({ startLights }) }}
          />
          <ListRow
            title="Distance"
            last
            accessory={
              <View style={styles.unitControl}>
                <SegmentedControl options={UNITS} value={settings.distanceUnit} onChange={(distanceUnit) => save({ distanceUnit })} />
              </View>
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel>Feedback</SectionLabel>
        <ListRow
          title="Haptics"
          subtitle="A buzz for each start light, lights out, every lap, warnings and the finish."
          toggle={{ value: settings.haptics, onChange: (haptics) => flip({ haptics }) }}
          last
        />
      </View>

      <View style={styles.section}>
        <SectionLabel>Rules</SectionLabel>
        <ListRow title="How races work" subtitle="Laps, rewards, levels, streaks, and what leaving the app costs." onPress={() => router.push('/how-races-work')} last />
      </View>

      <View style={styles.section}>
        <SectionLabel>Cars</SectionLabel>
        <ListRow title="Compare generations" subtitle="Any two generations side by side, at the same scale and angle." onPress={() => router.push('/compare')} last />
      </View>

      <View style={styles.section}>
        <SectionLabel>Data</SectionLabel>
        <ListRow title="Reset all data" subtitle="Your races, progress and settings are saved only on this phone." destructive chevron={false} onPress={confirmReset} last />
      </View>

      {__DEV__ && (
        <View style={styles.section}>
          <SectionLabel>Development only</SectionLabel>
          <View>
            <ListRow title="Load demo data" subtitle="A week of example races, a 5-day streak and credits to spend. Reset all data clears it." chevron={false} onPress={confirmDemo} />
            <ListRow title="Design system" subtitle="Every color, text style and shared component on one page." onPress={() => router.push('/dev/design-system')} last />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  container: { padding: t.spacing.screen, gap: t.spacing.xl, paddingBottom: t.spacing.xxl },
  section: { gap: t.spacing.xs },
  field: {
    minHeight: t.size.touch,
    paddingHorizontal: t.spacing.sm,
    borderWidth: t.border.hairline,
    borderColor: t.colors.border,
    borderRadius: t.radius.control,
    backgroundColor: t.colors.surface,
    color: t.colors.text,
  },
  nameField: { ...t.typography.body, width: t.size.field, textAlign: 'right' },
  codeField: { ...t.typography.statSmall, width: t.size.control + t.spacing.lg, textAlign: 'center', letterSpacing: 2 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  stepper: { width: t.size.touch, height: t.size.touch, borderRadius: t.radius.control, borderWidth: t.border.hairline, borderColor: t.colors.border, alignItems: 'center', justifyContent: 'center' },
  stepperText: { ...t.typography.stat, color: t.colors.text },
  pressed: { opacity: t.opacity.pressed },
  number: { ...t.typography.stat, color: t.colors.text, minWidth: t.size.touch, textAlign: 'center' },
  modeControl: { width: t.size.segmentWide },
  unitControl: { width: t.size.segmentNarrow },
}));
