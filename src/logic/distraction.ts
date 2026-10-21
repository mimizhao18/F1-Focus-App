// The rules for leaving the app in the middle of a race. Pure functions, so they can be tested (npm run check).
// Time spent away never counts as focus time. How long you were away decides the consequence:
//   5 s to 30 s    track limits warning   a warning when you come back
//   30 s to 3 min  yellow flag            a stronger warning when you come back
//   3 min or more  crash                  the race ends with a DNF
// Pausing first excuses a break of up to 5 minutes. After that, time away counts as a distraction again.
// Two or more warnings (track limits warnings, yellow flags and slow pit stops together) also cut the XP and credits you earn:
// 10% off for two, another 10% for each further one, never more than 50%.

export const RULES = {
  trackLimitsAfterSeconds: 5,
  yellowFlagAfterSeconds: 30,
  crashAfterSeconds: 180,
  pauseLimitSeconds: 300,
} as const;

/** How the rewards shrink as warnings pile up. */
export const PENALTY = {
  /** Warnings (track limits warnings plus yellow flags) that cost nothing. */
  freeWarnings: 1,
  /** Percent taken off the rewards for each warning after the free ones. */
  stepPercent: 10,
  maxPercent: 50,
} as const;

export type Distraction = 'none' | 'track-limits' | 'yellow' | 'crash';

/** What leaving the race for `awaySeconds` costs you. */
export function classifyAway(awaySeconds: number): Distraction {
  if (awaySeconds >= RULES.crashAfterSeconds) return 'crash';
  if (awaySeconds >= RULES.yellowFlagAfterSeconds) return 'yellow';
  if (awaySeconds >= RULES.trackLimitsAfterSeconds) return 'track-limits';
  return 'none';
}

/** How many seconds of an excused break are left, given how long the race has been paused. */
export function pauseSecondsLeft(pausedForMs: number): number {
  return Math.max(0, RULES.pauseLimitSeconds - pausedForMs / 1000);
}

/** The totals of a race's distractions, saved with the race. */
export interface AwayTotals {
  seconds: number;
  trackLimits: number;
  yellowFlags: number;
}

export const NO_AWAY: AwayTotals = { seconds: 0, trackLimits: 0, yellowFlags: 0 };

/** Adds one absence to the totals. */
export function addAway(totals: AwayTotals, awaySeconds: number): AwayTotals {
  const kind = classifyAway(awaySeconds);
  return {
    seconds: totals.seconds + awaySeconds,
    trackLimits: totals.trackLimits + (kind === 'track-limits' ? 1 : 0),
    yellowFlags: totals.yellowFlags + (kind === 'yellow' ? 1 : 0),
  };
}

/** The warnings in a race that count toward the rewards penalty: track limits warnings, yellow flags and slow pit stops. */
export function warningCount(totals: AwayTotals, slowStops = 0): number {
  return totals.trackLimits + totals.yellowFlags + slowStops;
}

/** The percent taken off XP and credits for the warnings in a race: 0 for none or one, 10 for two, 20 for three, up to 50. */
export function penaltyPercent(totals: AwayTotals, slowStops = 0): number {
  const warnings = warningCount(totals, slowStops);
  if (warnings <= PENALTY.freeWarnings) return 0;
  return Math.min(PENALTY.maxPercent, (warnings - PENALTY.freeWarnings) * PENALTY.stepPercent);
}

/** What the rewards are multiplied by: 1 for no penalty, 0.9 for 10%, and so on. */
export function rewardMultiplier(totals: AwayTotals, slowStops = 0): number {
  return 1 - penaltyPercent(totals, slowStops) / 100;
}
