import { decodeStrategy, encodeStrategy } from '../logic/strategy';
import type { Strategy } from '../logic/strategy';
import { readJson, removeKey, writeJson } from './storage';

export const STRATEGIES_KEY = 'strategies.v1';

/** The last custom strategy the player raced at each track, as text ("m24-s16"), by track id. */
type Saved = Record<string, string>;

const isSaved = (value: unknown): value is Saved =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every((v) => typeof v === 'string');

/** The strategy last built for this track, or null if there is none (or it cannot be read). */
export async function loadSavedStrategy(trackId: string): Promise<Strategy | null> {
  const saved = await readJson<Saved>(STRATEGIES_KEY, {}, isSaved);
  return decodeStrategy(saved[trackId]);
}

/** Remembers the strategy raced at this track, to open the builder on it next time. */
export async function saveStrategy(trackId: string, strategy: Strategy): Promise<void> {
  const saved = await readJson<Saved>(STRATEGIES_KEY, {}, isSaved);
  await writeJson(STRATEGIES_KEY, { ...saved, [trackId]: encodeStrategy(strategy) });
}

export async function clearSavedStrategies(): Promise<void> {
  await removeKey(STRATEGIES_KEY);
}
