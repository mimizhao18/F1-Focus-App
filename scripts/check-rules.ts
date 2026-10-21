// Run with: npm run check
// @ts-nocheck (plain Node script; the app's tsconfig does not know about Node or .ts import suffixes)
import assert from 'node:assert/strict';
import {
  buildSession,
  completedLaps,
  distanceKm,
  lapsToSeconds,
  levelForXp,
  levelProgress,
  xpForLevel,
  xpForSeconds,
} from '../src/logic/rewards.ts';
import { formatClock, lapProgress } from '../src/logic/lapProgress.ts';
import { positionOnTrack } from '../src/logic/trackPosition.ts';
import { formatDurationWords } from '../src/logic/sessionOptions.ts';
import { clampLaps, lapsFromMinutes, maxMinutes, minutesForLaps } from '../src/logic/raceLength.ts';
import { lifetimeStats } from '../src/logic/stats.ts';
import { buyLivery, equipLivery, ownsLivery, setCarNumber } from '../src/logic/garage.ts';
import { normalizeProfile } from '../src/logic/profileMigration.ts';
import { DEFAULT_LIVERY_ID, FREE_LIVERY_IDS, LIVERIES, MAX_CAR_NUMBER, MIN_CAR_NUMBER, RENAMED_LIVERY_IDS, getLivery } from '../src/data/liveries.ts';
import { ERAS } from '../src/data/eras.ts';
import { specFor, GEN2022, GEN2026 } from '../src/data/cars/index.ts';
import { specFacts } from '../src/data/cars/spec.ts';
import { recentDays } from '../src/logic/history.ts';
import { buildDemoData } from '../src/logic/demo.ts';
import { colors, fonts, glass, theme } from '../src/design/tokens.ts';
import { contrastRatio } from '../src/design/contrast.ts';
import { NO_AWAY, RULES, addAway, classifyAway, pauseSecondsLeft, penaltyPercent, rewardMultiplier } from '../src/logic/distraction.ts';
import { glowHexFor, hexToRgb255 } from '../src/components/car3d/glow.ts';
import { TRACK_LIST, isTrackUnlocked } from '../src/data/tracks/index.ts';
import { applySessionToStreak, daysBetween, displayedStreak } from '../src/logic/streak.ts';
import { DEFAULT_SETTINGS, KM_PER_MILE, cleanDriverCode, driverCodeFor, formatDistance, normalizeSettings } from '../src/logic/settings.ts';

const track = { id: 'silverstone', lapLengthKm: 5.891, lapTimeSeconds: 90 };

// laps <-> time
assert.equal(lapsToSeconds(track, 10), 900);
assert.equal(lapsToSeconds(track, 52), 4680);
assert.equal(completedLaps(track, 0, 10), 0);
assert.equal(completedLaps(track, 89, 10), 0);
assert.equal(completedLaps(track, 90, 10), 1);
assert.equal(completedLaps(track, 500, 10), 5);
assert.equal(completedLaps(track, 99999, 10), 10); // capped at planned
assert.equal(distanceKm(track, 10), 58.91);

// rewards: 1 XP / credit per full minute
assert.equal(xpForSeconds(59), 0);
assert.equal(xpForSeconds(60), 1);
assert.equal(xpForSeconds(900), 15);

// levels
assert.equal(levelForXp(0), 1);
assert.equal(levelForXp(49), 1);
assert.equal(levelForXp(50), 2);
assert.equal(levelForXp(199), 2);
assert.equal(levelForXp(200), 3);
assert.equal(xpForLevel(3), 200);

// finished session
const start = new Date('2026-09-30T10:00:00');
const done = buildSession({ id: 'a', track, plannedLaps: 10, focusedSeconds: 900, startedAt: start, endedAt: new Date('2026-09-30T10:15:00') });
assert.equal(done.finished, true);
assert.equal(done.completedLaps, 10);
assert.equal(done.xpEarned, 15);
assert.equal(done.creditsEarned, 15);
assert.equal(done.distanceKm, 58.91);

// ended early, mid-lap: pays for time focused, counts whole laps only
const early = buildSession({ id: 'b', track, plannedLaps: 10, focusedSeconds: 400, startedAt: start, endedAt: start });
assert.equal(early.finished, false);
assert.equal(early.completedLaps, 4);
assert.equal(early.xpEarned, 6);

// time beyond the plan is not credited
const over = buildSession({ id: 'c', track, plannedLaps: 2, focusedSeconds: 5000, startedAt: start, endedAt: start });
assert.equal(over.focusedSeconds, 180);
assert.equal(over.finished, true);

