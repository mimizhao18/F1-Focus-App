import { useEffect, useState } from 'react';

/** How often the number moves on (about 30 times a second). */
const TICK_MS = 33;

/**
 * A number that counts from `from` to `to` after `delay` ms, fast at first and settling at the end, like the reward
 * tickers on a game's results screen. Runs on timers rather than animation frames, so it also finishes when the
 * screen is not drawing. With `instant` (reduce motion) it jumps straight to `to`.
 */
export function useCountUp(from: number, to: number, { delay = 0, duration = 900, instant = false }: { delay?: number; duration?: number; instant?: boolean } = {}): number {
  const [value, setValue] = useState(from);

  useEffect(() => {
    const startsAt = Date.now() + (instant ? 0 : delay);
    const timer = setInterval(() => {
      const progress = instant ? 1 : Math.max(0, Math.min(1, (Date.now() - startsAt) / duration));
      const eased = 1 - (1 - progress) ** 3;
      setValue(from + (to - from) * eased);
      if (progress >= 1) clearInterval(timer);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [from, to, delay, duration, instant]);

  return value;
}
