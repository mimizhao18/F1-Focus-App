import { TRACK_LIST } from '../data/tracks';
import { DEFAULT_SETTINGS, normalizeSettings } from '../logic/settings';
import type { AppSettings } from '../logic/settings';
import { readJson, removeKey, writeJson } from './storage';

export const SETTINGS_KEY = 'settings.v1';

const TRACK_IDS = TRACK_LIST.map((t) => t.id);

// One copy of the settings for the whole app, so a change on the Settings screen shows everywhere at once.
// It holds the defaults until the saved settings have been read (the root layout starts that at launch).
let current: AppSettings = DEFAULT_SETTINGS;
let loading: Promise<AppSettings> | null = null;
const listeners = new Set<() => void>();

function publish(next: AppSettings) {
  current = next;
  listeners.forEach((listener) => listener());
}

/** The settings right now (the defaults if they have not been read yet). */
export function getSettingsSnapshot(): AppSettings {
  return current;
}

export function subscribeToSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reads the saved settings once; later calls return the same result. */
export function loadSettings(): Promise<AppSettings> {
  loading ??= readJson<unknown>(SETTINGS_KEY, null, (v): v is unknown => true).then((raw) => {
    publish(normalizeSettings(raw, TRACK_IDS));
    return current;
  });
  return loading;
}

/** Changes some settings and saves them. The change shows at once; saving happens in the background. */
export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  publish({ ...current, ...patch });
  await writeJson(SETTINGS_KEY, current);
}

/** Deletes the saved settings and goes back to the defaults. */
export async function resetSettings(): Promise<void> {
  await removeKey(SETTINGS_KEY);
  loading = Promise.resolve(DEFAULT_SETTINGS);
  publish(DEFAULT_SETTINGS);
}