// streaks
assert.equal(daysBetween('2026-02-28', '2026-03-01'), 1);
assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
let s = { currentStreak: 0, longestStreak: 0, lastSessionDay: null };
s = applySessionToStreak(s, '2026-09-28');
assert.deepEqual(s, { currentStreak: 1, longestStreak: 1, lastSessionDay: '2026-09-28' });
s = applySessionToStreak(s, '2026-09-28'); // same day
assert.equal(s.currentStreak, 1);
s = applySessionToStreak(s, '2026-09-29'); // next day
assert.equal(s.currentStreak, 2);
s = applySessionToStreak(s, '2026-09-30');
assert.equal(s.currentStreak, 3);
assert.equal(displayedStreak(s, '2026-10-01'), 3); // can still extend tomorrow
assert.equal(displayedStreak(s, '2026-10-02'), 0); // missed a day
s = applySessionToStreak(s, '2026-10-05'); // gap restarts, longest kept
assert.equal(s.currentStreak, 1);
assert.equal(s.longestStreak, 3);

// lap progress
let p = lapProgress(track, 10, 0);
assert.deepEqual([p.completedLaps, p.currentLap, p.lapFraction, p.totalFraction, p.finished], [0, 1, 0, 0, false]);
p = lapProgress(track, 10, 45);
assert.deepEqual([p.completedLaps, p.currentLap, p.lapFraction, p.remainingSeconds], [0, 1, 0.5, 855]);
p = lapProgress(track, 10, 90);
assert.deepEqual([p.completedLaps, p.currentLap, p.lapFraction], [1, 2, 0]);
p = lapProgress(track, 10, 135);
assert.deepEqual([p.completedLaps, p.currentLap, p.lapFraction], [1, 2, 0.5]);
p = lapProgress(track, 10, 899);
assert.deepEqual([p.completedLaps, p.currentLap, p.finished], [9, 10, false]);
p = lapProgress(track, 10, 900);
assert.deepEqual([p.completedLaps, p.currentLap, p.lapFraction, p.totalFraction, p.finished], [10, 10, 1, 1, true]);
p = lapProgress(track, 10, 5000); // past the end and negative are clamped
assert.equal(p.elapsedSeconds, 900);
assert.equal(lapProgress(track, 10, -5).elapsedSeconds, 0);
assert.equal(formatClock(90), '1:30');
assert.equal(formatClock(59.2), '1:00'); // rounds up so the clock never shows 0:00 early
assert.equal(formatClock(0), '0:00');
assert.equal(formatClock(4680), '78:00');

// car position on the track
const square = { points: [[0, 0], [10, 0], [10, 10], [0, 10]] };
let pos = positionOnTrack(square, 0);
assert.deepEqual([pos.x, pos.y], [0, 0]);
pos = positionOnTrack(square, 0.25); // passes exactly through the traced points
assert.deepEqual([pos.x, pos.y], [10, 0]);
pos = positionOnTrack(square, 1); // a full lap is back at the line
assert.deepEqual([pos.x, pos.y], [0, 0]);
const wrapped = positionOnTrack(square, 1.25);
assert.ok(Math.abs(wrapped.x - 10) < 1e-9 && Math.abs(wrapped.y) < 1e-9);
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const circle = { points: Array.from({ length: 36 }, (_, k) => [100 * Math.cos((k * 10 * Math.PI) / 180), 100 * Math.sin((k * 10 * Math.PI) / 180)]) };
pos = positionOnTrack(circle, 0); // at (100, 0) heading toward +y, i.e. 90 degrees
assert.ok(angleDiff(pos.angleDeg, 90) < 1, `angle ${pos.angleDeg}`);
pos = positionOnTrack(circle, 0.25); // at (0, 100) heading toward -x, i.e. 180 degrees
assert.ok(angleDiff(pos.angleDeg, 180) < 1, `angle ${pos.angleDeg}`);
// between points the car stays on the circle (straight-line steps would cut inside it by ~0.4%)
pos = positionOnTrack(circle, 0.5 / 36);
assert.ok(Math.abs(Math.hypot(pos.x, pos.y) - 100) < 0.05, `radius ${Math.hypot(pos.x, pos.y)}`);
// the heading turns smoothly: no sudden jumps anywhere around the lap, even on a coarse 36-point circle
let maxJump = 0;
let prev = positionOnTrack(circle, 0).angleDeg;
for (let k = 1; k <= 4000; k++) {
  const a = positionOnTrack(circle, k / 4000).angleDeg;
  maxJump = Math.max(maxJump, angleDiff(a, prev));
  prev = a;
}
assert.ok(maxJump < 0.3, `max heading jump ${maxJump}`);

// duration wording and lap options
assert.equal(formatDurationWords(900), '15 min');
assert.equal(formatDurationWords(450), '7 min 30 s');
assert.equal(formatDurationWords(4680), '1 h 18 min');
assert.equal(formatDurationWords(3600), '1 h');
assert.equal(formatDurationWords(45), '45 s');

