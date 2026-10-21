import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { getSettingsSnapshot } from '../storage/settings';

/** The moments that can buzz the phone, and how each one feels. */
const FEEDBACK = {
  'light-on': () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  'lights-out': () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  lap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  finish: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  crash: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  toggle: () => Haptics.selectionAsync(),
  'box-box': () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  'pit-in': () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  'pit-exit': () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
} as const;

export type HapticEvent = keyof typeof FEEDBACK;

/**
 * A short vibration for a race event, unless haptics are turned off in Settings. Never throws: a phone without
 * vibration simply does nothing. Not on the web: browsers refuse to vibrate without a fresh tap (and log an error each time),
 * and the web build is a desktop demo.
 */
export function haptic(event: HapticEvent): void {
  if (Platform.OS === 'web' || !getSettingsSnapshot().haptics) return;
  try {
    FEEDBACK[event]().catch(() => {});
  } catch {
    // no vibration on this device
  }
}
