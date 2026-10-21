import type { Session, Track } from '../models/types';
import { NO_AWAY, penaltyPercent } from './distraction';
import type { AwayTotals } from './distraction';

/** Planned focus time for a number of whole laps. */
export function lapsToSeconds(track: Track, laps: number): number {
  return laps * track.lapTimeSeconds;
}

/** Whole laps finished after `focusedSeconds`, never more than `plannedLaps`. */
export function completedLaps(track: Track, focusedSeconds: number, plannedLaps: number): number {
  const laps = Math.floor(focusedSeconds / track.lapTimeSeconds);
  return Math.max(0, Math.min(laps, plannedLaps));
}

export function distanceKm(track: Track, laps: number): number {
  return Math.round(laps * track.lapLengthKm * 1000) / 1000;
}

/** 1 XP and 1 credit per full minute focused, so ending early still pays for the time spent. */
export function xpForSeconds(focusedSeconds: number): number {
  return Math.floor(Math.max(0, focusedSeconds) / 60);
}

export function creditsForSeconds(focusedSeconds: number): number {
  return xpForSeconds(focusedSeconds);
}

/** Level n needs 50 * (n - 1)^2 total XP: 0, 50, 200, 450, 800, ... */
export function levelForXp(totalXp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, totalXp) / 50)) + 1;
}

export function xpForLevel(level: number): number {
  return 50 * (level - 1) * (level - 1);
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  xpIntoLevel: number;
  /** XP the current level spans. */
  xpForNextLevel: number;
  /** 0 to 1 toward the next level. */
  fraction: number;
}

export function levelProgress(totalXp: number): LevelProgress {
  const level = levelForXp(totalXp);
  const floor = xpForLevel(level);
  const span = xpForLevel(level + 1) - floor;
  const into = Math.max(0, totalXp) - floor;
  return { level, xpIntoLevel: into, xpForNextLevel: span, fraction: span === 0 ? 0 : into / span };
}

export interface SessionInput {
  id: string;
  track: Track;
  plannedLaps: number;
  focusedSeconds: number;
  startedAt: Date;
  endedAt: Date;
  /** Distractions during the race (see logic/distraction.ts). */
  away?: AwayTotals;
  crashed?: boolean;
  /** The planned strategy and the pit stops taken (see logic/strategy.ts). */
  strategy?: Session['strategy'];
  pitStops?: Session['pitStops'];
  slowStops?: number;
}

/** `amount` with `percent` taken off, rounded down (whole numbers only, so no rounding surprises). */
function afterPenalty(amount: number, percent: number): number {
  return Math.floor((amount * (100 - percent)) / 100);
}

export function buildSession(input: SessionInput): Session {
  const { track, plannedLaps } = input;
  const plannedSeconds = lapsToSeconds(track, plannedLaps);
  // Never credit more focus time than the session planned.
  const focusedSeconds = Math.max(0, Math.min(Math.floor(input.focusedSeconds), plannedSeconds));
  const laps = completedLaps(track, focusedSeconds, plannedLaps);
  const away = input.away ?? NO_AWAY;
  const slowStops = input.slowStops ?? 0;
  const penalty = penaltyPercent(away, slowStops);
  return {
    id: input.id,
    trackId: track.id,
    plannedLaps,
    focusedSeconds,
    completedLaps: laps,
    finished: focusedSeconds >= plannedSeconds,
    startedAt: input.startedAt.toISOString(),
    endedAt: input.endedAt.toISOString(),
    distanceKm: distanceKm(track, laps),
    xpEarned: afterPenalty(xpForSeconds(focusedSeconds), penalty),
    creditsEarned: afterPenalty(creditsForSeconds(focusedSeconds), penalty),
    ...(input.away && input.away.seconds > 0 ? { awaySeconds: Math.round(input.away.seconds), trackLimits: input.away.trackLimits, yellowFlags: input.away.yellowFlags } : {}),
    ...(penalty > 0 ? { rewardPenaltyPercent: penalty } : {}),
    ...(input.crashed ? { crashed: true } : {}),
    ...(input.strategy ? { strategy: input.strategy } : {}),
    ...(input.pitStops && input.pitStops.length > 0 ? { pitStops: input.pitStops.map((s) => ({ lap: s.lap, seconds: Math.round(s.seconds) })) } : {}),
    ...(slowStops > 0 ? { slowStops } : {}),
  };
}