// race length slider: minutes snap to whole laps, and the slider never jumps back
const raceTracks = [
  { lapTimeSeconds: 90, raceLaps: 52 }, // Silverstone
  { lapTimeSeconds: 70, raceLaps: 78 }, // Monaco
  { lapTimeSeconds: 100, raceLaps: 44 }, // Spa
];
for (const t of raceTracks) {
  assert.equal(lapsFromMinutes(t, 0), 1); // never fewer than 1 lap
  assert.equal(lapsFromMinutes(t, 100000), t.raceLaps); // never more than a full race
  assert.equal(clampLaps(t, 0), 1);
  assert.equal(clampLaps(t, t.raceLaps + 10), t.raceLaps);
  assert.equal(maxMinutes(t), Math.round((t.raceLaps * t.lapTimeSeconds) / 60));
  for (let m = 1; m <= maxMinutes(t); m++) {
    const laps = lapsFromMinutes(t, m);
    assert.ok(Number.isInteger(laps) && laps >= 1 && laps <= t.raceLaps, `${m} min -> ${laps} laps`);
    // the race is within half a lap of the minutes asked for, unless clamped at the ends
    if (laps > 1 && laps < t.raceLaps) assert.ok(Math.abs(laps * t.lapTimeSeconds - m * 60) <= t.lapTimeSeconds / 2 + 1e-9, `${m} min`);
  }
  for (let laps = 1; laps <= t.raceLaps; laps++) {
    // placing the minutes slider for a lap count and reading it back gives the same laps (no jumping)
    assert.equal(lapsFromMinutes(t, minutesForLaps(t, laps)), laps, `laps ${laps} at ${t.lapTimeSeconds}s`);
  }
}
assert.equal(lapsFromMinutes(raceTracks[0], 15), 10); // 15 min at 90 s per lap = 10 laps
assert.equal(minutesForLaps(raceTracks[0], 10), 15);

// level progress
assert.deepEqual(levelProgress(0), { level: 1, xpIntoLevel: 0, xpForNextLevel: 50, fraction: 0 });
assert.deepEqual(levelProgress(25), { level: 1, xpIntoLevel: 25, xpForNextLevel: 50, fraction: 0.5 });
assert.deepEqual(levelProgress(50), { level: 2, xpIntoLevel: 0, xpForNextLevel: 150, fraction: 0 });
assert.deepEqual(levelProgress(125), { level: 2, xpIntoLevel: 75, xpForNextLevel: 150, fraction: 0.5 });

// lifetime stats
assert.deepEqual(lifetimeStats([]), { races: 0, laps: 0, distanceKm: 0, focusedSeconds: 0 });
assert.deepEqual(lifetimeStats([done, early]), { races: 2, laps: 14, distanceKm: 82.5, focusedSeconds: 1300 });

// garage (liveries)
const ferrari = { id: 'ferrari-2022', name: 'Ferrari', price: 0 };
const mercedes = { id: 'mercedes-2022', name: 'Mercedes', price: 50 };
const gp = { totalXp: 0, credits: 80, currentStreak: 0, longestStreak: 0, lastSessionDay: null, unlockedLiveries: ['ferrari-2022'], car: { liveryId: 'ferrari-2022', number: 1 } };
assert.equal(ownsLivery(gp, ferrari), true);
assert.equal(ownsLivery(gp, mercedes), false);
let g = buyLivery(gp, mercedes);
assert.equal(g.ok, true);
assert.equal(g.profile.credits, 30);
assert.deepEqual(g.profile.unlockedLiveries, ['ferrari-2022', 'mercedes-2022']);
assert.equal(gp.credits, 80); // original profile untouched
assert.deepEqual(buyLivery(g.profile, mercedes), { ok: false, reason: 'already-owned' });
assert.deepEqual(buyLivery({ ...gp, credits: 49 }, mercedes), { ok: false, reason: 'not-enough-credits' });
assert.deepEqual(equipLivery(gp, mercedes), { ok: false, reason: 'not-owned' });
g = equipLivery(buyLivery(gp, mercedes).profile, mercedes);
assert.equal(g.profile.car.liveryId, 'mercedes-2022');
assert.equal(g.profile.car.number, 1); // number is kept when the livery changes
assert.equal(setCarNumber(gp, 44, 1, 99).profile.car.number, 44);
assert.equal(setCarNumber(gp, 44, 1, 99).profile.car.liveryId, 'ferrari-2022');
assert.equal(setCarNumber(gp, 0, 1, 99).ok, false);
assert.equal(setCarNumber(gp, 100, 1, 99).ok, false);
assert.equal(setCarNumber(gp, 4.5, 1, 99).ok, false);

