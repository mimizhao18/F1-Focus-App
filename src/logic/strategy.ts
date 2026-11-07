// Tire strategy and pit stops: the planned breaks in a long race. Pure functions, so they can be tested (npm run check).
//
// Each stint runs on one tire compound. A compound has a life window, from a minimum to a maximum number of minutes
// (soft 15-30, medium 30-45, hard 45-65): every stint must fall inside its tire's window, so a stint is never cut short
// of the minimum or run past the maximum. A race longer than a hard tire's maximum (65 min) needs at least one stop. A
// stop happens at the end of a stint and is a break of 2 to 5 minutes. Stints are whole laps, so the minimum in laps is
// rounded up and the maximum rounded down: a stint is always inside the window. The one exception is a race with no
// stop that is shorter than the softest tire's minimum: there is only one stint, so it can run on any tire.

import type { Compound, Stint, Track } from '../models/types';

export type { Compound, Stint };
export const COMPOUNDS: readonly Compound[] = ['soft', 'medium', 'hard'];

/** Each tire's life window in minutes. `targetMinutes` is the middle of the window, what the recommended plans aim for. */
export const TIRES: Record<Compound, { name: string; letter: string; minMinutes: number; targetMinutes: number; maxMinutes: number }> = {
  soft: { name: 'Soft', letter: 'S', minMinutes: 15, targetMinutes: 22.5, maxMinutes: 30 },
  medium: { name: 'Medium', letter: 'M', minMinutes: 30, targetMinutes: 37.5, maxMinutes: 45 },
  hard: { name: 'Hard', letter: 'H', minMinutes: 45, targetMinutes: 55, maxMinutes: 65 },
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

/**
 * The edges of a tire's life window at this track, in whole laps: the fewest laps a stint on it may run (rounded up, so
 * the stint lasts at least the minimum) or the most (rounded down, so it never passes the maximum). At least 1 lap.
 */
export function tireLaps(track: Pick<Track, 'lapTimeSeconds'>, compound: Compound, edge: 'min' | 'max'): number {
  if (edge === 'min') return Math.max(1, Math.ceil((TIRES[compound].minMinutes * 60) / track.lapTimeSeconds));
  return Math.max(1, Math.floor((TIRES[compound].maxMinutes * 60) / track.lapTimeSeconds));
}

/** The fewest laps this stint may run: its tire's minimum, unless the whole race is one stint shorter than any tire's minimum. */
function minStintLaps(track: Pick<Track, 'lapTimeSeconds'>, compound: Compound, totalLaps: number, stintCount: number): number {
  const shortRace = stintCount === 1 && totalLaps * track.lapTimeSeconds < TIRES.soft.minMinutes * 60;
  return shortRace ? 1 : tireLaps(track, compound, 'min');
}

/** True if a stint of this many laps lasts a whole number of minutes (no half minutes, no stray seconds). */
const isWholeMinutes = (track: Pick<Track, 'lapTimeSeconds'>, laps: number) => (laps * track.lapTimeSeconds) % 60 === 0;

/** How many stints of the strategy do not last a whole number of minutes. */
export function looseStints(track: Pick<Track, 'lapTimeSeconds'>, stints: readonly Stint[]): number {
  return stints.filter((s) => !isWholeMinutes(track, s.laps)).length;
}

/**
 * Shares the race's laps between stints on these compounds, every stint inside its tire's window. Among the ways to do
 * that it prefers stints of a whole number of minutes (as many as the race allows: a race that is not a whole number of
 * minutes long cannot have all of them), then the split closest to each tire's target life, in proportion (so a soft
 * stint is shorter than a hard one). Null if the tires cannot cover the distance exactly inside their windows.
 */
export function splitLaps(track: Pick<Track, 'lapTimeSeconds'>, totalLaps: number, compounds: readonly Compound[]): Stint[] | null {
  const n = compounds.length;
  if (n === 0 || totalLaps < n) return null;
  const min = compounds.map((c) => minStintLaps(track, c, totalLaps, n));
  const max = compounds.map((c) => tireLaps(track, c, 'max'));
  // The cost of a stint: 1000 for each that is not whole minutes (beats any distance from the target), plus how far it is
  // from its tire's target, as a share of that target and squared.
  const cost = (i: number, laps: number) => {
    const share = (laps * track.lapTimeSeconds) / 60 / TIRES[compounds[i]].targetMinutes - 1;
    return (isWholeMinutes(track, laps) ? 0 : 1000) + share * share;
  };
  // best[used] = the cheapest way to give the stints so far `used` laps between them
  let best: number[] = Array<number>(totalLaps + 1).fill(Infinity);
  best[0] = 0;
  const picks: number[][] = [];
  for (let i = 0; i < n; i++) {
    const next: number[] = Array<number>(totalLaps + 1).fill(Infinity);
    const pick: number[] = Array<number>(totalLaps + 1).fill(0);
    for (let used = 0; used <= totalLaps; used++) {
      if (best[used] === Infinity) continue;
      for (let laps = min[i]; laps <= max[i] && used + laps <= totalLaps; laps++) {
        const total = best[used] + cost(i, laps);
        if (total < next[used + laps]) {
          next[used + laps] = total;
          pick[used + laps] = laps;
        }
      }
    }
    best = next;
    picks.push(pick);
  }
  if (best[totalLaps] === Infinity) return null;
  const laps: number[] = [];
  for (let i = n - 1, left = totalLaps; i >= 0; i--) {
    laps[i] = picks[i][left];
    left -= laps[i];
  }
  return compounds.map((compound, i) => ({ compound, laps: laps[i] }));
}

/** True if the strategy covers exactly the race, with every stint inside its tire's life window and no more than MAX_STOPS stops. */
export function isValidStrategy(track: Pick<Track, 'lapTimeSeconds'>, totalLaps: number, strategy: Strategy): boolean {
  const { stints } = strategy;
  if (stints.length < 1 || stints.length > MAX_STOPS + 1) return false;
  if (stints.reduce((sum, s) => sum + s.laps, 0) !== totalLaps) return false;
  return stints.every((s) => COMPOUNDS.includes(s.compound) && Number.isInteger(s.laps) && s.laps >= minStintLaps(track, s.compound, totalLaps, stints.length) && s.laps <= tireLaps(track, s.compound, 'max'));
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
 * The best strategy with this many stops: stints of whole minutes first, then every stint as close to its tire's target
 * life as possible, then the most even stints (so the breaks are evenly spaced), then the softest start. Null if no
 * strategy with this many stops works.
 */
export function bestStrategy(track: Pick<Track, 'lapTimeSeconds'>, totalLaps: number, stops: number): Strategy | null {
  if (stops < 0 || stops > MAX_STOPS) return null;
  let best: { strategy: Strategy; loose: number; miss: number; longest: number } | null = null;
  for (const compounds of sequences(stops + 1)) {
    const stints = splitLaps(track, totalLaps, compounds);
    if (!stints) continue;
    const seconds = stints.map((s) => s.laps * track.lapTimeSeconds);
    const miss = stints.reduce((sum, s, i) => sum + Math.abs(seconds[i] - TIRES[s.compound].targetMinutes * 60), 0);
    const longest = Math.max(...seconds);
    const loose = looseStints(track, stints);
    const better = !best || loose < best.loose || (loose === best.loose && (miss < best.miss || (miss === best.miss && longest < best.longest)));
    if (better) best = { strategy: { stints }, loose, miss, longest };
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

/**
 * The strategies offered first, recommended one first: a break about every 55 minutes (one hard tire's target), but never
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
  if (recommendedStops + 1 <= MAX_STOPS) add('more', recommendedStops + 1);
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
