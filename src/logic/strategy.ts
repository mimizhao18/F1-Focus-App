// Tire strategy and pit stops: the planned breaks in a long race. Pure functions, so they can be tested (npm run check).
//
// Each stint runs on one tire compound. A compound has a target life (what the recommended strategies aim for) and a
// longer maximum life (the wiggle room): no stint may run past its tire's maximum, so a race longer than a hard tire's
// maximum (60 min) needs at least one stop. A stop happens at the end of a stint and is a break of 2 to 5 minutes.
// Stints are whole laps, so a tire's life in laps is rounded down: a stint never runs longer than the tire allows.

import type { Compound, Stint, Track } from '../models/types';

export type { Compound, Stint };
export const COMPOUNDS: readonly Compound[] = ['soft', 'medium', 'hard'];

export const TIRES: Record<Compound, { name: string; letter: string; targetMinutes: number; maxMinutes: number }> = {
  soft: { name: 'Soft', letter: 'S', targetMinutes: 15, maxMinutes: 20 },
  medium: { name: 'Medium', letter: 'M', targetMinutes: 30, maxMinutes: 40 },
  hard: { name: 'Hard', letter: 'H', targetMinutes: 45, maxMinutes: 60 },
};

export interface Strategy {
  stints: Stint[];
}

export const MAX_STOPS = 3;
/** How long a pit stop break can be, in minutes. */
export const PIT_BREAK_MINUTES = [2, 3, 4, 5] as const;
export const DEFAULT_PIT_BREAK_MINUTES = 3;

/** What happens if you stay in the pits after your break is over (counted from the end of the break). */
export const PIT_EXIT = {
  /** A slow stop: a warning, which counts toward the rewards penalty like a track limits warning. */
  slowStopAfterSeconds: 60,
  /** The race ends with a DNF, as when you leave the race for too long. */
  crashAfterSeconds: 180,
} as const;

export const stopCount = (strategy: Strategy) => strategy.stints.length - 1;

/** How many laps a tire lasts at this track: its target life (what plans aim for) or its maximum. At least 1 lap. */
export function tireLaps(track: Pick<Track, 'lapTimeSeconds'>, compound: Compound, life: 'target' | 'max'): number {
  const minutes = life === 'target' ? TIRES[compound].targetMinutes : TIRES[compound].maxMinutes;
  return Math.max(1, Math.floor((minutes * 60) / track.lapTimeSeconds));
}

/**
 * Shares the race's laps between stints on these compounds, in proportion to each tire's target life (so a soft stint
 * is shorter than a hard one), never more than a tire's maximum and never less than 1 lap. Null if the tires cannot
 * cover the distance (or there are more stints than laps).
 */
export function splitLaps(track: Pick<Track, 'lapTimeSeconds'>, totalLaps: number, compounds: readonly Compound[]): Stint[] | null {
  const n = compounds.length;
  if (n === 0 || totalLaps < n) return null;
  const max = compounds.map((c) => tireLaps(track, c, 'max'));
  if (max.reduce((a, b) => a + b, 0) < totalLaps) return null;
  const target = compounds.map((c) => TIRES[c].targetMinutes);
  const laps = compounds.map(() => 1);
  // one lap at a time to the stint furthest below its share, so the split stays proportional and whole
  for (let left = totalLaps - n; left > 0; left--) {
    let pick = -1;
    for (let i = 0; i < n; i++) {
      if (laps[i] >= max[i]) continue;
      if (pick < 0 || laps[i] / target[i] < laps[pick] / target[pick]) pick = i;
    }
    laps[pick] += 1;
  }
  return compounds.map((compound, i) => ({ compound, laps: laps[i] }));
}

/** True if the strategy covers exactly the race, with no stint past its tire's maximum and no more than MAX_STOPS stops. */
export function isValidStrategy(track: Pick<Track, 'lapTimeSeconds'>, totalLaps: number, strategy: Strategy): boolean {
  const { stints } = strategy;
  if (stints.length < 1 || stints.length > MAX_STOPS + 1) return false;
  if (stints.reduce((sum, s) => sum + s.laps, 0) !== totalLaps) return false;
  return stints.every((s) => COMPOUNDS.includes(s.compound) && Number.isInteger(s.laps) && s.laps >= 1 && s.laps <= tireLaps(track, s.compound, 'max'));
}

/** The laps after which you pit: the end of every stint but the last. [20] for 20 laps on mediums then 20 on hards. */
export function pitLaps(strategy: Strategy): number[] {
  const ends: number[] = [];
  let lap = 0;
  for (const stint of strategy.stints.slice(0, -1)) {
    lap += stint.laps;
    ends.push(lap);
  }
  return ends;
}

