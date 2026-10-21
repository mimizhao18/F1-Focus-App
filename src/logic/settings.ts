// The player's preferences (saved as settings.v1). Pure functions, so they can be tested (npm run check).

export type LengthMode = 'laps' | 'minutes';
export type DistanceUnit = 'km' | 'mi';

export interface LastRace {
  trackId: string;
  laps: number;
}

export interface AppSettings {
  /** Your name, shown on Home and the race summary. Empty until you set it. */
  driverName: string;
  /** Three capital letters, like on a timing screen. Empty means it is taken from the name (see `driverCodeFor`). */
  driverCode: string;
  /** New Race opens on the track and length of your last race. */
  rememberLastRace: boolean;
  lastRace: LastRace | null;
  /** Whether New Race sets the length in laps or in minutes when it opens. */
  lengthMode: LengthMode;
  /** The five red lights before a race. Off: the race starts at once. */
  startLights: boolean;
  distanceUnit: DistanceUnit;
  /** Vibrate on race events (start lights, laps, warnings, the finish). */
  haptics: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  driverName: '',
  driverCode: '',
  rememberLastRace: true,
  lastRace: null,
  lengthMode: 'laps',
  startLights: true,
  distanceUnit: 'km',
  haptics: true,
};

export const DRIVER_NAME_MAX = 24;
export const DRIVER_CODE_LENGTH = 3;
export const KM_PER_MILE = 1.609344;

/** What can go in a driver code: capital letters A to Z only, at most three. "ham1" -> "HAM". */
export function cleanDriverCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, DRIVER_CODE_LENGTH);
}

/** The code shown for a driver: the one they typed, or the first three letters of the last word of their name ("Lewis Hamilton" -> "HAM"). */
export function driverCodeFor(settings: Pick<AppSettings, 'driverName' | 'driverCode'>): string {
  if (settings.driverCode.length === DRIVER_CODE_LENGTH) return settings.driverCode;
  const words = settings.driverName.trim().split(/\s+/).map(cleanDriverCode).filter(Boolean);
  const last = words[words.length - 1] ?? '';
  return last.length === DRIVER_CODE_LENGTH ? last : '';
}

/** A distance in the chosen unit, for example 5.891 km -> { value: "3.66", unit: "mi" } with 2 decimals. */
export function formatDistance(km: number, unit: DistanceUnit, decimals: number): { value: string; unit: DistanceUnit } {
  const amount = unit === 'mi' ? km / KM_PER_MILE : km;
  return { value: amount.toFixed(decimals), unit };
}

/** Turns whatever was saved into valid settings. Every field that is missing or wrong falls back to its default on its own. */
export function normalizeSettings(raw: unknown, knownTrackIds: readonly string[]): AppSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;
  const s = raw as Record<string, unknown>;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

  const last = typeof s.lastRace === 'object' && s.lastRace !== null ? (s.lastRace as Record<string, unknown>) : null;
  const lastRace =
    last && typeof last.trackId === 'string' && knownTrackIds.includes(last.trackId) && typeof last.laps === 'number' && Number.isInteger(last.laps) && last.laps >= 1
      ? { trackId: last.trackId, laps: last.laps }
      : null;
  const code = typeof s.driverCode === 'string' ? cleanDriverCode(s.driverCode) : '';

  return {
    driverName: typeof s.driverName === 'string' ? s.driverName.slice(0, DRIVER_NAME_MAX) : DEFAULT_SETTINGS.driverName,
    driverCode: code.length === DRIVER_CODE_LENGTH ? code : '',
    rememberLastRace: bool(s.rememberLastRace, DEFAULT_SETTINGS.rememberLastRace),
    lastRace,
    lengthMode: s.lengthMode === 'laps' || s.lengthMode === 'minutes' ? s.lengthMode : DEFAULT_SETTINGS.lengthMode,
    startLights: bool(s.startLights, DEFAULT_SETTINGS.startLights),
    distanceUnit: s.distanceUnit === 'km' || s.distanceUnit === 'mi' ? s.distanceUnit : DEFAULT_SETTINGS.distanceUnit,
    haptics: bool(s.haptics, DEFAULT_SETTINGS.haptics),
  };
}
