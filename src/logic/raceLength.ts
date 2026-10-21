import type { Track } from '../models/types';

/** The longest race you can set: 2 hours of racing (pit stop breaks come on top). */
export const MAX_RACE_SECONDS = 2 * 60 * 60;

/** The most laps you can set at this track: as many as fit in 2 hours, so longer than the real race. */
export function maxLaps(track: Pick<Track, 'lapTimeSeconds' | 'raceLaps'>): number {
  return Math.max(track.raceLaps, Math.floor(MAX_RACE_SECONDS / track.lapTimeSeconds));
}

/** Laps for a chosen number of minutes, snapped to a whole lap (at least 1, at most 2 hours of racing). */
export function lapsFromMinutes(track: Pick<Track, 'lapTimeSeconds' | 'raceLaps'>, minutes: number): number {
  const laps = Math.round((minutes * 60) / track.lapTimeSeconds);
  return clampLaps(track, laps);
}

/** The whole minute closest to the time `laps` takes, used to place the minutes slider. */
export function minutesForLaps(track: Pick<Track, 'lapTimeSeconds'>, laps: number): number {
  return Math.round((laps * track.lapTimeSeconds) / 60);
}

/** The longest race on the minutes slider, in whole minutes. */
export function maxMinutes(track: Pick<Track, 'lapTimeSeconds' | 'raceLaps'>): number {
  return minutesForLaps(track, maxLaps(track));
}

export function clampLaps(track: Pick<Track, 'lapTimeSeconds' | 'raceLaps'>, laps: number): number {
  return Math.max(1, Math.min(Math.round(laps), maxLaps(track)));
}
