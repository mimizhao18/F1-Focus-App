# Backlog: things to change or add later

# Decisions for you (nothing is built until you decide)

Answer these whenever you have time. Short answers are fine; "your call" is a valid answer for any of them.

## Rewards and levels (`src/logic/rewards.ts`, `src/data/cosmetics.ts`)
1. **Earning rate.** Now: 1 XP and 1 credit per focused minute. A 25-minute race = 25 XP. Is that the right pace, or should credits and XP differ (for example more credits for finishing)?
2. **Finishing bonus.** Should finishing the full race pay extra over ending early? (Ending early now pays only for time focused.)
3. **Level curve.** Now: level n needs 50 x (n-1)^2 XP (level 2 at 50, level 5 at 800). How many hours of focus should level 10 take?
4. **What levels do.** Right now a level is just a number. Should levels unlock things (colors, tracks, car parts)?
5. **Prices.** Colors cost 50 to 300 credits. How long should the most expensive thing take to earn?
6. **Streak rewards.** Should a streak give bonus XP or credits?

## Car design (`src/components/CarIcon.tsx`, `src/data/liveries.ts`)
1. **Look.** The car has a simple version (on the track) and a full version (Home, garage), both top-down vector art, with 5 liveries. The end goal is a clean, close-to-real F1 car on Home and in the garage, shown in a **diagonal 3D view**. How should that be made? Options: (a) hand-drawn illustrations per livery (best look, most work, one image per livery and angle); (b) a 3D model rendered live with three.js through `expo-gl` (the livery recolors one model, so new liveries are cheap; heavier to build, and needs checking in Expo Go and on the web demo); (c) pre-rendered images of one 3D model, rendered once per livery (good look, simple at runtime, needs a 3D tool such as Blender and a way to batch renders). Liveries are data (colors plus a pattern), which suits option (b) best.
1a. **Generations (decided).** Five eras: 1980s, 2004, 2014, 2022 (ground effect), 2026. One 3D model and one 2D icon per era; every livery is tied to one era. All five generations now have a first-pass model (2022 and 2026 refined the most; 2014, 2004 and 1980s need the same detail passes). Procedural models, as realistic as possible. Still to do for 2022: more teams, team-specific sidepod shapes, race number decal, finer details.
1b. **3D car progress.** A procedural 3D car is on Home and in the garage (see README). Next: improve the shape (sidepods, nose, thinner wings), add the race number as a decal and real-looking tire markings, and check performance on older phones.
2. **More liveries.** Only a handful for now, on purpose, while the car art keeps changing. More patterns (not just stripe, split and chevron) multiply the looks.
3. **Customization beyond liveries.** Helmet color, wheel rims, sponsors, or a free color picker as a late unlock?

## Race length (`src/app/create-session.tsx`)
1. Anything to change about the laps/minutes slider? For example presets like 25/45/60 minutes, remembering your last choice, or a "full race" button.

## UI design (all screens)
**Decided (2026-10-05):**
- Style: **dark and minimal**, clean, lots of space, data shown like a pit-wall screen.
- Accent color: **fixed F1 red** (the car shows its livery colors; the UI stays red).
- Typography: as close to F1's own fonts as possible, **not a priority**. (F1's real fonts, "Formula1 Display" and "Formula1", are licensed and cannot be used; a close free font such as Titillium Web or Barlow Condensed could stand in.)
- Corners: **sharp** (decided after trying sharp, subtle and soft in the design lab).
- Spacing: **comfortable**. Home layout: **hub**. Navigation: **bottom tab bar**.
- Credits shown with a **coin icon** (placeholder; can be redrawn later).

**Still open:**
1. Does the app have a name and logo yet? (Home says nothing right now.)
2. Light mode too, or dark only?
3. Animations, sounds, and haptics on race events.

## From the v1 build (your list)
- **UI design for everything.** Current screens are a functional first pass (colors, spacing, typography, icons, animations).
- **XP levels and credit system.** Current rules are placeholders: 1 XP and 1 credit per focused minute, level n needs 50 x (n-1)^2 XP. All in `src/logic/rewards.ts`. Prices in the garage need rebalancing against this too.
- **Car design.** Liveries exist (5) and the car is 3D on Home and in the garage. Still needs a more realistic, more detailed model (see Decisions above).

## Known gaps and loose ends
- **More tracks.** Silverstone, Monaco and Spa exist. More can be added with `tools/trace_track.py` (see README). Lap time rule: lap record rounded to the nearest 10 s.
- **Spa lap record.** The F1 page lists 1:44.701 (Perez, 2024), which gives 100 s per lap. Worth double-checking against another source, since the long-standing race lap record is often quoted as 1:46.286 (110 s).
- **Monaco hairpin.** The turn 5-7 section is simplified by the tracing; hand-tune if it looks wrong.
- **Track shape.** Lightly smoothed trace; tight corners may still look slightly rough. Could be hand-tuned.
- **three.js on phones needs a Metro setting.** `three` 0.18x ships a CommonJS file that calls the Node-only `process.emitWarning`, which crashes the app's 3D code on a phone. `metro.config.js` points every `three` import at `build/three.module.js`. If `three` is upgraded and the 3D car breaks on a phone, check that setting first. (Found 2026-10-05.)
- **Package install conflict.** `expo-keep-awake` now installs fine on SDK 58 (used on the race screen). `@react-native-community/slider` was not retried, so the race-length slider is still the custom `src/components/Slider.tsx`; worth testing whether the real one installs now.
- **Test speed in development.** Races run at 10x/30x/60x add real XP and credits to the profile. Use Settings > Reset all data to clear them.
- **Desktop notifications** from Claude when a task finishes were not arriving. Check Windows notification settings (Claude allowed, Do not disturb off).
- **Sessions under 1 minute** earn nothing and are not saved.

## Later features (from the original idea)
- Friends, leaderboards and joint sessions (needs a backend).
- Distraction warnings (yellow flag, virtual safety car, crash), notification blocking.
- Pit stops and tire strategy, race engineer messages.
- Weather effects.
- Post-session lap mini-game.
- Reward ideas: liveries, unlockable tracks.
