import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { NO_AWAY, RULES, addAway, classifyAway, pauseSecondsLeft } from '../logic/distraction';
import type { AwayTotals, Distraction } from '../logic/distraction';
import { lapProgress } from '../logic/lapProgress';
import type { LapProgress } from '../logic/lapProgress';
import { PIT_EXIT } from '../logic/strategy';
import type { Session, Track } from '../models/types';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'pit' | 'finished' | 'ended';

/** What happened when you came back to the race after leaving it, or after staying in the pits too long. */
export interface RaceWarning {
  kind: Exclude<Distraction, 'none'> | 'slow-stop';
  awaySeconds: number;
  /** True for a crash at the pit exit (staying too long after the break) rather than leaving the race. */
  inPit?: boolean;
}

/** The planned pit stops: the laps after which you pit, and how long each break is. Keep the array the same between renders (useMemo). */
export interface PitPlan {
  afterLaps: readonly number[];
  breakSeconds: number;
}

/** A pit stop in progress. */
export interface PitState {
  /** Which stop this is, from 0. */
  index: number;
  /** The lap you pitted after. */
  lap: number;
  breakSeconds: number;
  /** Break time left (0 once the break is over and the pit exit is open). */
  secondsLeft: number;
  /** Seconds since the break ended, while you have not rejoined yet (0 during the break). */
  overstaySeconds: number;
}

type PitStopRecord = NonNullable<Session['pitStops']>[number];

export interface SessionTimer {
  status: TimerStatus;
  progress: LapProgress;
  startedAt: Date | null;
  endedAt: Date | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Stop before the planned laps are done. Only allowed while paused. */
  end: () => void;
  reset: () => void;
  /** The flag, slow stop or crash from your last absence, until it is dismissed. */
  warning: RaceWarning | null;
  dismissWarning: () => void;
  /** Seconds of the excused break left while paused, otherwise null. */
  pauseSecondsLeft: number | null;
  /** Time spent away from the race so far, and the flags it earned. */
  away: AwayTotals;
  /** True if the race ended because you were away for too long (or stayed in the pits too long). */
  crashed: boolean;
  /** The pit stop in progress, while status is 'pit'. */
  pit: PitState | null;
  /** Leave the pits and race again (any time during the break, or after it). */
  rejoin: () => void;
  /** The pit stops taken so far. */
  pitStops: PitStopRecord[];
  /** Pit stops where you stayed more than a minute past the break. */
  slowStops: number;
}

/**
 * Drives a focus session. Elapsed time comes from the clock (not from counting ticks), so it stays correct
 * if the app is throttled. `timeScale` speeds time up for testing, e.g. 30 makes a 90 s lap take 3 s.
 *
 * Time away from the app never counts: leaving freezes the race, and coming back applies the rules in logic/distraction.ts
 * (track limits warning, yellow flag, crash). Pausing first excuses a break of up to 5 minutes.
 *
 * Pit stops (`pits`): at the end of each stint but the last the race clock stops for the planned break, and time away
 * from the app is fine. When the break is over the race waits at the pit exit until you rejoin: more than a minute late
 * is a slow stop (a warning), more than 3 minutes ends the race with a DNF (logic/strategy.ts). Test speed shortens the break too.
 */
