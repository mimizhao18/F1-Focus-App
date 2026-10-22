// The Store's weekly offers: a handful of liveries picked at random, kept for the week and replaced every Monday.
// Pure functions, so they can be tested (npm run check).

import { dayKey } from './streak';

/** How many liveries are on offer at once. */
export const OFFER_COUNT = 6;

export interface WeeklyOffers {
  /** The Monday (local, YYYY-MM-DD) of the week these offers belong to. */
  week: string;
  /** Livery ids, in the order they are shown. */
  liveryIds: string[];
}

/** The Monday that starts the week `date` is in (local time), as YYYY-MM-DD. */
export function weekKey(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay() is 0 on Sunday, so Sunday belongs to the week that began six days earlier
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dayKey(monday);
}

/** When the next set of offers arrives: midnight at the start of next Monday (local time). */
export function nextRefresh(date: Date): Date {
  const [y, m, d] = weekKey(date).split('-').map(Number);
  return new Date(y, m - 1, d + 7);
}

/** "3 d 14 h", "5 h 20 min", "12 min": the time left until `until`, for the refresh countdown. */
export function formatTimeLeft(from: Date, until: Date): string {
  const minutes = Math.max(0, Math.ceil((until.getTime() - from.getTime()) / 60000));
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes % 60} min`;
  return `${Math.max(1, minutes)} min`;
}

/** `count` different ids picked at random from `candidates` (all of them, shuffled, if there are fewer). */
export function pickOffers(candidates: readonly string[], count: number, random: () => number = Math.random): string[] {
  const pool = [...candidates];
  // a partial Fisher-Yates shuffle: each pick is equally likely to be any id not picked yet
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/**
 * This week's offers: liveries you do not own yet, picked at random. Saved offers from this week are kept, except that a
 * livery you have bought since is swapped, in its place, for another random one you do not own. Only when fewer than
 * OFFER_COUNT liveries are left to buy do owned ones fill the remaining places. Offers saved in an earlier week are
 * replaced by a new set. Returns the offers and whether they changed (so they can be saved).
 */
export function offersForWeek(saved: unknown, now: Date, knownIds: readonly string[], forSale: readonly string[], random: () => number = Math.random): { offers: WeeklyOffers; fresh: boolean } {
  const week = weekKey(now);
  const s = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {};
  // a livery removed from the game since is dropped rather than shown broken
  const savedIds =
    s.week === week && Array.isArray(s.liveryIds) ? [...new Set(s.liveryIds.filter((id): id is string => typeof id === 'string' && knownIds.includes(id)))] : [];

  const unowned = new Set(forSale);
  const used = new Set(savedIds);
  const pickFrom = (pool: readonly string[]) => {
    const [id] = pickOffers(pool.filter((p) => !used.has(p)), 1, random);
    if (id !== undefined) used.add(id);
    return id;
  };
  // an offer you now own makes way for one you do not (if any are left)
  const liveryIds = savedIds.map((id) => (unowned.has(id) ? id : (pickFrom(forSale) ?? id)));
  // fill the empty places: liveries you do not own first, then (only if those run out) ones you do
  const owned = knownIds.filter((id) => !unowned.has(id));
  while (liveryIds.length < OFFER_COUNT) {
    const id = pickFrom(forSale) ?? pickFrom(owned);
    if (id === undefined) break;
    liveryIds.push(id);
  }

  const fresh = s.week !== week || !Array.isArray(s.liveryIds) || liveryIds.length !== s.liveryIds.length || liveryIds.some((id, i) => id !== (s.liveryIds as unknown[])[i]);
  return { offers: { week, liveryIds }, fresh };
}
