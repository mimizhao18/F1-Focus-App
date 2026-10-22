import { PROFILE_KEY } from './profile';
import { SESSIONS_KEY } from './sessions';
import { SHOP_KEY } from './shop';
import { resetSettings } from './settings';
import { removeKey } from './storage';

/** Deletes every saved race, resets the profile (XP, credits, streak, car) and this week's Store offers, and puts the settings back to their defaults. */
export async function resetAllData(): Promise<void> {
  await Promise.all([removeKey(PROFILE_KEY), removeKey(SESSIONS_KEY), removeKey(SHOP_KEY), resetSettings()]);
}
