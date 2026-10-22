import { LIVERIES } from '../data/liveries';
import { ownsLivery } from '../logic/garage';
import { offersForWeek } from '../logic/shop';
import type { WeeklyOffers } from '../logic/shop';
import type { PlayerProfile } from '../models/types';
import { readJson, writeJson } from './storage';

export const SHOP_KEY = 'shop.v1';

const KNOWN_IDS = LIVERIES.map((l) => l.id);

/** This week's Store offers, picking (and saving) a new set if the saved one is from an earlier week. */
export async function getWeeklyOffers(profile: PlayerProfile, now: Date = new Date()): Promise<WeeklyOffers> {
  const saved = await readJson<unknown>(SHOP_KEY, null, (v): v is unknown => true);
  const forSale = LIVERIES.filter((l) => !ownsLivery(profile, l)).map((l) => l.id);
  const { offers, fresh } = offersForWeek(saved, now, KNOWN_IDS, forSale);
  if (fresh) await writeJson(SHOP_KEY, offers);
  return offers;
}
