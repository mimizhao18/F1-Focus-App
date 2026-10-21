import { useSyncExternalStore } from 'react';

import type { AppSettings } from '../logic/settings';
import { getSettingsSnapshot, subscribeToSettings } from '../storage/settings';

/** The player's settings; the screen redraws whenever they change. Change them with updateSettings (src/storage/settings.ts). */
export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribeToSettings, getSettingsSnapshot, getSettingsSnapshot);
}
