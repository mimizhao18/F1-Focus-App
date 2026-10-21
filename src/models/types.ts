export type TrackId =
  | 'silverstone'
  | 'monaco'
  | 'spa'
  | 'australia'
  | 'china'
  | 'japan'
  | 'bahrain'
  | 'miami'
  | 'canada'
  | 'barcelona'
  | 'austria'
  | 'hungary'
  | 'netherlands'
  | 'italy'
  | 'madrid'
  | 'azerbaijan'
  | 'singapore'
  | 'united-states'
  | 'mexico'
  | 'brazil'
  | 'las-vegas'
  | 'qatar'
  | 'abu-dhabi';

/** Which flag to show (see src/components/Flag.tsx). */
export type CountryCode = 'GB' | 'MC' | 'BE' | 'AU' | 'CN' | 'JP' | 'BH' | 'US' | 'CA' | 'ES' | 'AT' | 'HU' | 'NL' | 'IT' | 'AZ' | 'SG' | 'MX' | 'BR' | 'QA' | 'AE';

export interface Track {
  id: TrackId;
  name: string;
  country: string;
  countryCode: CountryCode;
  /** Laps in the real Grand Prix. */
  raceLaps: number;
  lapLengthKm: number;
  /** The official Grand Prix distance (laps times lap length, as published by formula1.com). */
  raceDistanceKm: number;
  /** Seconds one lap takes in the app: the lap record rounded to the nearest 10 s. */
  lapTimeSeconds: number;
  /** The player level you need before this track opens (1 for the free tracks). */
  unlockLevel: number;
  viewBox: { width: number; height: number };
  /** Drawn road width in viewBox units (narrower on tracks whose strands run close together). */
  roadWidth: number;
  startFinish: { from: Point; to: Point };
  /** SVG path of the centerline. */
  path: string;
  /** Evenly spaced along the lap starting at the start/finish line; point i is i / length of a lap. */
  points: readonly (readonly [number, number])[];
}

export interface Point {
  x: number;
  y: number;
}

/** A tire compound (see logic/strategy.ts). */
export type Compound = 'soft' | 'medium' | 'hard';

/** One stint of a race: some laps on one set of tires. */
export interface Stint {
  compound: Compound;
  laps: number;
}

export interface Session {
  id: string;
  trackId: TrackId;
  plannedLaps: number;
  focusedSeconds: number;
  /** Whole laps finished (never more than plannedLaps). */
  completedLaps: number;
  /** True if the session ran to the end, false if ended early. */
  finished: boolean;
  /** ISO timestamps. */
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  xpEarned: number;
  creditsEarned: number;
  /** Seconds spent out of the app during the race (never counted as focus). Missing on races saved before this existed. */
  awaySeconds?: number;
  /** Absences of 5 to 30 seconds (track limits warnings) and of 30 seconds to 3 minutes (yellow flags). */
  trackLimits?: number;
  yellowFlags?: number;
  /** Percent taken off the XP and credits because of the warnings (only saved when it is more than 0). */
  rewardPenaltyPercent?: number;
  /** True if the race ended in a crash because you were away for too long (a DNF). */
  crashed?: boolean;
  /** The tire strategy and pit stop break length planned for the race (see logic/strategy.ts). Missing on races before pit stops. */
  strategy?: { stints: Stint[]; pitBreakSeconds: number };
  /** The pit stops taken: the lap you pitted after and how long you stayed (seconds, overstay included). */
  pitStops?: { lap: number; seconds: number }[];
  /** Pit stops where you stayed more than a minute past your break (each one counts as a warning). */
  slowStops?: number;
}

export interface CarSettings {
  /** Which livery (see src/data/liveries.ts) the car wears. */
  liveryId: string;
  number: number;
}

export interface PlayerProfile {
  totalXp: number;
  credits: number;
  currentStreak: number;
  longestStreak: number;
  /** Local calendar day (YYYY-MM-DD) of the last session that counted toward the streak. */
  lastSessionDay: string | null;
  /** Ids of the liveries owned (see src/data/liveries.ts). The free ones are always included. */
  unlockedLiveries: string[];
  car: CarSettings;
}