export function useSessionTimer(track: Track, plannedLaps: number, timeScale = 1, pits?: PitPlan): SessionTimer {
  const plannedSeconds = plannedLaps * track.lapTimeSeconds;
  const pitAfterLaps = pits?.afterLaps;
  const breakSeconds = pits?.breakSeconds ?? 0;
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [endedAt, setEndedAt] = useState<Date | null>(null);
  const [warning, setWarning] = useState<RaceWarning | null>(null);
  const [pauseLeft, setPauseLeft] = useState<number | null>(null);
  const [away, setAway] = useState<AwayTotals>(NO_AWAY);
  const [crashed, setCrashed] = useState(false);
  const [pit, setPit] = useState<PitState | null>(null);
  const [pitStops, setPitStops] = useState<PitStopRecord[]>([]);
  const [slowStops, setSlowStops] = useState(0);

  const statusRef = useRef<TimerStatus>('idle'); // the same as `status`, for callbacks that outlive a render
  const bankedMs = useRef(0); // progress from earlier running stretches
  const resumedAtMs = useRef<number | null>(null); // wall-clock start of the current stretch
  const pausedAtMs = useRef<number | null>(null);
  const leftAtMs = useRef<number | null>(null); // when you left the app, if you are away
  const nextPitIndex = useRef(0); // the next stop to make
  const pitRef = useRef<{ index: number; lap: number; startedAtMs: number; breakEndsAtMs: number } | null>(null);

  const changeStatus = useCallback((next: TimerStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  /** Where the clock must stop next: the next pit stop, or the end of the race. */
  const stopAtSeconds = useCallback(() => {
    const pitLap = pitAfterLaps?.[nextPitIndex.current];
    return pitLap === undefined ? plannedSeconds : Math.min(plannedSeconds, pitLap * track.lapTimeSeconds);
  }, [pitAfterLaps, plannedSeconds, track.lapTimeSeconds]);

  const readElapsed = useCallback(() => {
    const live = resumedAtMs.current === null ? 0 : (Date.now() - resumedAtMs.current) * timeScale;
    return Math.min((bankedMs.current + live) / 1000, stopAtSeconds());
  }, [stopAtSeconds, timeScale]);

  /** Bank the progress made so far and stop the clock. */
  const freeze = useCallback(() => {
    const live = resumedAtMs.current === null ? 0 : (Date.now() - resumedAtMs.current) * timeScale;
    const banked = Math.min(bankedMs.current + live, stopAtSeconds() * 1000);
    bankedMs.current = banked;
    resumedAtMs.current = null;
    setElapsedSeconds(banked / 1000);
    return banked / 1000;
  }, [stopAtSeconds, timeScale]);

  /** Into the pits at the end of a stint: the race clock stops exactly at the end of the lap and the break starts. */
  const enterPit = useCallback(
    (now: number) => {
      const index = nextPitIndex.current;
      const lap = pitAfterLaps?.[index];
      if (lap === undefined) return;
      bankedMs.current = lap * track.lapTimeSeconds * 1000;
      resumedAtMs.current = null;
      setElapsedSeconds(lap * track.lapTimeSeconds);
      pitRef.current = { index, lap, startedAtMs: now, breakEndsAtMs: now + (breakSeconds * 1000) / timeScale };
      setPit({ index, lap, breakSeconds, secondsLeft: breakSeconds, overstaySeconds: 0 });
      changeStatus('pit');
    },
    [pitAfterLaps, track.lapTimeSeconds, breakSeconds, timeScale, changeStatus],
  );

  /** Leaves the pits: records the stop, then races on, or ends the race in a DNF if you stayed 3 minutes past the break. */
  const leavePit = useCallback(
    (now: number) => {
      const stop = pitRef.current;
      if (!stop || statusRef.current !== 'pit') return;
      const overstay = Math.max(0, now - stop.breakEndsAtMs) / 1000;
      pitRef.current = null;
      setPit(null);
      if (overstay >= PIT_EXIT.crashAfterSeconds) {
        // the race ended when the limit was reached, not when you came back
        const endMs = stop.breakEndsAtMs + PIT_EXIT.crashAfterSeconds * 1000;
        setPitStops((stops) => [...stops, { lap: stop.lap, seconds: (endMs - stop.startedAtMs) / 1000 }]);
        setEndedAt(new Date(endMs));
        setCrashed(true);
        setWarning({ kind: 'crash', awaySeconds: overstay, inPit: true });
        changeStatus('ended');
        return;
      }
      setPitStops((stops) => [...stops, { lap: stop.lap, seconds: (now - stop.startedAtMs) / 1000 }]);
      if (overstay >= PIT_EXIT.slowStopAfterSeconds) {
        setSlowStops((n) => n + 1);
        setWarning({ kind: 'slow-stop', awaySeconds: overstay });
      }
      nextPitIndex.current = stop.index + 1;
      resumedAtMs.current = now;
      changeStatus('running');
    },
    [changeStatus],
  );

  const rejoin = useCallback(() => leavePit(Date.now()), [leavePit]);

  /** Back to the start line with nothing recorded. */
  const clear = useCallback(() => {
    bankedMs.current = 0;
    pausedAtMs.current = null;
    leftAtMs.current = null;
    nextPitIndex.current = 0;
    pitRef.current = null;
    setElapsedSeconds(0);
    setEndedAt(null);
    setWarning(null);
    setPauseLeft(null);
    setAway(NO_AWAY);
    setCrashed(false);
    setPit(null);
    setPitStops([]);
    setSlowStops(0);
  }, []);

  const start = useCallback(() => {
    clear();
    resumedAtMs.current = Date.now();
    setStartedAt(new Date());
    changeStatus('running');
  }, [clear, changeStatus]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'running') return;
    freeze();
    pausedAtMs.current = Date.now();
    setPauseLeft(RULES.pauseLimitSeconds);
    changeStatus('paused');
  }, [freeze, changeStatus]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    resumedAtMs.current = Date.now();
    pausedAtMs.current = null;
    setPauseLeft(null);
    changeStatus('running');
  }, [changeStatus]);

  const end = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    freeze();
    setEndedAt(new Date());
    setPauseLeft(null);
    changeStatus('ended');
  }, [freeze, changeStatus]);

  const reset = useCallback(() => {
    clear();
    resumedAtMs.current = null;
    setStartedAt(null);
    changeStatus('idle');
  }, [clear, changeStatus]);

  const dismissWarning = useCallback(() => setWarning(null), []);

  // Leaving the app freezes the race; coming back applies the rules. (In the pits, leaving is fine: see below.)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        if (statusRef.current === 'running' && leftAtMs.current === null) {
          freeze();
          leftAtMs.current = Date.now();
        }
        return;
      }

      const now = Date.now();
      // An excused break: nothing happens while it lasts. When it has run out, the time since then counts as away.
      if (statusRef.current === 'paused' && pausedAtMs.current !== null) {
        const pausedFor = now - pausedAtMs.current;
        if (pauseSecondsLeft(pausedFor) > 0) return;
        leftAtMs.current = pausedAtMs.current + RULES.pauseLimitSeconds * 1000;
        pausedAtMs.current = null;
        setPauseLeft(null);
        changeStatus('running');
      }
      if (statusRef.current !== 'running' || leftAtMs.current === null) return;

      const leftAt = leftAtMs.current;
      leftAtMs.current = null;
      const awaySeconds = (now - leftAt) / 1000;
      const kind = classifyAway(awaySeconds);
      setAway((totals) => addAway(totals, awaySeconds));

      if (kind === 'crash') {
        // the race ended when the limit was reached, not when you came back
        setEndedAt(new Date(leftAt + RULES.crashAfterSeconds * 1000));
        setCrashed(true);
        setWarning({ kind, awaySeconds });
        changeStatus('ended');
        return;
      }
      if (kind !== 'none') setWarning({ kind, awaySeconds });
      resumedAtMs.current = now;
    });
    return () => subscription.remove();
  }, [freeze, changeStatus]);

  // An excused break lasts at most 5 minutes; then the race starts again by itself.
  useEffect(() => {
    if (status !== 'paused') return;
    const timer = setInterval(() => {
      if (pausedAtMs.current === null) return;
      const left = pauseSecondsLeft(Date.now() - pausedAtMs.current);
      setPauseLeft(left);
      if (left <= 0) resume();
    }, 250);
    return () => clearInterval(timer);
  }, [status, resume]);

  // In the pits: count the break down, then how long you have stayed past it. Leaving the app is fine here, and coming
  // back catches up at once (including the DNF if you were gone more than 3 minutes past the break).
  useEffect(() => {
    if (status !== 'pit') return;
    const tick = () => {
      const stop = pitRef.current;
      if (!stop) return;
      const now = Date.now();
      const overstaySeconds = Math.max(0, now - stop.breakEndsAtMs) / 1000;
      if (overstaySeconds >= PIT_EXIT.crashAfterSeconds) {
        leavePit(now);
        return;
      }
      const secondsLeft = Math.max(0, ((stop.breakEndsAtMs - now) * timeScale) / 1000);
      setPit({ index: stop.index, lap: stop.lap, breakSeconds, secondsLeft, overstaySeconds });
    };
    const timer = setInterval(tick, 250);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [status, leavePit, breakSeconds, timeScale]);

  useEffect(() => {
    if (status !== 'running') return;
    // One update per screen frame so the car moves smoothly.
    let frame = requestAnimationFrame(function tick() {
      const elapsed = readElapsed();
      setElapsedSeconds(elapsed);
      if (elapsed < plannedSeconds && elapsed >= stopAtSeconds()) {
        enterPit(Date.now());
        return;
      }
      if (elapsed >= plannedSeconds) {
        bankedMs.current = plannedSeconds * 1000;
        resumedAtMs.current = null;
        setEndedAt(new Date());
        changeStatus('finished');
        return;
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [status, readElapsed, plannedSeconds, stopAtSeconds, enterPit, changeStatus]);

  return {
    status,
    progress: lapProgress(track, plannedLaps, elapsedSeconds),
    startedAt,
    endedAt,
    start,
    pause,
    resume,
    end,
    reset,
    warning,
    dismissWarning,
    pauseSecondsLeft: pauseLeft,
    away,
    crashed,
    pit,
    rejoin,
    pitStops,
    slowStops,
  };
}