// the livery catalog
assert.equal(LIVERIES.length, 42);
assert.equal(new Set(LIVERIES.map((l) => l.id)).size, LIVERIES.length); // ids are unique
assert.ok(LIVERIES.every((l) => /^#[0-9A-Fa-f]{6}$/.test(l.primary) && /^#[0-9A-Fa-f]{6}$/.test(l.secondary))); // the car shades #RRGGBB colors
assert.ok(LIVERIES.every((l) => ERAS.some((e) => e.id === l.era && e.available))); // every livery belongs to a built generation
assert.ok(LIVERIES.every((l) => [...l.top, ...(l.decals ?? []).filter((d) => d.view === 'top')].length > 0 && [...l.side, ...(l.decals ?? []).filter((d) => d.view === 'side')].length > 0)) // every livery paints something on top and on the side (shapes or logos); // and has paint shapes to draw
assert.ok(LIVERIES.every((l) => [...l.top, ...l.side].every((layer) => (layer.color === undefined || /^#[0-9A-Fa-f]{6}$/.test(layer.color)) && (layer.path !== undefined || layer.points.length >= 3)))); // shapes are polygons or paths (paths are parsed in check-paint.ts)
assert.ok(LIVERIES.every((l) => l.sidepod in specFor(l.era).pods)); // each team's sidepod design exists on its generation's car
assert.ok(LIVERIES.every((l) => Object.values(l.parts).every((c) => /^#[0-9A-Fa-f]{6}$/.test(c))));
assert.ok(LIVERIES.every((l) => l.price >= 0 && Number.isInteger(l.price)));
assert.ok(LIVERIES.every((l) => l.primary.toLowerCase() !== l.secondary.toLowerCase())); // the accent must show
assert.deepEqual(FREE_LIVERY_IDS, [DEFAULT_LIVERY_ID]); // everyone starts with exactly the default
assert.equal(getLivery('ferrari-2022').id, 'ferrari-2022');
assert.equal(getLivery('no-such-livery').id, DEFAULT_LIVERY_ID); // unknown ids still draw something

// every livery is still there: players' saves refer to these ids, so none may disappear or be renamed, and the
// count per generation only changes on purpose (add the new id here when adding a livery)
const LIVERY_IDS_BY_ERA = {
  gen1980s: ['ferrari-1980s', 'mclaren-1980s', 'lotus-1980s', 'williams-1980s', 'benetton-1980s', 'lotuscamel-1980s', 'brabham-1980s'],
  gen2004: ['ferrari-2004', 'mclaren-2004', 'williams-2004', 'renault-2004', 'bar-2004', 'jaguar-2004', 'toyota-2004'],
  gen2014: ['ferrari-2014', 'mercedes-2014', 'mclaren-2014', 'redbull-2014', 'forceindia-2014', 'renault-2014', 'williams-2014'],
  gen2022: ['ferrari-2022', 'mercedes-2022', 'mclaren-2022', 'redbull-2022', 'alpine-2022', 'astonmartin-2022', 'alphatauri-2022', 'alfaromeo-2022', 'haas-2022', 'williams-2022'],
  gen2026: ['ferrari-2026', 'mercedes-2026', 'mclaren-2026', 'redbull-2026', 'racingbulls-2026', 'alpine-2026', 'astonmartin-2026', 'williams-2026', 'haas-2026', 'audi-2026', 'cadillac-2026'],
};
for (const [era, ids] of Object.entries(LIVERY_IDS_BY_ERA)) {
  const have = LIVERIES.filter((l) => l.era === era).map((l) => l.id);
  assert.equal(have.length, ids.length, `${era} has ${ids.length} liveries`);
  assert.deepEqual([...have].sort(), [...ids].sort(), `${era} livery ids`);
}
assert.equal(Object.values(LIVERY_IDS_BY_ERA).flat().length, 42);
for (const l of LIVERIES) {
  assert.ok(!l.parts.halo || /^#[0-9A-Fa-f]{6}$/.test(l.parts.halo), `${l.id} halo color`);
  for (const t of l.texts ?? []) assert.ok(t.height > 0 && t.text.length > 0, `${l.id} text`);
}

// profile migration: old saves keep progress and get a livery
const catalog = { knownIds: LIVERIES.map((l) => l.id), freeIds: FREE_LIVERY_IDS, defaultId: DEFAULT_LIVERY_ID, renamed: RENAMED_LIVERY_IDS };
const oldSave = { totalXp: 120, credits: 40, currentStreak: 3, longestStreak: 5, lastSessionDay: '2026-10-01', unlockedColors: ['red', 'white', 'blue'], car: { primaryColor: '#1E41FF', secondaryColor: '#FFFFFF', number: 44 } };
let m = normalizeProfile(oldSave, catalog, MIN_CAR_NUMBER, MAX_CAR_NUMBER);
assert.equal(m.totalXp, 120);
assert.equal(m.credits, 40);
assert.equal(m.currentStreak, 3);
assert.equal(m.longestStreak, 5);
assert.equal(m.lastSessionDay, '2026-10-01');
assert.deepEqual(m.unlockedLiveries, FREE_LIVERY_IDS);
assert.deepEqual(m.car, { liveryId: DEFAULT_LIVERY_ID, number: 44 }); // number kept, colors replaced by the default livery
assert.equal('unlockedColors' in m, false);
m = normalizeProfile({ ...oldSave, unlockedLiveries: ['mercedes-2022', 'retired-livery'], car: { liveryId: 'mercedes-2022', number: 7 } }, catalog, 1, 99);
assert.deepEqual(m.unlockedLiveries, ['ferrari-2022', 'mercedes-2022']); // unknown ids dropped, free ones always present
assert.deepEqual(m.car, { liveryId: 'mercedes-2022', number: 7 });
m = normalizeProfile({ ...oldSave, unlockedLiveries: [], car: { liveryId: 'mclaren-2022', number: 7 } }, catalog, 1, 99);
assert.equal(m.car.liveryId, 'ferrari-2022'); // never wear a livery that is not owned
m = normalizeProfile({ ...oldSave, unlockedLiveries: ['cobalt', 'obsidian'], car: { liveryId: 'cobalt', number: 7 } }, catalog, 1, 99);
assert.deepEqual(m.unlockedLiveries, ['ferrari-2022', 'redbull-2022', 'mercedes-2022']); // retired ids become the closest current livery
assert.equal(m.car.liveryId, 'redbull-2022');
m = normalizeProfile({ ...oldSave, car: { liveryId: 'retired-livery', number: 500 } }, catalog, 1, 99);
assert.deepEqual(m.car, { liveryId: 'ferrari-2022', number: 1 }); // unknown livery and an out-of-range number fall back
assert.equal(normalizeProfile(null, catalog, 1, 99), null);
assert.equal(normalizeProfile('garbage', catalog, 1, 99), null);
assert.equal(normalizeProfile({ totalXp: 'lots' }, catalog, 1, 99), null);
assert.equal(normalizeProfile({ ...oldSave, car: undefined }, catalog, 1, 99).car.number, 1);

// recent days (history strip)
const mk = (endedAt, focusedSeconds) => ({ ...done, endedAt: new Date(endedAt).toISOString(), focusedSeconds });
const week = recentDays([mk('2026-09-30T10:15:00', 900), mk('2026-09-30T18:00:00', 600), mk('2026-09-28T09:00:00', 300), mk('2026-09-01T09:00:00', 999)], new Date('2026-09-30T12:00:00'), 7);
assert.equal(week.length, 7);
assert.equal(week[0].day, '2026-09-24');
assert.equal(week[6].day, '2026-09-30');
assert.equal(week[6].weekday, 3); // Wednesday
assert.deepEqual([week[6].races, week[6].focusedSeconds], [2, 1500]);
assert.deepEqual([week[4].races, week[4].focusedSeconds], [1, 300]); // Sep 28
assert.equal(week[5].races, 0);
assert.equal(week.reduce((n, d) => n + d.races, 0), 3); // the Sep 1 race is outside the window

// demo data
const demoTracks = {
  silverstone: { id: 'silverstone', lapLengthKm: 5.891, lapTimeSeconds: 90 },
  monaco: { id: 'monaco', lapLengthKm: 3.337, lapTimeSeconds: 70 },
  spa: { id: 'spa', lapLengthKm: 7.004, lapTimeSeconds: 100 },
};
const demoNow = new Date('2026-10-05T12:00:00');
const demo = buildDemoData(demoNow, demoTracks);
assert.equal(demo.sessions.length, 7);
assert.equal(demo.profile.totalXp, 191); // 9 short of level 3 (200 XP), so one 15 min race levels up
assert.equal(levelProgress(demo.profile.totalXp).level, 2);
assert.equal(levelProgress(demo.profile.totalXp + 15).level, 3);
assert.equal(demo.profile.credits, 141); // 191 earned minus the 50 spent on the Mercedes livery
assert.deepEqual(demo.profile.unlockedLiveries, ['ferrari-2022', 'mercedes-2022']);
assert.equal(demo.profile.car.liveryId, 'mercedes-2022'); // wears one it owns
assert.ok(demo.profile.credits >= 100); // can afford the 100-credit McLaren live in the garage
assert.equal(demo.profile.lastSessionDay, '2026-10-04'); // yesterday, so the 5-day streak is still alive and a race today extends it
assert.equal(displayedStreak(demo.profile, '2026-10-05'), 5);
assert.deepEqual(demo.sessions.map((s) => s.finished), [true, true, true, false, true, true, true]);
assert.equal(new Set(demo.sessions.map((s) => s.id)).size, 7);
assert.ok(demo.sessions.every((s) => s.endedAt < demoNow.toISOString())); // all in the past
assert.ok(demo.sessions.every((s) => s.focusedSeconds <= s.plannedLaps * demoTracks[s.trackId].lapTimeSeconds));
assert.equal(applySessionToStreak(demo.profile, '2026-10-05').currentStreak, 6);
assert.equal(lifetimeStats(demo.sessions).races, 7);

// design values
const sp = theme.spacing;
assert.ok(sp.xxs < sp.xs && sp.xs < sp.sm && sp.sm < sp.md && sp.md < sp.lg && sp.lg < sp.xl && sp.xl < sp.xxl, 'spacing scale is ordered');
assert.ok(Object.values(sp).every((v) => Number.isInteger(v) && v > 0), 'spacing is whole numbers');
assert.ok(Object.values(colors).every((c) => /^#[0-9A-Fa-f]{6}$/.test(c)), 'colors are #RRGGBB (the car and the credits coin shade them)');
assert.equal(colors.accent, '#E10600'); // fixed F1 red
assert.notEqual(colors.coin.toLowerCase(), colors.accent.toLowerCase());
assert.ok(theme.typography.label.textTransform === 'uppercase');

// the 2026 calendar (without Jeddah for now): three free tracks, the other 20 open at a player level in race order
assert.equal(TRACK_LIST.length, 23);
assert.equal(new Set(TRACK_LIST.map((t) => t.id)).size, 23, 'track ids are unique');
assert.deepEqual(TRACK_LIST.slice(0, 3).map((t) => [t.id, t.unlockLevel]), [['silverstone', 1], ['spa', 1], ['monaco', 1]]);
for (let i = 3; i < TRACK_LIST.length; i++) {
  assert.ok(TRACK_LIST[i].unlockLevel >= 2, `${TRACK_LIST[i].id} needs a level`);
  if (i > 3) assert.ok(TRACK_LIST[i].unlockLevel >= TRACK_LIST[i - 1].unlockLevel, 'tracks open one after another');
}
for (const t of TRACK_LIST) {
  assert.equal(t.points.length, 360, `${t.id} has 360 points`);
  assert.ok(t.points.every(([x, y]) => x >= 0 && x <= t.viewBox.width && y >= 0 && y <= t.viewBox.height), `${t.id} stays inside its box`);
  const mid = { x: (t.startFinish.from.x + t.startFinish.to.x) / 2, y: (t.startFinish.from.y + t.startFinish.to.y) / 2 };
  assert.ok(Math.hypot(mid.x - t.points[0][0], mid.y - t.points[0][1]) < 3, `${t.id} starts on the start/finish line`);
  assert.equal(t.lapTimeSeconds % 10, 0, `${t.id} lap time is a multiple of 10 s`);
  assert.ok(Math.abs(t.raceLaps * t.lapLengthKm - t.raceDistanceKm) < 1, `${t.id} race distance matches laps times lap length`);
  assert.ok(t.raceDistanceKm >= 260 && t.raceDistanceKm <= 315, `${t.id} race distance is a real Grand Prix distance`);
}
assert.equal(isTrackUnlocked(TRACK_LIST[3], 1), false);
assert.equal(isTrackUnlocked(TRACK_LIST[3], 2), true);
assert.equal(isTrackUnlocked(TRACK_LIST[0], 1), true);
assert.equal(TRACK_LIST[TRACK_LIST.length - 1].unlockLevel, 12);
assert.ok(levelForXp(6050) === 12 && levelForXp(6049) === 11, 'level 12 is 6050 XP');

// leaving the app mid-race: 5 s track limits warning, 30 s yellow flag, 3 min crash; a pause excuses 5 minutes
assert.equal(classifyAway(0), 'none');
assert.equal(classifyAway(4.9), 'none');
assert.equal(classifyAway(5), 'track-limits');
assert.equal(classifyAway(29.9), 'track-limits');
assert.equal(classifyAway(30), 'yellow');
assert.equal(classifyAway(179), 'yellow');
assert.equal(classifyAway(180), 'crash');
assert.equal(pauseSecondsLeft(0), 300);
assert.equal(pauseSecondsLeft(299000), 1);
assert.equal(pauseSecondsLeft(301000), 0);
let totals = addAway(NO_AWAY, 3);
totals = addAway(totals, 12);
totals = addAway(totals, 45);
assert.deepEqual(totals, { seconds: 60, trackLimits: 1, yellowFlags: 1 });
assert.ok(RULES.trackLimitsAfterSeconds < RULES.yellowFlagAfterSeconds && RULES.yellowFlagAfterSeconds < RULES.crashAfterSeconds);
// the race record keeps the distractions and the crash
const crashed = buildSession({ id: 'c', track, plannedLaps: 10, focusedSeconds: 300, startedAt: start, endedAt: new Date('2026-09-30T10:08:00'), away: totals, crashed: true });
assert.equal(crashed.finished, false);
assert.equal(crashed.crashed, true);
assert.equal(crashed.awaySeconds, 60);
assert.equal(crashed.trackLimits, 1);
assert.equal(crashed.yellowFlags, 1);
// two or more warnings (track limits warnings and yellow flags together) cut the rewards: 10% for two, 10% more for each further one, up to 50%
const warnings = (trackLimits: number, yellow: number) => ({ seconds: 99, trackLimits, yellowFlags: yellow });
assert.equal(penaltyPercent(NO_AWAY), 0);
assert.equal(penaltyPercent(warnings(1, 0)), 0);
assert.equal(penaltyPercent(warnings(0, 1)), 0);
assert.equal(penaltyPercent(warnings(2, 0)), 10);
assert.equal(penaltyPercent(warnings(1, 1)), 10);
assert.equal(penaltyPercent(warnings(3, 1)), 30);
assert.equal(penaltyPercent(warnings(9, 9)), 50);
assert.equal(rewardMultiplier(warnings(2, 0)), 0.9);
const clean = buildSession({ id: 'p0', track, plannedLaps: 10, focusedSeconds: 900, startedAt: start, endedAt: new Date('2026-09-30T10:15:00'), away: warnings(1, 0) });
assert.equal(clean.xpEarned, 15);
assert.equal(clean.rewardPenaltyPercent, undefined);
const docked = buildSession({ id: 'p1', track, plannedLaps: 10, focusedSeconds: 900, startedAt: start, endedAt: new Date('2026-09-30T10:15:00'), away: warnings(2, 0) });
assert.equal(docked.xpEarned, 13); // 15 minus 10%, rounded down
assert.equal(docked.creditsEarned, 13);
assert.equal(docked.rewardPenaltyPercent, 10);
const dockedMore = buildSession({ id: 'p2', track, plannedLaps: 10, focusedSeconds: 900, startedAt: start, endedAt: new Date('2026-09-30T10:15:00'), away: warnings(3, 2) });
assert.equal(dockedMore.xpEarned, 9); // 15 minus 40%
assert.equal(done.crashed, undefined); // a clean race has no distraction fields

// the new design system
assert.ok(theme.radius.control <= 4 && theme.radius.panel <= 6 && theme.radius.control <= theme.radius.panel, 'corners: 4 px controls, 6 px panels at most');
assert.ok(sp.screen === 16 && Object.values(sp).every((v) => v === sp.xxs || v % 4 === 0), 'spacing sits on a 4 / 8 px grid (2 only to stack text) and screens are padded 16');
assert.ok(theme.size.touch >= 44 && theme.size.control >= 48, 'touch targets are at least 44 px, buttons 48');
assert.ok(Object.values(fonts).every((f) => /(400Regular|500Medium|600SemiBold)$/.test(f)), 'only weights 400, 500 and 600');
assert.ok(Object.values(theme.typography).every((ty) => !('fontWeight' in ty)), 'weight comes from the font, never fontWeight');
for (const text of ['text', 'textSecondary', 'textMuted', 'accentOnDark', 'positive', 'flag']) {
  for (const surface of ['background', 'surface', 'raised']) {
    assert.ok(contrastRatio(colors[text], colors[surface]) >= 4.5, `${text} on ${surface} passes WCAG AA`);
  }
}
assert.ok(contrastRatio(colors.accentText, colors.accent) >= 4.5, 'white on the accent passes WCAG AA');
assert.ok(glass.ambient <= 0.3 && glass.fillTop <= 0.12 && glass.edgeTop <= 0.3, 'glass stays subtle');
assert.ok(contrastRatio(colors.accent, colors.background) >= 3, 'the accent is visible enough for icons and lines');

// 3D car glow follows the livery
for (const livery of LIVERIES) {
  const glow = glowHexFor(livery.primary, livery.secondary);
  assert.ok(glow === livery.primary || glow === livery.secondary);
  const [r, g, b] = hexToRgb255(glow);
  assert.ok(0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255) >= 0.1, `${livery.id} glow is visible`); // never a near-black glow
}
assert.equal(glowHexFor('#E10600', '#FFFFFF'), '#E10600'); // a red car glows red
assert.equal(glowHexFor('#1E41FF', '#FFD800'), '#1E41FF'); // a blue car glows blue
assert.equal(glowHexFor('#1A1A1A', '#D4AF37'), '#D4AF37'); // a near-black car glows in its accent (gold)
assert.deepEqual(hexToRgb255('#FF8000'), [255, 128, 0]);

// track data shown on the New Race cards
// the three free tracks keep their flags and lap times
assert.deepEqual(TRACK_LIST.slice(0, 3).map((t) => t.countryCode), ['GB', 'BE', 'MC']);
assert.deepEqual(TRACK_LIST.slice(0, 3).map((t) => t.lapTimeSeconds), [90, 100, 70]);
for (const t of TRACK_LIST) {
  assert.ok(t.name.length > 0 && t.country.length > 0);
  assert.match(t.countryCode, /^[A-Z]{2}$/, `${t.id} has a flag`);
}

console.log('all rule checks passed');

// the 2022 and 2026 cars differ in the ways the 2026 rules say they should
const f22 = specFacts(GEN2022, 'downwash');
const f26 = specFacts(GEN2026, 'compact');
const close = (a, b) => Math.abs(a - b) < 0.0005;
assert.ok(close(f22.wheelbase, 3.6) && close(f26.wheelbase, 3.4)); // 3600 mm vs 3400 mm
assert.ok(close(f22.width, 2.0, ) || Math.abs(f22.width - 2.005) < 0.006); // about 2000 mm
assert.ok(Math.abs(f26.width - 1.9) < 0.006); // about 1900 mm
assert.ok(close(f22.frontWingWidth - f26.frontWingWidth, 0.1)); // the 2026 front wing is 100 mm narrower
assert.ok(close(f22.frontTire - f26.frontTire, 0.025)); // front tires 25 mm narrower
assert.ok(close(f22.rearTire - f26.rearTire, 0.03)); // rear tires 30 mm narrower
assert.equal(GEN2022.wheels.front.radius, GEN2026.wheels.front.radius); // both on 18-inch wheels
assert.equal(GEN2022.wheels.rear.radius, GEN2026.wheels.rear.radius);
assert.ok(f26.podWidth < f22.podWidth); // slimmer sidepods
assert.ok(Math.max(...GEN2026.floor.hw) < Math.max(...GEN2022.floor.hw)); // narrower floor
assert.equal(GEN2026.rearWing.beam.length, 0); // no beam wing on the 2026 car
assert.ok(GEN2022.rearWing.beam.length > 0); // the 2022 car keeps its
assert.ok(GEN2026.frontWing.elements.length <= 3 && GEN2026.frontWing.elements.length < GEN2022.frontWing.elements.length); // a simpler front wing (three elements in the 2026 photos, four in 2022)
assert.ok(GEN2026.frontWing.elements.some((e) => e.active) && GEN2026.rearWing.elements.every((e) => e.active)); // active wings front and rear
assert.ok(GEN2022.frontWing.elements.every((e) => !e.active) && GEN2022.rearWing.elements.every((e) => !e.active)); // the 2022 wings are fixed

// settings (settings.v1): every bad or missing field falls back to its default on its own
const trackIds = TRACK_LIST.map((t) => t.id);
assert.deepEqual(normalizeSettings(null, trackIds), DEFAULT_SETTINGS);
assert.deepEqual(normalizeSettings('junk', trackIds), DEFAULT_SETTINGS);
assert.deepEqual(normalizeSettings({}, trackIds), DEFAULT_SETTINGS);
const kept = normalizeSettings(
  { driverName: 'Lewis Hamilton', driverCode: 'ham', rememberLastRace: false, lastRace: { trackId: 'monaco', laps: 12 }, lengthMode: 'minutes', startLights: false, distanceUnit: 'mi', haptics: false },
  trackIds,
);
assert.deepEqual(kept, { driverName: 'Lewis Hamilton', driverCode: 'HAM', rememberLastRace: false, lastRace: { trackId: 'monaco', laps: 12 }, lengthMode: 'minutes', startLights: false, distanceUnit: 'mi', haptics: false });
const mixed = normalizeSettings({ haptics: 'yes', distanceUnit: 'furlongs', lengthMode: 'hours', startLights: false, lastRace: { trackId: 'nurburgring', laps: 5 } }, trackIds);
assert.equal(mixed.haptics, true);
assert.equal(mixed.distanceUnit, 'km');
assert.equal(mixed.lengthMode, 'laps');
assert.equal(mixed.startLights, false); // the good field survives next to the bad ones
assert.equal(mixed.lastRace, null); // an unknown track is forgotten
assert.equal(normalizeSettings({ lastRace: { trackId: 'spa', laps: 2.5 } }, trackIds).lastRace, null); // laps are whole
assert.equal(normalizeSettings({ lastRace: { trackId: 'spa', laps: 0 } }, trackIds).lastRace, null);
assert.equal(normalizeSettings({ driverCode: 'HA' }, trackIds).driverCode, ''); // a half-typed code is dropped
assert.equal(normalizeSettings({ driverName: 'x'.repeat(100) }, trackIds).driverName.length, 24);

// driver codes
assert.equal(cleanDriverCode('ver1stappen'), 'VER');
assert.equal(cleanDriverCode('l-e c'), 'LEC');
assert.equal(driverCodeFor({ driverName: 'Lewis Hamilton', driverCode: '' }), 'HAM');
assert.equal(driverCodeFor({ driverName: 'Lewis Hamilton', driverCode: 'LH' }), 'HAM'); // a half-typed code falls back to the name
assert.equal(driverCodeFor({ driverName: 'Lewis Hamilton', driverCode: 'BOB' }), 'BOB'); // a typed code wins
assert.equal(driverCodeFor({ driverName: '  Charles  Leclerc ', driverCode: '' }), 'LEC');
assert.equal(driverCodeFor({ driverName: 'Zhou', driverCode: '' }), 'ZHO');
assert.equal(driverCodeFor({ driverName: 'Max Wu', driverCode: '' }), ''); // too short for a code
assert.equal(driverCodeFor({ driverName: '', driverCode: '' }), '');

// distances
assert.deepEqual(formatDistance(5.891, 'km', 2), { value: '5.89', unit: 'km' });
assert.deepEqual(formatDistance(5.891, 'mi', 2), { value: '3.66', unit: 'mi' });
assert.deepEqual(formatDistance(KM_PER_MILE * 10, 'mi', 0), { value: '10', unit: 'mi' });