/** Where each stint starts and ends, in laps: [{ from: 1, to: 20 }, { from: 21, to: 40 }]. */
export function stintRanges(stints: readonly Stint[]): { from: number; to: number }[] {
  return stints.map((_, i) => {
    const before = stints.slice(0, i).reduce((sum, s) => sum + s.laps, 0);
    return { from: before + 1, to: before + stints[i].laps };
  });
}

/** The stint you are on after `completedLaps` laps (during a pit stop, the stint you are about to start). */
export function stintIndexAt(strategy: Strategy, completedLaps: number): number {
  return pitLaps(strategy).filter((lap) => lap <= completedLaps).length;
}

/** The fewest stops that can cover the race (hard tires to their maximum), or null if even MAX_STOPS cannot. */
export function minStops(track: Pick<Track, 'lapTimeSeconds'>, totalLaps: number): number | null {
  const hard = tireLaps(track, 'hard', 'max');
  const stops = Math.max(0, Math.ceil(totalLaps / hard) - 1);
  return stops <= MAX_STOPS ? stops : null;
}

/** Every way to fit `n` compounds in a row, softest first. */
function sequences(n: number): Compound[][] {
  if (n === 0) return [[]];
  return COMPOUNDS.flatMap((c) => sequences(n - 1).map((rest) => [c, ...rest]));
}

/**
 * The best strategy with this many stops: every stint as close to its tire's target life as possible, then the most even
 * stints (so the breaks are evenly spaced), then the softest start. Null if no strategy with this many stops works.
 */
export function bestStrategy(track: Pick<Track, 'lapTimeSeconds'>, totalLaps: number, stops: number): Strategy | null {
  if (stops < 0 || stops > MAX_STOPS) return null;
  let best: { strategy: Strategy; miss: number; longest: number } | null = null;
  for (const compounds of sequences(stops + 1)) {
    const stints = splitLaps(track, totalLaps, compounds);
    if (!stints) continue;
    const seconds = stints.map((s) => s.laps * track.lapTimeSeconds);
    const miss = stints.reduce((sum, s, i) => sum + Math.abs(seconds[i] - TIRES[s.compound].targetMinutes * 60), 0);
    const longest = Math.max(...seconds);
    if (!best || miss < best.miss || (miss === best.miss && longest < best.longest)) best = { strategy: { stints }, miss, longest };
  }
  return best?.strategy ?? null;
}

export type StrategyKind = 'recommended' | 'fewer' | 'more';

export interface StrategyOption {
  kind: StrategyKind;
  strategy: Strategy;
}

/** "No-stopper", "One-stopper", ... as on a race strategy graphic. */
export function stopperName(stops: number): string {
  return ['No-stopper', 'One-stopper', 'Two-stopper', 'Three-stopper'][stops] ?? `${stops}-stopper`;
}

/** A stint shorter than this on average is not worth an extra stop, so "more breaks" is not offered. */
const MIN_AVERAGE_STINT_MINUTES = 10;

/**
 * The strategies offered first, recommended one first: a break about every 45 minutes (one hard tire's target), but never
 * fewer stops than the tires need. Then one stop fewer and one stop more, where those work.
 */
export function strategyOptions(track: Pick<Track, 'lapTimeSeconds'>, totalLaps: number): StrategyOption[] {
  const fewest = minStops(track, totalLaps);
  if (fewest === null) return [];
  const minutes = (totalLaps * track.lapTimeSeconds) / 60;
  const recommendedStops = Math.min(MAX_STOPS, Math.max(fewest, Math.ceil(minutes / TIRES.hard.targetMinutes) - 1));
  const options: StrategyOption[] = [];
  const add = (kind: StrategyKind, stops: number) => {
    const strategy = bestStrategy(track, totalLaps, stops);
    if (strategy) options.push({ kind, strategy });
  };
  add('recommended', recommendedStops);
  if (recommendedStops - 1 >= fewest) add('fewer', recommendedStops - 1);
  if (recommendedStops + 1 <= MAX_STOPS && minutes / (recommendedStops + 2) >= MIN_AVERAGE_STINT_MINUTES) add('more', recommendedStops + 1);
  return options;
}

/** A strategy as text for a link: "m20-h20". */
export function encodeStrategy(strategy: Strategy): string {
  return strategy.stints.map((s) => `${TIRES[s.compound].letter.toLowerCase()}${s.laps}`).join('-');
}

/** Reads a strategy back from `encodeStrategy`, or null if the text is not one. */
export function decodeStrategy(text: string | undefined): Strategy | null {
  if (!text) return null;
  const byLetter = Object.fromEntries(COMPOUNDS.map((c) => [TIRES[c].letter.toLowerCase(), c])) as Record<string, Compound>;
  const stints: Stint[] = [];
  for (const part of text.split('-')) {
    const match = /^([a-z])(\d{1,3})$/.exec(part);
    const compound = match ? byLetter[match[1]] : undefined;
    if (!match || !compound) return null;
    stints.push({ compound, laps: Number(match[2]) });
  }
  return { stints };
}
